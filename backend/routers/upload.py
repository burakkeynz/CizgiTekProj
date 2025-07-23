from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from backend.utils.aws_s3 import upload_file_to_s3
from backend.routers.auth import get_current_user_from_cookie
from datetime import datetime
import uuid

router = APIRouter(prefix="/upload", tags=["upload"])

ALLOWED_TYPES = {
    "application/pdf","image/png","image/jpeg","application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel","text/csv",
}
MAX_FILE_SIZE_MB = 20
MAX_FILE_SIZE = MAX_FILE_SIZE_MB * 1024 * 1024

@router.post("/file")
async def upload_file(
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user_from_cookie),
):
    if not user or not user.get("id"):
        raise HTTPException(status_code=401, detail="Authentication failed")
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail=f"Desteklenmeyen dosya tipi: {file.content_type}")
    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail=f"Dosya max {MAX_FILE_SIZE_MB} MB olabilir.")
    file.file.seek(0)
    filename = f"user_{user['id']}/{datetime.utcnow():%Y%m%d_%H%M%S}_{uuid.uuid4().hex[:8]}_{file.filename}"
    try:
        url = upload_file_to_s3(file.file, filename, file.content_type)
        return {"url": url}
    except Exception as e:
        print("UPLOAD ERROR:", e)
        raise HTTPException(status_code=500, detail=f"Upload error: {e}")
