import io
import os
import time
import wave
import mimetypes
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Form, UploadFile, File, Depends
from fastapi.responses import StreamingResponse

from google import genai

from backend.utils.aws_s3 import read_file_from_s3
from backend.routers.auth import get_current_user_from_cookie

mimetypes.add_type("audio/mp4", ".m4a")

router = APIRouter(prefix="/gemini", tags=["gemini"])
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
MODEL = "gemini-2.5-flash"


def s3_key_from_url(url: str) -> str:
    """S3 signed/https URL’den key’i çıkar."""
    return url.split(".amazonaws.com/", 1)[1]


def normalize_mime(filename: str, guessed: Optional[str]) -> str:
    """Dosya adına ve guess’e göre ses MIME’ını normalize eder."""
    fn = (filename or "").lower()
    mime = (guessed or "application/octet-stream")

    # Bazı ortamlarda .webm -> video/webm geliyor; audio/webm'e çevir
    if fn.endswith(".webm") and mime == "video/webm":
        mime = "audio/webm"

    # m4a için düzeltme
    if fn.endswith(".m4a") and mime in (None, "application/octet-stream", "audio/mpeg"):
        mime = "audio/mp4"

    # Fallbackler
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

    return mime


def upload_and_wait_active(file_bytes: bytes, mime: str, timeout_s: float = 20.0, poll_sleep: float = 0.7):
    """
    Gemini File Store'a yükle; ACTIVE olana kadar bekle.
    Arada 5xx vs. olursa kısa bekleyip tekrar dener.
    """
    uploaded = client.files.upload(file=io.BytesIO(file_bytes), config=dict(mime_type=mime))
    name = uploaded.name 
    deadline = time.time() + timeout_s

    while time.time() < deadline:
        try:
            f = client.files.get(name=name)
            if getattr(f, "state", None) == "ACTIVE":
                return f
        except Exception:
            pass
        time.sleep(poll_sleep)

    return uploaded


@router.post("/audio/transcribe")
async def gemini_audio_transcribe(
    files: List[str] = Form(...),
    prompt: str = Form("Generate a transcript of the speech."),
    me: dict = Depends(get_current_user_from_cookie),  # AUTH
):
    """
    S3 URL’lerini alır, dosyaları File Store’a yükler, ACTIVE bekler
    ve modeli stream eder. İş bitince dosyaları File Store’dan siler.
    """
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

        def streaming_gen():
            try:
                max_attempts = 8
                backoff = 0.8
                attempt = 0
                while attempt < max_attempts:
                    attempt += 1
                    try:
                        resp = client.models.generate_content_stream(
                            model=MODEL,
                            contents=[prompt, *uploaded_parts]
                        )
                        for chunk in resp:
                            text = getattr(chunk, "text", None)
                            if text:
                                yield text
                        return  # başarıyla bitti
                    except Exception as e:
                        msg = str(e)
                        if "not in an ACTIVE state" in msg or "FAILED_PRECONDITION" in msg:
                            time.sleep(backoff)
                            continue
                        if "Failed to convert server response to JSON" in msg or "INTERNAL" in msg:
                            time.sleep(backoff)
                            continue
                        yield f"\n[ERROR]: {msg}"
                        return

                yield "\n[ERROR]: Timed out waiting for file to become ACTIVE."
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

import audioop
import webrtcvad

def pcm16_from_wav(wav_bytes: bytes):
    """
    WAV -> (pcm_int16_bytes, sample_rate).
    Giriş stereo/16-bit değilse normalize eder.
    """
    buf = io.BytesIO(wav_bytes)
    with wave.open(buf, 'rb') as wf:
        n_channels = wf.getnchannels()
        sampwidth = wf.getsampwidth()
        framerate = wf.getframerate()
        n_frames = wf.getnframes()
        raw = wf.readframes(n_frames)

    # 16-bit'e çevir
    if sampwidth != 2:
        raw = audioop.lin2lin(raw, sampwidth, 2)

    # Monoya indir
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
    n = int(sample_rate * (frame_ms / 1000.0) * 2)  # 2 byte/sample
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
    max_silence_ms: int = 800,
    min_segment_ms: int = 400
):
    """
    PCM16’ı konuşma segmentlerine ayırır, Int16 bytes listesi döner.
    """
    vad = webrtcvad.Vad(aggressiveness)
    frames = list(_frame_generator(frame_ms, pcm16, sample_rate))
    voiced = []
    cur = bytearray()
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
    prompt: str = Form("Transcribe the Turkish (and English if any) speech as plain text."),
    me: dict = Depends(get_current_user_from_cookie),
):
    if not me or not me.get("id"):
        raise HTTPException(401, "Authentication failed")

    raw = await file.read()
    filename = (file.filename or "").lower()
    ctype = (file.content_type or "").lower()

    # Şimdilik güvenli yol: WAV bekleyelim (Frontend WAV saracak)
    if ("wav" not in filename) and (not ctype.startswith("audio/wav")):
        raise HTTPException(400, "Please send WAV (mono/16-bit).")

    # WAV -> PCM16
    try:
        pcm16, in_sr = pcm16_from_wav(raw)
    except Exception as e:
        raise HTTPException(400, f"WAV parse error: {e}")

    # 16k’ya resample
    if in_sr != 16000:
        pcm16 = audioop.ratecv(pcm16, 2, 1, in_sr, 16000, None)[0]
        in_sr = 16000

    # VAD ile segmentlere ayır
    segments = vad_segments(pcm16, sample_rate=in_sr, frame_ms=20, aggressiveness=2)

    def streaming_gen():
        parts = segments if segments else [pcm16]  # segment çıkmazsa tümünü dene
        for i, seg in enumerate(parts, start=1):
            wav_bytes = wav_from_pcm16(seg, sr=in_sr)
            active_file = None
            try:
                active_file = upload_and_wait_active(wav_bytes, "audio/wav")
                resp = client.models.generate_content_stream(
                    model=MODEL,
                    contents=[prompt, active_file]
                )
                for chunk in resp:
                    text = getattr(chunk, "text", None)
                    if text:
                        yield text
                yield "\n"  # segment ayracı
            except Exception as e:
                yield f"\n[ERROR segment {i}]: {e}\n"
            finally:

                try:
                    if active_file and getattr(active_file, "name", None):
                        client.files.delete(name=active_file.name)
                except Exception:
                    pass

    return StreamingResponse(streaming_gen(), media_type="text/plain")
