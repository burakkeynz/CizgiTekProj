import io
import os
import time
import wave
import json
import audioop
import mimetypes
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Form, UploadFile, File, Depends
from fastapi.responses import StreamingResponse

from google import genai
from google.genai import types

from backend.utils.aws_s3 import read_file_from_s3
from backend.routers.auth import get_current_user_from_cookie
from backend.routers.prompts import *
import webrtcvad


mimetypes.add_type("audio/mp4", ".m4a")

router = APIRouter(prefix="/gemini", tags=["gemini"])
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
MODEL = "gemini-2.5-flash"

RATE_LIMIT_RPM = int(os.getenv("GEMINI_RPM", "8"))
_MIN_INTERVAL = 60.0 / max(1, RATE_LIMIT_RPM)
_last_call_ts = 0.0


def _rl_gate():
    """Dakikalık oran sınırlayıcı (senkron)."""
    global _last_call_ts
    now = time.time()
    wait = max(0.0, _MIN_INTERVAL - (now - _last_call_ts))
    if wait > 0:
        time.sleep(wait)
    _last_call_ts = time.time()


def _stream_with_backoff(make_stream_fn, max_attempts=4, base_sleep=2.0):
    """generate_content_stream için basit exponential backoff (429/ACTIVE gecikmesi vs)."""
    attempt = 0
    while attempt < max_attempts:
        attempt += 1
        try:
            _rl_gate()
            resp = make_stream_fn()
            for chunk in resp:
                text = getattr(chunk, "text", None)
                if text:
                    yield text
            return
        except Exception as e:
            msg = str(e)
            transient = (
                "RESOURCE_EXHAUSTED", "429",
                "not in an ACTIVE state", "FAILED_PRECONDITION",
                "INTERNAL", "temporarily unavailable"
            )
            if any(t in msg for t in transient):
                time.sleep(min(base_sleep * (2 ** (attempt - 1)), 20.0))
                continue
            yield f"\n[ERROR]: {msg}"
            return
    yield "\n[ERROR]: Backoff attempts exhausted.\n"


def s3_key_from_url(url: str) -> str:
    """S3 signed/https URL’den key’i çıkar."""
    return url.split(".amazonaws.com/", 1)[1]


def normalize_mime(filename: str, guessed: Optional[str]) -> str:
    """Dosya adına ve guess’e göre MIME normalize eder (özellikle ses)."""
    fn = (filename or "").lower()
    mime = (guessed or "application/octet-stream")

    if fn.endswith(".webm") and mime == "video/webm":
        mime = "audio/webm"

    if fn.endswith(".m4a") and mime in (None, "application/octet-stream", "audio/mpeg"):
        mime = "audio/mp4"

    if mime == "application/octet-stream":
        if fn.endswith(".mp3"):
            mime = "audio/mpeg"
        elif fn.endswith(".wav"):
            mime = "audio/wav"
        elif fn.endswith(".ogg"):
            mime = "audio/ogg"
        elif fn.endswith(".flac"):
            mime = "audio/flac"
        elif fn.endswith(".aiff") or fn.endswith(".aif"):
            mime = "audio/aiff"
        elif fn.endswith(".pdf"):
            mime = "application/pdf"
        elif fn.endswith(".png"):
            mime = "image/png"
        elif fn.endswith(".jpg") or fn.endswith(".jpeg"):
            mime = "image/jpeg"

    return mime


def upload_and_wait_active(file_bytes: bytes, mime: str, timeout_s: float = 45.0, poll_sleep: float = 0.8):
    """
    Gemini File Store'a yükle; ACTIVE olana kadar bekle.
    Gerektiğinde main.py bunu import ediyor, o yüzden ismi/fonksiyonu koruyoruz.
    """
    up = client.files.upload(file=io.BytesIO(file_bytes), config=dict(mime_type=mime))
    name = up.name
    deadline = time.time() + timeout_s
    while time.time() < deadline:
        try:
            f = client.files.get(name=name)
            if getattr(f, "state", None) == "ACTIVE":
                return f
        except Exception:
            pass
        time.sleep(poll_sleep)

    return up


