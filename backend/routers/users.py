from sqlalchemy.orm import Session
from fastapi import APIRouter, Depends, HTTPException, Path, UploadFile, File
from typing import Annotated, Optional
from .auth import get_current_user_from_cookie
from dotenv import load_dotenv
from passlib.context import CryptContext
from pydantic import BaseModel, Field
from backend.database import SessionLocal
from starlette import status
from backend.models import Users
import backend.globals as globals_mod
load_dotenv()

router = APIRouter(
    prefix='/users',
    tags=['users']
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

db_dependency = Annotated[Session, Depends(get_db)]
user_dependency = Annotated[dict, Depends(get_current_user_from_cookie)]
bcrypt_context = CryptContext(schemes=['bcrypt'], deprecated='auto')

class UserVerification(BaseModel):
    password: str
    new_password: str = Field(min_length=6)

class StatusUpdateRequest(BaseModel):
    status: str  # "online", "offline", "meşgul", "aramada"

class UserSettingsUpdate(BaseModel):
    read_receipt_enabled: Optional[int] = None 

# @router.get('/me', status_code=status.HTTP_200_OK)
# async def get_me(user: user_dependency, db: db_dependency):
#     print("[GET /users/me] user dep:", user)
#     if user is None:
#         print("[GET /users/me] => user=None")
#         raise HTTPException(status_code=401, detail='Auth Failed')
#     user_obj = db.query(Users).filter(Users.id == user.get('id')).first()
#     if not user_obj:
#         print("[GET /users/me] => user_obj not found")
#         raise HTTPException(status_code=404, detail='User not found')

#     print(f"[GET /users/me] DB row: id={user_obj.id} read_receipt_enabled={user_obj.read_receipt_enabled} type={type(user_obj.read_receipt_enabled)}")
#     read_receipt = bool(user_obj.read_receipt_enabled)
#     if read_receipt is None:
#         print("[GET /users/me] read_receipt_enabled is NULL, forcing 1")
#         read_receipt = 1

#     print(f"[GET /users/me] FINAL VALUE: {read_receipt} (type={type(read_receipt)})")

#     result = {
#         "id": user_obj.id,
#         "username": user_obj.username,
#         "first_name": user_obj.first_name,
#         "last_name": user_obj.last_name,
#         "role": user_obj.role,
#         "status": user_obj.status,
#         "profile_picture_url": user_obj.profile_picture_url,
#         "read_receipt_enabled": read_receipt
#     }
#     print(f"[GET /users/me] Response: {result}")
#     return result


@router.put('/me', status_code=200)
async def update_me(
    user: user_dependency,
    db: db_dependency,
    payload: UserSettingsUpdate
):
    print("[PUT /users/me] GİRİLDİ. user:", user)
    print("[PUT /users/me] PAYLOAD:", payload.dict())
    if user is None:
        print("[PUT /users/me] => Not authenticated")
        raise HTTPException(status_code=401, detail='Not authenticated')
    user_model = db.query(Users).filter(Users.id == user["id"]).first()
    if not user_model:
        print("[PUT /users/me] => User not found")
        raise HTTPException(status_code=404, detail='User not found')

    # Sadece int 0 veya 1 kaydet!
    if payload.read_receipt_enabled is not None:
        print("[PUT /users/me] AYARLANIYOR:", payload.read_receipt_enabled)
        user_model.read_receipt_enabled = 0 if payload.read_receipt_enabled == 0 else 1

    db.commit()
    db.refresh(user_model)

    print(f"[PUT /users/me] KAYIT EDİLDİ: {user_model.read_receipt_enabled} (type: {type(user_model.read_receipt_enabled)})")

    for uid, sid in globals_mod.connected_users.items():
        if str(uid) != str(user_model.id):
            await globals_mod.sio.emit(
                "user_settings_updated",
                {
                    "user_id": user_model.id,
                    "read_receipt_enabled": user_model.read_receipt_enabled
                },
                to=sid
            )

    print(f"[PUT /users/me] RESPONSE: {{'id': {user_model.id}, 'read_receipt_enabled': {user_model.read_receipt_enabled}}}")

    return {
        "id": user_model.id,
        "read_receipt_enabled": user_model.read_receipt_enabled
    }


@router.put('/change_password', status_code=status.HTTP_204_NO_CONTENT)
async def change_password(user: user_dependency, db: db_dependency, user_verification: UserVerification):
    if user is None:
        raise HTTPException(status_code=401, detail='Authentication Failed')
    user_model = db.query(Users).filter(Users.id == user.get('id')).first()
    if not bcrypt_context.verify(user_verification.password, user_model.hashed_password):
        raise HTTPException(status_code=401, detail="Password could't change")
    user_model.hashed_password = bcrypt_context.hash(user_verification.new_password)
    db.add(user_model)
    db.commit()

@router.get("/available", status_code=200)
async def get_available_users(user: user_dependency, db: db_dependency):
    if user is None:
        raise HTTPException(status_code=401, detail='Auth Failed')
    users = db.query(Users).filter(Users.id != user["id"]).all()
    return [
        {
            "id": u.id,
            "username": u.username,
            "first_name": u.first_name,
            "last_name": u.last_name,
            "name": f"{u.first_name or ''} {u.last_name or ''}".strip() or u.username or "Bilinmeyen",
            "status": u.status,
            "profile_picture_url": u.profile_picture_url,
            "role": u.role, 
        }
        for u in users
    ]

@router.put("/update-status", status_code=200)
async def update_status(
    user: user_dependency,
    db: db_dependency,
    status_update: StatusUpdateRequest
):
    if user is None:
        raise HTTPException(status_code=401, detail='Not authenticated')
    user_model = db.query(Users).filter(Users.id == user["id"]).first()
    if not user_model:
        raise HTTPException(status_code=404, detail='User not found')
    user_model.status = status_update.status
    db.commit()
    db.refresh(user_model)
    return {"message": "Status updated successfully", "new_status": user_model.status}
