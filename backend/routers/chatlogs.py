from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Any, Optional, List
from datetime import datetime
from pydantic import BaseModel
from backend.database import get_db
from backend.models import AssistantChatLog, Users
from backend.routers.auth import get_current_user_from_cookie 

router = APIRouter(
    prefix="/chatlogs",
    tags=["chatlogs"]
)

# Pydantic
class AssistantChatLogCreate(BaseModel):
    messages: Any 
    ended_at: Optional[datetime] = None

class AssistantChatLogOut(BaseModel):
    id: int
    user_id: int
    messages: Any
    created_at: datetime
    ended_at: Optional[datetime]

    class Config:
        orm_mode = True
        
@router.post("/", response_model=AssistantChatLogOut)
def save_chat_log(
    payload: AssistantChatLogCreate,
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user_from_cookie)
):
    if not user or not user.get("id"):
        raise HTTPException(status_code=401, detail="Authentication failed")
    chat_log = AssistantChatLog(
        user_id=user["id"],
        messages=payload.messages,
        ended_at=payload.ended_at
    )
    db.add(chat_log)
    db.commit()
    db.refresh(chat_log)
    return chat_log

@router.get("/", response_model=List[AssistantChatLogOut])
def get_chat_logs(
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user_from_cookie)
):
    if not user or not user.get("id"):
        raise HTTPException(status_code=401, detail="Authentication failed")
    logs = db.query(AssistantChatLog).filter(AssistantChatLog.user_id == user["id"]).order_by(AssistantChatLog.created_at.desc()).all()
    return logs

@router.get("/{log_id}", response_model=AssistantChatLogOut)
def get_chat_log_by_id(
    log_id: int,
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user_from_cookie)
):
    if not user or not user.get("id"):
        raise HTTPException(status_code=401, detail="Authentication failed")
    log = db.query(AssistantChatLog).filter(AssistantChatLog.id == log_id, AssistantChatLog.user_id == user["id"]).first()
    if not log:
        raise HTTPException(status_code=404, detail="Chat log not found")
    return log