def _ensure_all_active(uploaded_list, timeout_s: float = 30.0, poll_sleep: float = 0.8):
    """generate_content çağrısından hemen önce tüm FileData’ların ACTIVE olduğundan emin ol."""
    names = [u.name for u in uploaded_list if getattr(u, "name", None)]
    if not names:
        return
    deadline = time.time() + timeout_s
    while time.time() < deadline:
        ok = True
        for n in names:
            try:
                f = client.files.get(name=n)
                if getattr(f, "state", None) != "ACTIVE":
                    ok = False
                    break
            except Exception:
                ok = False
                break
        if ok:
            return
        time.sleep(poll_sleep)


@router.post("/chat/stream")
async def gemini_chat_stream(
    message: str = Form(...),
    files: Optional[List[str]] = Form(None),
    web_search: bool = Form(False),
    contents: str = Form(None),
    upload_files: Optional[List[UploadFile]] = File(None),
):
    try:
        inline_contents: List[types.Content] = []

        def add_text(role: str, text: str):
            inline_contents.append(types.Content(role=role, parts=[types.Part(text=text or "")]))

        def add_bytes_part(raw: bytes, mime: str):
            part = types.Part.from_bytes(data=raw, mime_type=mime)
            inline_contents.append(types.Content(role="user", parts=[part]))

        if contents:
            try:
                parsed = json.loads(contents)
                for entry in parsed:
                    if entry.get("files"):
                        for url in entry["files"]:
                            s3u = url["url"] if isinstance(url, dict) else url
                            s3_key = s3_key_from_url(s3u)
                            data = read_file_from_s3(s3_key)
                            filename = os.path.basename(s3_key)
                            mime, _ = mimetypes.guess_type(filename)
                            mime = normalize_mime(filename, mime)
                            add_bytes_part(data, mime)

                    if entry.get("role") == "user":
                        add_text("user", entry.get("text", ""))
                    elif entry.get("role") == "model":
                        add_text("model", entry.get("text", ""))
            except Exception as e:
                print("[WARN] History parse hatası:", e)
        else:
            if message.strip():
                add_text("user", message)

        if files:
            if isinstance(files, str):
                files = [files]
            for url in files:
                s3_key = s3_key_from_url(url)
                data = read_file_from_s3(s3_key)
                filename = os.path.basename(s3_key)
                mime, _ = mimetypes.guess_type(filename)
                mime = normalize_mime(filename, mime)
                add_bytes_part(data, mime)

        if upload_files:
            for uf in upload_files:
                raw = await uf.read()
                filename = (uf.filename or "").lower()
                mime = (uf.content_type or mimetypes.guess_type(filename)[0] or "application/octet-stream")
                mime = normalize_mime(filename, mime)
                add_bytes_part(raw, mime)

        # Google Search
        config = None
        if web_search:
            config = types.GenerateContentConfig(tools=[types.Tool(google_search=types.GoogleSearch())])

        uploaded_to_delete = []

        def gen_with_inline():
            _rl_gate()
            if config:
                resp = client.models.generate_content_stream(model=MODEL, contents=inline_contents, config=config)
            else:
                resp = client.models.generate_content_stream(model=MODEL, contents=inline_contents)
            for chunk in resp:
                if hasattr(chunk, "text") and chunk.text:
                    yield chunk.text

        def gen_with_filestore():
            _rl_gate()
            rebuilt: List[types.Content] = []
            try:
                for c in inline_contents:
                    new_parts = []
                    for p in c.parts:
                        if getattr(p, "text", None) is not None:
                            new_parts.append(types.Part(text=p.text))
                        elif getattr(p, "inline_data", None) is not None or hasattr(p, "data"):
                            inline = getattr(p, "inline_data", None)
                            if not inline:
                                raise ValueError("Inline part payload not accessible.")
                            raw = inline.data
                            mime = inline.mime_type or "application/octet-stream"
                            up = upload_and_wait_active(raw, mime)
                            uploaded_to_delete.append(up)
                            fd = types.FileData(file_uri=up.uri, mime_type=mime)
                            new_parts.append(types.Part(file_data=fd))
                        else:
                            new_parts.append(p)
                    rebuilt.append(types.Content(role=c.role, parts=new_parts))

                _ensure_all_active(uploaded_to_delete)

                if config:
                    resp = client.models.generate_content_stream(model=MODEL, contents=rebuilt, config=config)
                else:
                    resp = client.models.generate_content_stream(model=MODEL, contents=rebuilt)
                for chunk in resp:
                    if hasattr(chunk, "text") and chunk.text:
                        yield chunk.text
            finally:
                for up in uploaded_to_delete:
                    try:
                        if getattr(up, "name", None):
                            client.files.delete(name=up.name)
                    except Exception:
                        pass

        def streaming_gen():
            try:
                yield from gen_with_inline()
                return
            except Exception as e_inline:
                msg = str(e_inline)
                fallback_reasons = (
                    "too large", "request payload", "413", "INVALID_ARGUMENT",
                    "Failed to convert server response", "bytes"
                )
                if any(k.lower() in msg.lower() for k in fallback_reasons):
                    try:
                        yield from gen_with_filestore()
                        return
                    except Exception as e_fs:
                        yield f"\n[ERROR]: {e_fs}"
                        return
                yield f"\n[ERROR]: {e_inline}"

        return StreamingResponse(streaming_gen(), media_type="text/plain")

    except Exception as e:
        import traceback; traceback.print_exc()
        raise HTTPException(500, detail=f"Gemini Streaming Hatası: {e}")


