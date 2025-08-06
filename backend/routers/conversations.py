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

import backend.globals as globals_mod

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
    print(f"[HTTP][get_my_conversations] globals_mod.connected_users id: {id(globals_mod.connected_users)}, content: {globals_mod.connected_users}")

    user_id = current_user["id"]

    conversations = db.query(UserConversation).filter(
        (UserConversation.user1_id == user_id) |
        (UserConversation.user2_id == user_id)
    ).all()

    result = []
    for convo in conversations:
        # Kullanıcının bu sohbeti silip silmediğini öğren
        cleared = db.query(UserConversationState).filter_by(
            user_id=user_id,
            conversation_id=convo.id
        ).first()

        cleared_at = cleared.cleared_at if cleared else None

        last_msg = (
            db.query(UserChatMessage)
            .filter(UserChatMessage.conversation_id == convo.id)
            .filter(UserChatMessage.timestamp > cleared_at if cleared_at else True)
            .order_by(UserChatMessage.timestamp.desc())
            .first()
        )

        # Eğer cleared_at sonrası hiç mesaj yoksa bu sohbeti listeleme
        if cleared_at and not last_msg:
            continue

        other_user_id = convo.user2_id if convo.user1_id == user_id else convo.user1_id
        other_user = db.query(Users).filter(Users.id == other_user_id).first()

        name = (f"{other_user.first_name or ''} {other_user.last_name or ''}").strip() or other_user.username or "Bilinmeyen"

        if last_msg:
            try:
                content = decrypt_message(last_msg.content)
            except Exception:
                content = "[\u00c7\u00f6z\u00fclemedi]"
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
    print(f"[HTTP][get_messages] globals_mod.connected_users id: {id(globals_mod.connected_users)}, content: {globals_mod.connected_users}")

    link = db.query(UserConversationState).filter_by(
        conversation_id=conversation_id, user_id=current_user["id"]
    ).first()

    if not link:
        raise HTTPException(status_code=403, detail="Bu konuşmaya erişiminiz yok.")

    # Eğer kullanıcı daha önce bu sohbeti sildiyse cleared_at sonrası mesajları cekiyorum
    cleared_at = link.cleared_at

    messages_query = db.query(UserChatMessage)\
        .filter(UserChatMessage.conversation_id == conversation_id)

    if cleared_at:
        messages_query = messages_query.filter(UserChatMessage.timestamp > cleared_at)

    messages = messages_query.order_by(UserChatMessage.timestamp).all()

    decrypted_messages = []
    for m in messages:
        if m.sender_id is None or m.content is None:
            continue
        try:
            decrypted_content = decrypt_message(m.content)
        except Exception:
            decrypted_content = "[\u00c7\u00f6z\u00fclemedi]"

        if isinstance(decrypted_content, str):
            msg_text = decrypted_content
        elif isinstance(decrypted_content, list):
            msg_text = " ".join(
                str(i.get("text") or i.get("message") or str(i))
                for i in decrypted_content
            )
        elif isinstance(decrypted_content, dict):
            msg_text = (
                decrypted_content.get("text")
                or decrypted_content.get("message")
                or str(decrypted_content)
            )
        else:
            msg_text = str(decrypted_content)

        decrypted_messages.append(MessageOut(
            id=int(m.id),
            sender_id=int(m.sender_id),
            content=msg_text,
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
    print(f"[HTTP][send_message] globals_mod.connected_users id: {id(globals_mod.connected_users)}, content: {globals_mod.connected_users}")
    print(f"[SEND_MESSAGE] API çağrıldı! {conversation_id=}, {payload.content=}")

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

    conversation = db.query(UserConversation).filter_by(id=conversation_id).first()
    receiver_id = (
        conversation.user2_id
        if conversation.user1_id == current_user["id"]
        else conversation.user1_id
    )

    sender_user = db.query(Users).filter(Users.id == current_user["id"]).first()
    receiver_user = db.query(Users).filter(Users.id == receiver_id).first()

    sender_info = {
        "id": sender_user.id,
        "first_name": sender_user.first_name,
        "last_name": sender_user.last_name,
        "username": sender_user.username,
        "profile_picture_url": sender_user.profile_picture_url,
        "status": sender_user.status,
        "role": sender_user.role,
    }

    receiver_sid = globals_mod.connected_users.get(str(receiver_id))
    sender_sid = globals_mod.connected_users.get(str(current_user["id"]))

    # EMIT: receive_message to both sender and receiver if connected
    for sid in set([receiver_sid, sender_sid]):
        if sid and globals_mod.sio:
            print(f"[EMIT] receive_message: {sid=}, receiver={receiver_id}, sender={current_user['id']}")
            await globals_mod.sio.emit("receive_message", {
                "message_id": message.id,
                "conversation_id": conversation_id,
                "sender_id": current_user["id"],
                "content": payload.content,
                "timestamp": message.timestamp.isoformat(),
                "sender_info": sender_info,
            }, to=sid)

    # EMIT: new_conversation only to the receiver if it's a new one
    if receiver_sid and globals_mod.sio:
        await globals_mod.sio.emit("new_conversation", {
            "conversation_id": conversation_id,
            "sender_info": sender_info,
            "content": payload.content,
            "timestamp": message.timestamp.isoformat(),
        }, to=receiver_sid)

    return {"message": "Mesaj gönderildi"}

@router.post("/start_conversation")
def start_conversation(
    payload: ConversationStartRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user_from_cookie)
):
    print(f"[HTTP][start_conversation] globals_mod.connected_users id: {id(globals_mod.connected_users)}, content: {globals_mod.connected_users}")

    sender_id = current_user["id"]
    receiver_id = payload.receiver_id

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
    print(f"[HTTP][delete] globals_mod.connected_users id: {id(globals_mod.connected_users)}, content: {globals_mod.connected_users}")

    link = db.query(UserConversationState).filter_by(
        conversation_id=conversation_id,
        user_id=current_user["id"]
    ).first()

    if not link:
        raise HTTPException(status_code=404, detail="Konuşma bulunamadı.")

    link.cleared_at = datetime.now()
    db.commit()
    return JSONResponse(status_code=204, content=None)
