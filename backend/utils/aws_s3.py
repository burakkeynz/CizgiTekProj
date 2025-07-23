import os
import boto3
from botocore.exceptions import NoCredentialsError

AWS_ACCESS_KEY = os.getenv("AWS_ACCESS_KEY_ID")
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY")
AWS_DEFAULT_REGION = os.getenv("AWS_DEFAULT_REGION")
AWS_S3_BUCKET_NAME = os.getenv("AWS_S3_BUCKET_NAME")

def upload_file_to_s3(file_obj, filename, content_type):
    s3 = boto3.client(
        "s3",
        aws_access_key_id=AWS_ACCESS_KEY,
        aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
        region_name=AWS_DEFAULT_REGION,
    )
    try:
        s3.upload_fileobj(
            file_obj,
            AWS_S3_BUCKET_NAME,
            filename,
            ExtraArgs={"ContentType": content_type}
        )
        return f"https://{AWS_S3_BUCKET_NAME}.s3.{AWS_DEFAULT_REGION}.amazonaws.com/{filename}"
    except NoCredentialsError:
        raise Exception("AWS credentials not found!")
    except Exception as e:
        print("!!! UPLOAD ERROR:", e)
        raise

def read_file_from_s3(s3_key: str) -> bytes:
    s3 = boto3.client(
        "s3",
        aws_access_key_id=AWS_ACCESS_KEY,
        aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
        region_name=AWS_DEFAULT_REGION,
    )
    try:
        resp = s3.get_object(Bucket=AWS_S3_BUCKET_NAME, Key=s3_key)
        return resp["Body"].read()
    except Exception as e:
        print("!!! S3 READ ERROR:", e)
        raise
