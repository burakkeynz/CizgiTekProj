from fastapi import APIRouter, Depends, HTTPException, Query
from backend.routers.auth import get_current_user_from_cookie
import os, boto3

AWS_ACCESS_KEY = os.getenv("AWS_ACCESS_KEY_ID")
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY")
AWS_DEFAULT_REGION = os.getenv("AWS_DEFAULT_REGION")
AWS_S3_BUCKET_NAME = os.getenv("AWS_S3_BUCKET_NAME")

router = APIRouter(prefix="/files", tags=["files"])

def create_presigned_url(key: str, expires_in=300):
    s3 = boto3.client(
        "s3",
        aws_access_key_id=AWS_ACCESS_KEY,
        aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
        region_name=AWS_DEFAULT_REGION,
    )
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
    key: str = Query(...),
    user: dict = Depends(get_current_user_from_cookie)
):
    if not user or not user.get("id"):
        raise HTTPException(status_code=401, detail="Authentication failed")

    url = create_presigned_url(key, expires_in=300)  # 5 dk
    return {"url": url}
