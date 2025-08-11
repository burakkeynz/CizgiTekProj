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

#MIME düzeltmeleri
mimetypes.add_type("audio/mp4", ".m4a")
mimetypes.add_type("image/jpeg", ".jpg")
mimetypes.add_type("image/jpeg", ".jpeg")
mimetypes.add_type("image/png", ".png")

router = APIRouter(prefix="/gemini", tags=["gemini"])

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
MODEL = "gemini-2.5-flash"

# RPM limiter
RATE_LIMIT_RPM = int(os.getenv("GEMINI_RPM", "8"))
_MIN_INTERVAL = 60.0 / max(1, RATE_LIMIT_RPM)
_last_call_ts = 0.0
def _rl_gate():
    global _last_call_ts
    now = time.time()
    wait = max(0.0, _MIN_INTERVAL - (now - _last_call_ts))
    if wait > 0:
        time.sleep(wait)
    _last_call_ts = time.time()

def _stream_with_backoff(make_stream_fn, max_attempts=4, base_sleep=2.0):
    attempt = 0
    while attempt < max_attempts:
        attempt += 1
        try:
            _rl_gate()
            resp = make_stream_fn()
            for chunk in resp:
                if getattr(chunk, "text", None):
                    yield chunk.text
            return
        except Exception as e:
            msg = str(e)
            transient = (
                "RESOURCE_EXHAUSTED", "429",
                "ACTIVE", "FAILED_PRECONDITION",
                "INTERNAL", "temporarily unavailable"
            )
            if any(t.lower() in msg.lower() for t in transient):
                time.sleep(min(base_sleep * (2 ** (attempt - 1)), 20.0))
                continue
            yield f"\n[ERROR]: {msg}"
            return
    yield "\n[ERROR]: Backoff attempts exhausted.\n"


# yardımcı fonksiyonklar
def s3_key_from_url(url: str) -> str:
    return url.split(".amazonaws.com/", 1)[1]

def normalize_mime(filename: str, guessed: Optional[str]) -> str:
    fn = (filename or "").lower()
    mime = (guessed or "application/octet-stream")
    if fn.endswith(".webm") and mime == "video/webm":
        mime = "audio/webm"
    if fn.endswith(".m4a") and mime in (None, "application/octet-stream", "audio/mpeg"):
        mime = "audio/mp4"
    if mime == "application/octet-stream":
        if fn.endswith(".mp3"):  mime = "audio/mpeg"
        elif fn.endswith(".wav"): mime = "audio/wav"
        elif fn.endswith(".ogg"): mime = "audio/ogg"
        elif fn.endswith(".flac"): mime = "audio/flac"
        elif fn.endswith(".aiff") or fn.endswith(".aif"): mime = "audio/aiff"
        elif fn.endswith(".pdf"):  mime = "application/pdf"
        elif fn.endswith(".png"):  mime = "image/png"
        elif fn.endswith(".jpg") or fn.endswith(".jpeg"): mime = "image/jpeg"
    return mime

def upload_and_wait_active(file_bytes: bytes, mime: str, timeout_s: float = 45.0, poll_sleep: float = 0.8):
    """main.py bunu import ediyor -> imza değişmedi."""
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

def _ensure_all_active(file_objs, timeout_s: float = 30.0, poll_sleep: float = 0.8):
    names = [getattr(u, "name", None) for u in file_objs]
    names = [n for n in names if n]
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

def _file_part_from_bytes(raw: bytes, mime: str):
    """Bytes -> File Store -> Part(file_data). Inline **KULLANMIYORUZ** (INVALID_ARGUMENT kaçınmak için)."""
    up = upload_and_wait_active(raw, mime)
    return up, types.Part(file_data=types.FileData(file_uri=up.uri, mime_type=mime))


