# backend/routers/auth.py
from __future__ import annotations

import os
import re
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.security import OAuth2PasswordRequestForm
from jose import JWTError, ExpiredSignatureError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from starlette import status
from dotenv import load_dotenv

from backend.models import Users
from backend.database import SessionLocal

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = os.getenv("ALGORITHM")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 60))

router = APIRouter(prefix="/auth", tags=["auth"])

# ----------------------------
# DB deps
# ----------------------------
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

db_dependency = Annotated[Session, Depends(get_db)]
form_dependency = Annotated[OAuth2PasswordRequestForm, Depends()]
bcrypt_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class LocationUpdateRequest(BaseModel):
    lat: float
    lon: float

class CreateUserRequest(BaseModel):
    username: str = Field(min_length=3)
    email: str
    first_name: str
    last_name: str
    password: str = Field(min_length=8)  # detaylı policy aşağıda
    role: str

COMMON_WEAK = {"password", "123456", "qwerty", "111111", "letmein", "admin"}
ALLOWED_ROLES = {"Doctor", "Nurse", "Technician"}  

def password_policy_errors_for_register(pw: str, username: str, email: str) -> list[str]:
    """
    Frontend ölçer ile uyumlu:
      - en az 8 karakter
      - Küçük Büyük Rakam Sembol sınıflarından en az 3ü
      - yaygın şifreler yasak
      - Kullanıcı adı  e-posta yerel kısmı şifrede geçmemeli
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

    uname = (username or "").strip().lower()
    elocal = ((email or "").split("@")[0]).strip().lower()
    if uname and uname in low:
        errors.append("Şifre kullanıcı adını içermemeli.")
    if elocal and elocal in low:
        errors.append("Şifre e-posta yerel kısmını içermemeli.")

    return errors

def create_token(username: str, user_id: int, role: str, expires_delta: timedelta):
    payload = {
        "sub": username,
        "iat": datetime.now(timezone.utc),
        "id": user_id,
        "role": role,
        "exp": datetime.now(timezone.utc) + expires_delta,
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def refresh_token(response: Response, username: str, user_id: int, role: str):
    new_token = create_token(
        username, user_id, role, timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    response.set_cookie(
        key="access_token",
        value=new_token,
        httponly=True,
        secure=False,  # prod: True
        samesite="Lax",
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )
    return new_token

async def get_current_user_from_cookie(request: Request):
    token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        user_id: int = payload.get("id")
        user_role: str = payload.get("role")
        if username is None or user_id is None:
            raise HTTPException(status_code=401, detail="Invalid payload")
        return {"username": username, "id": user_id, "role": user_role}
    except ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
    except JWTError as e:
        print(f"JWT decode failed: {e}")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Could not validate credentials")

def authenticate_user(username: str, password: str, db: Session):
    user = db.query(Users).filter(Users.username == username).first()
    if not user:
        return False
    if not bcrypt_context.verify(password, user.hashed_password):
        return False
    return user

@router.get("/me")
async def get_me(
    request: Request,
    response: Response,
    db: db_dependency,
    user_data: dict = Depends(get_current_user_from_cookie),
):
    db_user = db.query(Users).filter(Users.id == user_data["id"]).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")

    new_token = refresh_token(response, user_data["username"], user_data["id"], user_data["role"])

    try:
        payload = jwt.decode(new_token, SECRET_KEY, algorithms=[ALGORITHM])
        now = datetime.now(timezone.utc).timestamp()
        expires_in = int(payload["exp"] - now)
    except JWTError as e:
        print(f"Token decode error: {e}")
        raise HTTPException(status_code=401, detail="Invalid refreshed token")

    return {
        "username": db_user.username,
        "first_name": db_user.first_name,
        "last_name": db_user.last_name,
        "role": db_user.role,
        "id": db_user.id,
        "expires_in": expires_in,
        "status": db_user.status,
    }

@router.post("/register", status_code=201)
def register(register_request: CreateUserRequest, db: db_dependency):
    username = register_request.username.strip()
    email = register_request.email.strip()
    first_name = register_request.first_name.strip()
    last_name = register_request.last_name.strip()
    role = register_request.role.strip()
    password = register_request.password

    if role not in ALLOWED_ROLES:
        raise HTTPException(status_code=422, detail="Geçersiz rol.")

    # benzersizlik kontrolleri
    if db.query(Users).filter(Users.username == username).first():
        raise HTTPException(status_code=409, detail="Kullanıcı adı zaten alınmış.")
    if db.query(Users).filter(Users.email == email).first():
        raise HTTPException(status_code=409, detail="E-posta zaten kayıtlı.")

    errs = password_policy_errors_for_register(password, username, email)
    if errs:
        raise HTTPException(status_code=422, detail="; ".join(errs))

    userModel = Users(
        email=email,
        username=username,
        first_name=first_name,
        last_name=last_name,
        hashed_password=bcrypt_context.hash(password),
        role=role,
    )
    db.add(userModel)
    db.commit()
    db.refresh(userModel)
    return {"message": "Creation successful!", "user_id": userModel.id}

@router.post("/token")
async def login_token(
    form_data: form_dependency,
    db: db_dependency,
    response: Response,
):
    user = authenticate_user(form_data.username, form_data.password, db)
    if not user:
        raise HTTPException(status_code=401, detail="Credentials invalid")

    if user.status == "offline":
        user.status = "online"
        db.commit()

    access_token = create_token(
        user.username, user.id, user.role, timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=False,  # prod: True
        samesite="Lax",
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )
    return {"message": "Login successful"}

@router.post("/logout")
async def logout(
    response: Response,
    db: db_dependency,
    user_data: dict = Depends(get_current_user_from_cookie),
):
    response.delete_cookie("access_token", path="/")
    user = db.query(Users).filter(Users.id == user_data["id"]).first()
    if user:
        user.status = "offline"
        db.commit()
    return {"message": "Logged out successfully"}
