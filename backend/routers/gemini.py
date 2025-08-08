# backend/routers/gemini.py

import io, mimetypes, os, json, time
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Form
from fastapi.responses import StreamingResponse
from google import genai
from google.genai import types

from backend.utils.aws_s3 import read_file_from_s3

router = APIRouter(prefix="/gemini", tags=["gemini"])
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
MODEL = "gemini-2.5-flash"

def s3_key_from_url(url: str) -> str:
    return url.split(".amazonaws.com/", 1)[1]

def normalize_mime(filename: str, guessed: Optional[str]) -> str:
    fn = (filename or "").lower()
    mime = (guessed or "application/octet-stream")
    # Bazı ortamlarda .webm -> video/webm geliyor; audio/webm'e çevir
    if fn.endswith(".webm") and mime == "video/webm":
        mime = "audio/webm"
    # m4a için
    if fn.endswith(".m4a") and mime in (None, "application/octet-stream", "audio/mpeg"):
        mime = "audio/mp4"
    # Fallback
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
    """Gemini File Store'a yükle; ACTIVE olana kadar bekle. Sunucu 500 verirse bekleyip devam et."""
    uploaded = client.files.upload(file=io.BytesIO(file_bytes), config=dict(mime_type=mime))
    name = uploaded.name  # 'files/xxxxx'
    deadline = time.time() + timeout_s
    last_err = None
    while time.time() < deadline:
        try:
            f = client.files.get(name=name)
            if getattr(f, "state", None) == "ACTIVE":
                return f  # ACTIVE dosya nesnesini döndür
        except Exception as e:
            last_err = e  # 500 vs olabilir, bekleyip yine deneyeceğiz
        time.sleep(poll_sleep)
    # Zaman aşımı: en azından uploaded döndürelim (generate'de de retry yapacağız)
    return uploaded

@router.post("/audio/transcribe")
async def gemini_audio_transcribe(
    files: List[str] = Form(...),
    prompt: str = Form("Generate a transcript of the speech.")
):
    try:
        # 1) S3'ten indir + MIME normalize + yükle & ACTIVE bekle
        uploaded_parts = []
        for url in files:
            s3_key = s3_key_from_url(url)
            data = read_file_from_s3(s3_key)
            filename = os.path.basename(s3_key)
            guessed, _ = mimetypes.guess_type(filename)
            mime = normalize_mime(filename, guessed)
            active_file = upload_and_wait_active(data, mime)
            uploaded_parts.append(active_file)

        # 2) Stream generate + ACTIVE değilse burada da retry
        def streaming_gen():
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
                        if getattr(chunk, "text", None):
                            yield chunk.text
                    return  # başarıyla bitti
                except Exception as e:
                    msg = str(e)
                    # Dosya ACTIVE değil hatası gelirse biraz bekleyip yeniden dene
                    if "not in an ACTIVE state" in msg or "FAILED_PRECONDITION" in msg:
                        time.sleep(backoff)
                        continue
                    # Ara sıra 5xx JSON parse vs hataları olabilir -> kısa bekleyip tekrar
                    if "Failed to convert server response to JSON" in msg or "INTERNAL" in msg:
                        time.sleep(backoff)
                        continue
                    # Diğer hatalarda kullanıcıya ilet
                    yield f"\n[ERROR]: {msg}"
                    return
            # Tükenirse:
            yield "\n[ERROR]: Timed out waiting for file to become ACTIVE."

        return StreamingResponse(streaming_gen(), media_type="text/plain")
    except Exception as e:
        import traceback; traceback.print_exc()
        raise HTTPException(500, detail=f"Gemini audio transcribe error: {e}")
