# routers/files.py
from fastapi import APIRouter, Depends, HTTPException, Header
from backend.routers.auth import get_current_user_from_cookie
from starlette.responses import StreamingResponse
import os, re, boto3
from urllib.parse import quote
from unicodedata import normalize

AWS_ACCESS_KEY = os.getenv("AWS_ACCESS_KEY_ID")
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY")
AWS_DEFAULT_REGION = os.getenv("AWS_DEFAULT_REGION")
AWS_S3_BUCKET_NAME = os.getenv("AWS_S3_BUCKET_NAME")

router = APIRouter(prefix="/files", tags=["files"])

def _s3():
    return boto3.client(
        "s3",
        aws_access_key_id=AWS_ACCESS_KEY,
        aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
        region_name=AWS_DEFAULT_REGION,
    )

def _ascii_fallback(name: str) -> str:
    fb = normalize("NFKD", name).encode("ascii", "ignore").decode("ascii")
    fb = (fb or "download").replace('"', "")
    return fb

def content_disposition(name: str, inline: bool = True) -> str:
    dispo = "inline" if inline else "attachment"
    # RFC 5987 / 6266
    star = f"filename*=UTF-8''{quote(name)}"
    fallback = f'filename="{_ascii_fallback(name)}"'
    return f"{dispo}; {star}; {fallback}"

def create_presigned_url(key: str, expires_in=300):
    s3 = _s3()
    try:
        return s3.generate_presigned_url(
            "get_object",
            Params={"Bucket": AWS_S3_BUCKET_NAME, "Key": key},
            ExpiresIn=expires_in,
        )
    except Exception as e:
        print("!!! PRESIGN ERROR:", e)
        raise

@router.get("/presign")
def get_presigned_url(
    key: str,
    dl: bool = False,
    name: str | None = None,
    user: dict = Depends(get_current_user_from_cookie),
):
    if not user or not user.get("id"):
        raise HTTPException(status_code=401, detail="Authentication failed")

    s3 = _s3()
    params = {"Bucket": AWS_S3_BUCKET_NAME, "Key": key}

    if dl:
        fname = (name or key.split("/")[-1] or "download")
        params["ResponseContentDisposition"] = content_disposition(fname, inline=False)

    url = s3.generate_presigned_url("get_object", Params=params, ExpiresIn=300)
    return {"url": url}

# CORSsuz stream endpoint (Range destekli)
@router.get("/stream")
def stream_file(
    key: str,
    dl: bool = False,
    range_header: str | None = Header(None, alias="Range"),
    user: dict = Depends(get_current_user_from_cookie),
):
    if not user or not user.get("id"):
        raise HTTPException(status_code=401, detail="Authentication failed")

    # if not key.startswith(f"user_{user['id']}/"):
    #     raise HTTPException(status_code=403, detail="Forbidden")

    s3 = _s3()

    try:
        head = s3.head_object(Bucket=AWS_S3_BUCKET_NAME, Key=key)
    except Exception:
        raise HTTPException(status_code=404, detail="File not found")

    total = int(head.get("ContentLength", 0))
    ctype = head.get("ContentType") or "application/octet-stream"
    raw_name = key.split("/")[-1] or "download"

    def _body_iter(obj, chunk_size=1024 * 1024):
        body = obj["Body"]
        while True:
            chunk = body.read(chunk_size)
            if not chunk:
                break
            yield chunk

    headers = {
        "Content-Type": ctype,
        "Content-Disposition": content_disposition(raw_name, inline=not dl),
        "Accept-Ranges": "bytes",
        # bazı tarayıcı sertleştirmeleri
        "X-Content-Type-Options": "nosniff",
        "Cross-Origin-Resource-Policy": "same-site",
    }

    if range_header:
        m = re.match(r"bytes=(\d+)-(\d*)", range_header)
        if not m:
            raise HTTPException(status_code=416, detail="Invalid Range")
        start = int(m.group(1))
        end = int(m.group(2) or (total - 1))
        if start > end or end >= total:
            raise HTTPException(status_code=416, detail="Invalid Range")

        resp = s3.get_object(
            Bucket=AWS_S3_BUCKET_NAME,
            Key=key,
            Range=f"bytes={start}-{end}",
        )
        headers["Content-Range"] = f"bytes {start}-{end}/{total}"
        headers["Content-Length"] = str(end - start + 1)
        return StreamingResponse(_body_iter(resp), status_code=206, headers=headers)

    # Tam dosya
    resp = s3.get_object(Bucket=AWS_S3_BUCKET_NAME, Key=key)
    headers["Content-Length"] = str(total)
    return StreamingResponse(_body_iter(resp), headers=headers)
