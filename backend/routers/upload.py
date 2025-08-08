from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from backend.utils.aws_s3 import upload_file_to_s3
from backend.routers.auth import get_current_user_from_cookie
from datetime import datetime
import mimetypes
import uuid
import os

router = APIRouter(prefix="/upload", tags=["upload"])

# Bazı ortamlar için m4a tanımı
mimetypes.add_type("audio/mp4", ".m4a")

DOC_IMG_TYPES = {
    "application/pdf",
    "image/png",
    "image/jpeg",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
    "text/csv",
}

AUDIO_TYPES = {
    "audio/mpeg", "audio/mp3",           # mp3
    "audio/wav", "audio/x-wav",          # wav
    "audio/ogg", "audio/webm",           # ogg/opus, webm/opus
    "audio/mp4", "audio/aac", "audio/x-m4a",  # m4a/aac
    "audio/flac", "audio/x-flac",        # flac
    "audio/aiff", "audio/x-aiff",        # aiff
}

# Tek ve lower-case set
ALLOWED_TYPES = {t.lower() for t in (DOC_IMG_TYPES | AUDIO_TYPES)}

MAX_FILE_SIZE_MB = 20
MAX_FILE_SIZE = MAX_FILE_SIZE_MB * 1024 * 1024

EXT_TO_MIME = {
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".m4a": "audio/mp4",
    ".aac": "audio/aac",
    ".ogg": "audio/ogg",
    ".webm": "audio/webm",
    ".flac": "audio/flac",
    ".aiff": "audio/aiff",
    ".aif": "audio/aiff",
}

@router.post("/file")
async def upload_file(
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user_from_cookie),
):
    if not user or not user.get("id"):
        raise HTTPException(status_code=401, detail="Authentication failed")

    # Content-Type normalize
    guessed = mimetypes.guess_type(file.filename or "")[0]
    ct_in = file.content_type or guessed or "application/octet-stream"
    ct = (ct_in.split(";", 1)[0].strip().lower() or "application/octet-stream")

    # Octet-stream ise uzantıdan tahmin et
    if ct == "application/octet-stream":
        _, ext = os.path.splitext((file.filename or "").lower())
        if ext in EXT_TO_MIME:
            ct = EXT_TO_MIME[ext]

    if ct not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail=f"Desteklenmeyen dosya tipi: {ct}")

    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail=f"Dosya max {MAX_FILE_SIZE_MB} MB olabilir.")
    file.file.seek(0)

    # Basit bir isimlendirme
    safe_name = (file.filename or "file").replace("/", "_").replace("\\", "_")
    filename = f"user_{user['id']}/{datetime.utcnow():%Y%m%d_%H%M%S}_{uuid.uuid4().hex[:8]}_{safe_name}"

    try:
        url = upload_file_to_s3(file.file, filename, ct)
        return {"url": url, "content_type": ct}
    except Exception as e:
        print("UPLOAD ERROR:", e)
        raise HTTPException(status_code=500, detail=f"Upload error: {e}")
