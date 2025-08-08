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

@router.get('/get_user', status_code=status.HTTP_200_OK)
async def get_user(user: user_dependency, db: db_dependency):
    if user is None:
        raise HTTPException(status_code=401, detail='Auth Failed')
    return db.query(Users).filter(Users.id == user.get('id')).first()


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