@router.post("/audio/transcribe")
async def gemini_audio_transcribe(
    files: List[str] = Form(...),
    prompt: Optional[str] = Form(None),
    me: dict = Depends(get_current_user_from_cookie), 
):
    if not me or not me.get("id"):
        raise HTTPException(401, "Authentication failed")

    try:
        uploaded_parts = []
        for url in files:
            s3_key = s3_key_from_url(url)
            data = read_file_from_s3(s3_key)
            filename = os.path.basename(s3_key)
            guessed, _ = mimetypes.guess_type(filename)
            mime = normalize_mime(filename, guessed)
            active_file = upload_and_wait_active(data, mime)
            uploaded_parts.append(active_file)

        # Prompt: form’dan gelirse onu kullan, yoksa merkezi transcribe prompt (TR)
        p = prompt.strip() if (prompt and prompt.strip()) else transcribe_prompt("tr")

        def streaming_gen():
            try:
                _ensure_all_active(uploaded_parts)

                def _mk():
                    return client.models.generate_content_stream(
                        model=MODEL,
                        contents=[p, *uploaded_parts]
                    )

                for piece in _stream_with_backoff(_mk, max_attempts=4, base_sleep=2.0):
                    # Hata satırlarını olduğu gibi ilet, diğerlerini temizle
                    if piece.strip().startswith("[ERROR"):
                        yield piece
                    else:
                        cleaned = postprocess_transcript(piece)
                        if cleaned:
                            yield cleaned
            finally:
                for f in uploaded_parts:
                    try:
                        if getattr(f, "name", None):
                            client.files.delete(name=f.name)
                    except Exception:
                        pass

        return StreamingResponse(streaming_gen(), media_type="text/plain")

    except Exception as e:
        import traceback; traceback.print_exc()
        raise HTTPException(500, detail=f"Gemini audio transcribe error: {e}")


def pcm16_from_wav(wav_bytes: bytes):
    """
    WAV -> (pcm_int16_bytes, sample_rate), eğer giriş stereo/16-bit değilse normalize 
    """
    buf = io.BytesIO(wav_bytes)
    with wave.open(buf, 'rb') as wf:
        n_channels = wf.getnchannels()
        sampwidth = wf.getsampwidth()
        framerate = wf.getframerate()
        n_frames = wf.getnframes()
        raw = wf.readframes(n_frames)

    # 16 bite çeviriyorum
    if sampwidth != 2:
        raw = audioop.lin2lin(raw, sampwidth, 2)

    # monoya indiriyorum
    if n_channels == 2:
        raw = audioop.tomono(raw, 2, 0.5, 0.5)

    return raw, framerate


def wav_from_pcm16(pcm_bytes: bytes, sr: int = 16000) -> bytes:
    """Int16 mono PCM -> WAV bytes."""
    out = io.BytesIO()
    with wave.open(out, 'wb') as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sr)
        wf.writeframes(pcm_bytes)
    return out.getvalue()