@router.post("/chat/stream")
async def gemini_chat_stream(
    message: str = Form(...),
    files: Optional[List[str]] = Form(None),
    web_search: bool = Form(False),
    contents: str = Form(None),
    upload_files: Optional[List[UploadFile]] = File(None),
):
    """
    Eski çalışan yapı:
      - Tüm resim/dosya içerikleri **önce File Store'a** yüklenir
      - `types.FileData(file_uri=..., mime_type=...)` olarak gönderilir
      - Stream yanıtı bozulmaz
    """
    try:
        built_contents: List[types.Content] = []

        def add_text(role: str, text: str):
            built_contents.append(types.Content(role=role, parts=[types.Part(text=text or "")]))

        uploaded_for_cleanup = []
        if contents:
            try:
                parsed = json.loads(contents)
                for entry in parsed:
                    role = entry.get("role")
                    text = entry.get("text", "")
                    if role == "user":
                        add_text("user", text)
                    elif role == "model":
                        add_text("model", text)
                        
                    if entry.get("files"):
                        for url in entry["files"]:
                            s3u = url["url"] if isinstance(url, dict) else url
                            s3_key = s3_key_from_url(s3u)
                            data = read_file_from_s3(s3_key)
                            filename = os.path.basename(s3_key)
                            mime = normalize_mime(filename, mimetypes.guess_type(filename)[0])
                            up, part = _file_part_from_bytes(data, mime)
                            uploaded_for_cleanup.append(up)
                            built_contents.append(types.Content(role="user", parts=[part]))
            except Exception as e:
                print("[WARN] History parse hatası:", e)
        else:

            if (message or "").strip():
                add_text("user", message)

        if files:
            if isinstance(files, str):
                files = [files]
            for url in files:
                s3_key = s3_key_from_url(url)
                data = read_file_from_s3(s3_key)
                filename = os.path.basename(s3_key)
                mime = normalize_mime(filename, mimetypes.guess_type(filename)[0])
                up, part = _file_part_from_bytes(data, mime)
                uploaded_for_cleanup.append(up)
                built_contents.append(types.Content(role="user", parts=[part]))

        if upload_files:
            for uf in upload_files:
                raw = await uf.read()
                filename = (uf.filename or "").lower()
                mime = normalize_mime(filename, uf.content_type or mimetypes.guess_type(filename)[0])
                up, part = _file_part_from_bytes(raw, mime)
                uploaded_for_cleanup.append(up)
                built_contents.append(types.Content(role="user", parts=[part]))

        config = None
        if web_search:
            config = types.GenerateContentConfig(
                tools=[types.Tool(google_search=types.GoogleSearch())]
            )

        def streaming_gen():
            try:
                _ensure_all_active(uploaded_for_cleanup)
                def _mk():
                    if config:
                        return client.models.generate_content_stream(
                            model=MODEL, contents=built_contents, config=config
                        )
                    return client.models.generate_content_stream(
                        model=MODEL, contents=built_contents
                    )
                for piece in _stream_with_backoff(_mk, max_attempts=4, base_sleep=2.0):
                    if piece:
                        yield piece
            finally:
                for up in uploaded_for_cleanup:
                    try:
                        if getattr(up, "name", None):
                            client.files.delete(name=up.name)
                    except Exception:
                        pass

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
        uploaded_objs = []  
        for url in files:
            s3_key = s3_key_from_url(url)
            data = read_file_from_s3(s3_key)
            filename = os.path.basename(s3_key)
            mime = normalize_mime(filename, mimetypes.guess_type(filename)[0])
            up = upload_and_wait_active(data, mime)
            uploaded_objs.append((up, mime))

        p = prompt.strip() if (prompt and prompt.strip()) else transcribe_prompt("tr")

        def streaming_gen():
            try:
                _ensure_all_active([u for u, _ in uploaded_objs])
                parts = [types.Part(text=p)]
                for up, mime in uploaded_objs:
                    parts.append(types.Part(file_data=types.FileData(file_uri=up.uri, mime_type=mime)))
                contents = [types.Content(role="user", parts=parts)]

                def _mk():
                    return client.models.generate_content_stream(model=MODEL, contents=contents)

                for piece in _stream_with_backoff(_mk, max_attempts=4, base_sleep=2.0):
                    if piece.strip().startswith("[ERROR"):
                        yield piece
                    else:
                        cleaned = postprocess_transcript(piece)
                        if cleaned:
                            yield cleaned
            finally:
                for up, _ in uploaded_objs:
                    try:
                        if getattr(up, "name", None):
                            client.files.delete(name=up.name)
                    except Exception:
                        pass

        return StreamingResponse(streaming_gen(), media_type="text/plain")
    except Exception as e:
        import traceback; traceback.print_exc()
        raise HTTPException(500, detail=f"Gemini audio transcribe error: {e}")


