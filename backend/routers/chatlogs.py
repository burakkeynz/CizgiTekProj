from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Any, Optional, List
from datetime import datetime
from pydantic import BaseModel
from backend.database import get_db
from backend.models import AssistantChatLog, Users
from backend.routers.auth import get_current_user_from_cookie 
from backend.utils.security import encrypt_message, decrypt_message

router = APIRouter(
    prefix="/chatlogs",
    tags=["chatlogs"]
)


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
    
    encrypted_messages = encrypt_message(payload.messages)
    
    chat_log = AssistantChatLog(
        user_id=user["id"],
        messages=encrypted_messages,
        ended_at=payload.ended_at
    )
    db.add(chat_log)
    db.commit()
    db.refresh(chat_log)
    
    chat_log.messages = payload.messages
    return chat_log

@router.get("/", response_model=List[AssistantChatLogOut])
def get_chat_logs(
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user_from_cookie)
):
    if not user or not user.get("id"):
        raise HTTPException(status_code=401, detail="Authentication failed")
    logs = db.query(AssistantChatLog).filter(AssistantChatLog.user_id == user["id"]).order_by(AssistantChatLog.created_at.desc()).all()
    
    for log in logs:
        if isinstance(log.messages, str):
            log.messages = decrypt_message(log.messages)
       
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
    if isinstance(log.messages, str):
        log.messages = decrypt_message(log.messages)
    return log

@router.delete("/{log_id}", status_code=204)
def delete_chat_log(
    log_id: int,
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user_from_cookie)
):
    if not user or not user.get("id"):
        raise HTTPException(status_code=401, detail="Authentication failed")
    log = db.query(AssistantChatLog).filter(
        AssistantChatLog.id == log_id, AssistantChatLog.user_id == user["id"]
    ).first()
    if not log:
        raise HTTPException(status_code=404, detail="Chat log not found")
    db.delete(log)
    db.commit()
    return
