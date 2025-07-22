from fastapi import APIRouter, Depends, HTTPException, Request, Response
import os
from pydantic import BaseModel
from starlette import status
from backend.models import Users
from backend.database import SessionLocal
from typing import Annotated
from sqlalchemy.orm import Session
from passlib.context import CryptContext
from dotenv import load_dotenv
from datetime import datetime, timedelta, timezone
from jose import jwt, JWTError, ExpiredSignatureError
from fastapi.security import OAuth2PasswordRequestForm

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = os.getenv("ALGORITHM")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 60))
router = APIRouter(prefix='/auth', tags=['auth'])

class LocationUpdateRequest(BaseModel):
    lat: float
    lon: float
    
class CreateUserRequest(BaseModel):
    username: str
    email: str
    first_name: str
    last_name: str
    password: str
    role: str

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

db_dependency = Annotated[Session, Depends(get_db)]
form_dependency = Annotated[OAuth2PasswordRequestForm, Depends()]
bcrypt_context = CryptContext(schemes=['bcrypt'], deprecated='auto')

def create_token(username: str, user_id: int, role: str, expires_delta: timedelta):
    payload = {
        'sub': username,
        'iat': datetime.now(timezone.utc),
        'id': user_id,
        'role': role,
        'exp': datetime.now(timezone.utc) + expires_delta
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def refresh_token(response: Response, username: str, user_id: int, role: str):
    new_token = create_token(
        username,
        user_id,
        role,
        timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    response.set_cookie(
        key="access_token",
        value=new_token,
        httponly=True,
        secure=False,  # Prod için True yap
        samesite="Lax",
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60
    )
    return new_token

async def get_current_user_from_cookie(request: Request):
    token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated"
        )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get('sub')
        user_id: int = payload.get('id')
        user_role: str = payload.get('role')
        if username is None or user_id is None:
            raise HTTPException(status_code=401, detail="Invalid payload")
        return {'username': username, 'id': user_id, 'role': user_role}
    except ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expired"
        )
    except JWTError as e:
        print(f"JWT decode failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials"
        )

@router.get("/me")
async def get_me(
    request: Request,
    response: Response,
    db: db_dependency,
    user_data: dict = Depends(get_current_user_from_cookie)
):
    db_user = db.query(Users).filter(Users.id == user_data["id"]).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")

    new_token = refresh_token(
        response,
        user_data["username"],
        user_data["id"],
        user_data["role"]
    )

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
        "status": db_user.status 
    }


def authenticate_user(username: str, password: str, db):
    user = db.query(Users).filter(Users.username == username).first()
    if not user:
        return False
    if not bcrypt_context.verify(password, user.hashed_password):
        return False
    return user

@router.post('/register', status_code=201)
def register(register_request: CreateUserRequest, db: db_dependency):
    userModel = Users(
        email=register_request.email,
        username=register_request.username,
        first_name=register_request.first_name,
        last_name=register_request.last_name,
        hashed_password=bcrypt_context.hash(register_request.password),
        role=register_request.role,
    )
    db.add(userModel)
    db.commit()
    db.refresh(userModel)
    return {"message": "Creation successful!", "user_id": userModel.id}

@router.post('/token')
async def login_token(
    form_data: form_dependency,
    db: db_dependency,
    response: Response
):
    user = authenticate_user(form_data.username, form_data.password, db)
    if not user:
        raise HTTPException(status_code=401, detail="Credentials invalid")

    access_token = create_token(
        user.username,
        user.id,
        user.role,
        timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=False,  # Prod için True yap
        samesite="Lax",
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60
    )
    return {"message": "Login successful"}

@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"message": "Logged out successfully"}