def pcm16_from_wav(wav_bytes: bytes):
    buf = io.BytesIO(wav_bytes)
    with wave.open(buf, 'rb') as wf:
        n_channels = wf.getnchannels()
        sampwidth = wf.getsampwidth()
        framerate = wf.getframerate()
        n_frames = wf.getnframes()
        raw = wf.readframes(n_frames)
    if sampwidth != 2:
        raw = audioop.lin2lin(raw, sampwidth, 2)
    if n_channels == 2:
        raw = audioop.tomono(raw, 2, 0.5, 0.5)
    return raw, framerate

def wav_from_pcm16(pcm_bytes: bytes, sr: int = 16000) -> bytes:
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
    n = int(sample_rate * (frame_ms / 1000.0) * 2)
    offset = 0; ts = 0.0
    dur = (float(n) / (2 * sample_rate))
    L = len(audio)
    while offset + n <= L:
        yield _Frame(audio[offset:offset + n], ts, dur)
        ts += dur; offset += n

def vad_segments(
    pcm16: bytes,
    sample_rate: int = 16000,
    frame_ms: int = 20,
    aggressiveness: int = 2,
    max_silence_ms: int = 900,
    min_segment_ms: int = 1200
):
    import webrtcvad
    vad = webrtcvad.Vad(aggressiveness)
    frames = list(_frame_generator(frame_ms, pcm16, sample_rate))
    cur = bytearray(); voiced = []; silence_run = 0
    min_frames = int(min_segment_ms / frame_ms)
    max_silence_frames = int(max_silence_ms / frame_ms)
    need_bytes = int(min_frames * (sample_rate * (frame_ms / 1000.0) * 2))
    for fr in frames:
        if vad.is_speech(fr.bytes, sample_rate):
            cur += fr.bytes; silence_run = 0
        else:
            if len(cur) > 0:
                silence_run += 1
                if silence_run <= max_silence_frames:
                    cur += fr.bytes
                else:
                    if len(cur) >= need_bytes:
                        voiced.append(bytes(cur))
                    cur = bytearray(); silence_run = 0
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

    try:
        pcm16, in_sr = pcm16_from_wav(raw)
    except Exception as e:
        raise HTTPException(400, f"WAV parse error: {e}")

    if in_sr != 16000:
        pcm16 = audioop.ratecv(pcm16, 2, 1, in_sr, 16000, None)[0]
        in_sr = 16000

    segments = vad_segments(pcm16, sample_rate=in_sr, frame_ms=20, aggressiveness=2,
                            max_silence_ms=900, min_segment_ms=1200)

    p = prompt.strip() if (prompt and prompt.strip()) else transcribe_prompt("tr")

    def streaming_gen():
        parts = segments if segments else [pcm16]
        for i, seg in enumerate(parts, start=1):
            wav_bytes = wav_from_pcm16(seg, sr=in_sr)
            up = None
            try:
                up = upload_and_wait_active(wav_bytes, "audio/wav")
                _ensure_all_active([up])
                contents = [types.Content(
                    role="user",
                    parts=[types.Part(text=p),
                           types.Part(file_data=types.FileData(file_uri=up.uri, mime_type="audio/wav"))]
                )]

                def _mk():
                    return client.models.generate_content_stream(model=MODEL, contents=contents)

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
                    if up and getattr(up, "name", None):
                        client.files.delete(name=up.name)
                except Exception:
                    pass

    return StreamingResponse(streaming_gen(), media_type="text/plain")
