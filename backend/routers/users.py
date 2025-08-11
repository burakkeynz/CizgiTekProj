from __future__ import annotations
import re
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException
from passlib.context import CryptContext
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from starlette import status

from .auth import get_current_user_from_cookie
from backend.database import SessionLocal
from backend.models import Users

router = APIRouter(prefix="/users", tags=["users"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

db_dependency = Annotated[Session, Depends(get_db)]
user_dependency = Annotated[dict, Depends(get_current_user_from_cookie)]

bcrypt_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class UserVerification(BaseModel):
    password: str                   # mevcut şifre
    new_password: str = Field(min_length=8)  # min 8 (ek kontroller aşağıda)

class StatusUpdateRequest(BaseModel):
    status: str  # "online" | "offline" | "meşgul" | "aramada"

COMMON_WEAK = {"password", "123456", "qwerty", "111111", "letmein", "admin"}
ALLOWED_STATUSES = {"online", "offline", "meşgul", "aramada"}

def password_policy_errors(pw: str, user_model: Users | None = None) -> list[str]:
    """
    Frontend'deki ölçerle uyumlu bir minimum politika:
      - En az 8 karakter
      - Küçük/Büyük/Rakam/Sembol sınıflarından en az 3'ü
      - Çok yaygın kalıplar reddedilir
      - (Varsa) kullanıcı adı veya e-posta yerel kısmı şifrede geçmemeli
    """
    errors: list[str] = []

    if len(pw) < 8:
        errors.append("En az 8 karakter olmalı.")

    classes = sum([
        bool(re.search(r"[a-z]", pw)),
        bool(re.search(r"[A-Z]", pw)),
        bool(re.search(r"\d", pw)),
        bool(re.search(r"[^A-Za-z0-9]", pw)),
    ])
    if classes < 3:
        errors.append("Küçük harf, büyük harf, rakam, sembolden en az üçü bulunmalı.")

    low = pw.lower()
    if any(c in low for c in COMMON_WEAK) or re.fullmatch(r"[a-z]{6,}", low) or re.fullmatch(r"\d{6,}", pw):
        errors.append("Şifre çok yaygın/kolay tahmin edilebilir.")

    if user_model:
        uname = (user_model.username or "").lower()
        elocal = ((user_model.email or "").split("@")[0]).lower()
        if uname and uname in low:
            errors.append("Şifre kullanıcı adını içermemeli.")
        if elocal and elocal in low:
            errors.append("Şifre e-posta yerel kısmını içermemeli.")

    return errors

@router.get("/get_user", status_code=status.HTTP_200_OK)
async def get_user(user: user_dependency, db: db_dependency):
    if user is None:
        raise HTTPException(status_code=401, detail="Auth Failed")
    return db.query(Users).filter(Users.id == user.get("id")).first()

@router.put("/change_password", status_code=status.HTTP_204_NO_CONTENT)
async def change_password(
    user: user_dependency,
    db: db_dependency,
    user_verification: UserVerification,
):
    if user is None:
        raise HTTPException(status_code=401, detail="Authentication Failed")

    user_model = db.query(Users).filter(Users.id == user.get("id")).first()
    if not user_model:
        raise HTTPException(status_code=404, detail="User not found")

    # Mevcut şifre kontrolü
    if not bcrypt_context.verify(user_verification.password, user_model.hashed_password):
        raise HTTPException(status_code=401, detail="Mevcut şifre hatalı.")

    # Yeni şifre mevcutla aynı olamaz
    if user_verification.password == user_verification.new_password:
        raise HTTPException(status_code=422, detail="Yeni şifre mevcut şifre ile aynı olamaz.")
    errs = password_policy_errors(user_verification.new_password, user_model)
    if errs:
        raise HTTPException(status_code=422, detail="; ".join(errs))

    user_model.hashed_password = bcrypt_context.hash(user_verification.new_password)
    db.add(user_model)
    db.commit()
    # 204 

@router.get("/available", status_code=200)
async def get_available_users(user: user_dependency, db: db_dependency):
    if user is None:
        raise HTTPException(status_code=401, detail="Auth Failed")
    users = db.query(Users).filter(Users.id != user["id"]).all()
    return [
        {
            "id": u.id,
            "username": u.username,
            "first_name": u.first_name,
            "last_name": u.last_name,
            "name": f"{(u.first_name or '').strip()} {(u.last_name or '').strip()}".strip()
                    or u.username
                    or "Bilinmeyen",
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
    status_update: StatusUpdateRequest,
):
    if user is None:
        raise HTTPException(status_code=401, detail="Not authenticated")

    if status_update.status not in ALLOWED_STATUSES:
        raise HTTPException(status_code=422, detail="Geçersiz durum.")

    user_model = db.query(Users).filter(Users.id == user["id"]).first()
    if not user_model:
        raise HTTPException(status_code=404, detail="User not found")

    user_model.status = status_update.status
    db.commit()
    db.refresh(user_model)
    return {"message": "Status updated successfully", "new_status": user_model.status}
