from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models import UserConversation, UserChatMessage, UserConversationState, Users
from backend.routers.auth import get_current_user_from_cookie
from pydantic import BaseModel
from datetime import datetime
from typing import List
from backend.utils.security import encrypt_message, decrypt_message
from backend.globals import sio, connected_users

router = APIRouter(
    prefix="/conversations",
    tags=["conversations"]
)
class ConversationStartRequest(BaseModel):
    receiver_id: int

class ConversationOut(BaseModel):
    conversation_id: int
    last_message: str | None
    last_message_time: datetime | None
    participant_name: str
    participant_id: int
    participant_status: str | None = None

    class Config:
        from_attributes = True

class MessageOut(BaseModel):
    id: int
    sender_id: int
    content: str
    timestamp: datetime

    class Config:
        from_attributes = True

class MessageCreate(BaseModel):
    content: str

@router.get("/my")
def get_my_conversations(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user_from_cookie)
):
    user_id = current_user["id"]

    conversations = db.query(UserConversation).filter(
        (UserConversation.user1_id == user_id) |
        (UserConversation.user2_id == user_id)
    ).all()

    result = []
    for convo in conversations:
        other_user_id = convo.user2_id if convo.user1_id == user_id else convo.user1_id
        other_user = db.query(Users).filter(Users.id == other_user_id).first()

        last_msg = (
            db.query(UserChatMessage)  
            .filter(UserChatMessage.conversation_id == convo.id)
            .order_by(UserChatMessage.timestamp.desc())
            .first()
        )

        name = (f"{other_user.first_name or ''} {other_user.last_name or ''}").strip() or other_user.username or "Bilinmeyen"

        if last_msg:
            try:
                content = decrypt_message(last_msg.content)
            except Exception:
                content = "[Çözülemedi]"
        else:
            content = ""

        result.append({
            "conversation_id": convo.id,
            "user": {
                "id": other_user.id,
                "name": name,
                "profile_picture_url": other_user.profile_picture_url,
                "status": other_user.status,
            },
            "last_message": {
                "from_me": last_msg.sender_id == user_id if last_msg else False,
                "content": content,
                "timestamp": str(last_msg.timestamp) if last_msg else None
            }
        })

    return result

@router.get("/{conversation_id}/messages", response_model=List[MessageOut])
def get_messages(
    conversation_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user_from_cookie)
):
    link = db.query(UserConversationState).filter_by(
        conversation_id=conversation_id, user_id=current_user["id"]
    ).first()

    if not link:
        raise HTTPException(status_code=403, detail="Bu konuşmaya erişiminiz yok.")

    messages = db.query(UserChatMessage)\
        .filter_by(conversation_id=conversation_id)\
        .order_by(UserChatMessage.timestamp)\
        .all()

    decrypted_messages = []
    for m in messages:
        try:
            decrypted_content = decrypt_message(m.content)
        except Exception:
            decrypted_content = "[Çözülemedi]"

        decrypted_messages.append(MessageOut(
            id=m.id,
            sender_id=m.sender_id,
            content=decrypted_content,
            timestamp=m.timestamp
        ))

    return decrypted_messages

@router.post("/{conversation_id}/messages", status_code=201)
async def send_message(
    conversation_id: int,
    payload: MessageCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user_from_cookie)
):
    link = db.query(UserConversationState).filter_by(
        conversation_id=conversation_id, user_id=current_user["id"]
    ).first()

    if not link:
        raise HTTPException(status_code=403, detail="Bu konuşmaya mesaj gönderemezsiniz.")

    encrypted_content = encrypt_message(payload.content)

    message = UserChatMessage(
        conversation_id=conversation_id,
        sender_id=current_user["id"],
        content=encrypted_content
    )
    db.add(message)
    db.commit()
    db.refresh(message)

    # iğer kullanıcıyı bulma
    conversation = db.query(UserConversation).filter_by(id=conversation_id).first()
    receiver_id = conversation.user2_id if conversation.user1_id == current_user["id"] else conversation.user1_id

    # hem receiver hem sendera emitliyourm
    receiver_sid = connected_users.get(receiver_id)
    sender_sid = connected_users.get(current_user["id"])
    for sid in set([receiver_sid, sender_sid]):
        if sid and sio:
            await sio.emit("receive_message", {
                "conversation_id": conversation_id,
                "sender_id": current_user["id"],
                "content": payload.content,
                "timestamp": message.timestamp.isoformat()
            }, to=sid)

    return {"message": "Mesaj gönderildi"}

@router.post("/start_conversation")
def start_conversation(
    receiver_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user_from_cookie)
):
    sender_id = current_user["id"]
    # Aynı konuşma var mı kontrol et
    convo = db.query(UserConversation).filter(
        ((UserConversation.user1_id == sender_id) & (UserConversation.user2_id == receiver_id)) |
        ((UserConversation.user1_id == receiver_id) & (UserConversation.user2_id == sender_id))
    ).first()

    if convo:
        for uid in [sender_id, receiver_id]:
            link = db.query(UserConversationState).filter_by(user_id=uid, conversation_id=convo.id).first()
            if not link:
                link = UserConversationState(user_id=uid, conversation_id=convo.id)
                db.add(link)
        db.commit()
        return {"conversation_id": convo.id}

    convo = UserConversation(user1_id=sender_id, user2_id=receiver_id)
    db.add(convo)
    db.commit()
    db.refresh(convo)

    for uid in [sender_id, receiver_id]:
        link = UserConversationState(user_id=uid, conversation_id=convo.id)
        db.add(link)
    db.commit()

    return {"conversation_id": convo.id}

@router.delete("/{conversation_id}", status_code=204)
def soft_delete_conversation(
    conversation_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user_from_cookie)
):
    link = db.query(UserConversationState).filter_by(
        conversation_id=conversation_id,
        user_id=current_user["id"]
    ).first()

    if not link:
        raise HTTPException(status_code=404, detail="Konuşma bulunamadı.")

    link.cleared_at = datetime.now()
    db.commit()
    return JSONResponse(status_code=204, content=None)