class _Frame:
    __slots__ = ("bytes", "timestamp", "duration")

    def __init__(self, b, ts, dur):
        self.bytes = b
        self.timestamp = ts
        self.duration = dur


def _frame_generator(frame_ms: int, audio: bytes, sample_rate: int):
    n = int(sample_rate * (frame_ms / 1000.0) * 2)  # 2 byte sample
    offset = 0
    ts = 0.0
    dur = (float(n) / (2 * sample_rate))
    L = len(audio)
    while offset + n <= L:
        yield _Frame(audio[offset:offset + n], ts, dur)
        ts += dur
        offset += n


def vad_segments(
    pcm16: bytes,
    sample_rate: int = 16000,
    frame_ms: int = 20,
    aggressiveness: int = 2,
    max_silence_ms: int = 900,
    min_segment_ms: int = 1200
):
    """
    PCM16yı konuşma segmentlerine ayırır ve Int16 bytes listesi döner
    """
    vad = webrtcvad.Vad(aggressiveness)
    frames = list(_frame_generator(frame_ms, pcm16, sample_rate))
    cur = bytearray()
    voiced = []
    silence_run = 0
    min_frames = int(min_segment_ms / frame_ms)
    max_silence_frames = int(max_silence_ms / frame_ms)

    need_bytes = int(min_frames * (sample_rate * (frame_ms / 1000.0) * 2))

    for fr in frames:
        is_speech = vad.is_speech(fr.bytes, sample_rate)
        if is_speech:
            cur += fr.bytes
            silence_run = 0
        else:
            if len(cur) > 0:
                silence_run += 1
                if silence_run <= max_silence_frames:
                    cur += fr.bytes
                else:
                    if len(cur) >= need_bytes:
                        voiced.append(bytes(cur))
                    cur = bytearray()
                    silence_run = 0

    if len(cur) > 0 and len(cur) >= need_bytes:
        voiced.append(bytes(cur))

    return voiced


@router.post("/audio/transcribe-direct")
async def gemini_audio_transcribe_direct(
    file: UploadFile = File(...),
    prompt: Optional[str] = Form(None),
    me: dict = Depends(get_current_user_from_cookie),
):
    if not me or not me.get("id"):
        raise HTTPException(401, "Authentication failed")

    raw = await file.read()
    filename = (file.filename or "").lower()
    ctype = (file.content_type or "").lower()

    if ("wav" not in filename) and (not ctype.startswith("audio/wav")):
        raise HTTPException(400, "Please send WAV (mono/16-bit).")

    # WAV -> PCM16
    try:
        pcm16, in_sr = pcm16_from_wav(raw)
    except Exception as e:
        raise HTTPException(400, f"WAV parse error: {e}")

    if in_sr != 16000:
        pcm16 = audioop.ratecv(pcm16, 2, 1, in_sr, 16000, None)[0]
        in_sr = 16000

    segments = vad_segments(
        pcm16, sample_rate=in_sr, frame_ms=20, aggressiveness=2,
        max_silence_ms=900, min_segment_ms=1200
    )

    p = prompt.strip() if (prompt and prompt.strip()) else transcribe_prompt("tr")

    def streaming_gen():
        parts = segments if segments else [pcm16]  
        for i, seg in enumerate(parts, start=1):
            wav_bytes = wav_from_pcm16(seg, sr=in_sr)
            active_file = None
            try:
                active_file = upload_and_wait_active(wav_bytes, "audio/wav")
                _ensure_all_active([active_file])

                def _mk():
                    return client.models.generate_content_stream(
                        model=MODEL,
                        contents=[p, active_file]
                    )

                emitted = False
                for piece in _stream_with_backoff(_mk, max_attempts=4, base_sleep=2.0):
                    if piece.strip().startswith("[ERROR"):
                        yield piece
                    else:
                        cleaned = postprocess_transcript(piece)
                        if cleaned:
                            emitted = True
                            yield cleaned

                if emitted:
                    yield "\n" 

            except Exception as e:
                yield f"\n[ERROR segment {i}]: {e}\n"
            finally:
                try:
                    if active_file and getattr(active_file, "name", None):
                        client.files.delete(name=active_file.name)
                except Exception:
                    pass

    return StreamingResponse(streaming_gen(), media_type="text/plain")
