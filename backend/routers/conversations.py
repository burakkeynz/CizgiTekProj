from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models import (
    UserConversation, UserChatMessage, UserConversationState,
    Users, UserMessageRead
)
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

class MarkReadRequest(BaseModel):
    message_ids: List[int]

class MessageOut(BaseModel):
    id: int
    sender_id: int
    content: str
    timestamp: datetime
    read_by: List[int] = [] 

    class Config:
        from_attributes = True

class MessageCreate(BaseModel):
    content: str

# kaç tane okunmamış mesaj oldugunun countını yapan fonks
def get_unread_count(db, conversation_id, user_id):
    convo = db.query(UserConversation).filter_by(id=conversation_id).first()
    if not convo:
        return 0
    other_user_id = convo.user2_id if convo.user1_id == user_id else convo.user1_id
    unread_query = db.query(UserChatMessage).filter(
        UserChatMessage.conversation_id == conversation_id,
        UserChatMessage.sender_id == other_user_id
    )
    unread_count = 0
    for msg in unread_query:
        is_read = db.query(UserMessageRead).filter_by(
            user_id=user_id, message_id=msg.id
        ).first()
        if not is_read:
            unread_count += 1
    return unread_count

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

        if cleared_at and not last_msg:
            continue

        other_user_id = convo.user2_id if convo.user1_id == user_id else convo.user1_id
        other_user = db.query(Users).filter(Users.id == other_user_id).first()
        name = (f"{other_user.first_name or ''} {other_user.last_name or ''}").strip() or other_user.username or "Bilinmeyen"

        #unread count
        unread_query = db.query(UserChatMessage).filter(
            UserChatMessage.conversation_id == convo.id,
            UserChatMessage.sender_id == other_user_id
        )
        if cleared_at:
            unread_query = unread_query.filter(UserChatMessage.timestamp > cleared_at)
        unread_count = 0
        for msg in unread_query:
            is_read = db.query(UserMessageRead).filter_by(
                user_id=user_id, message_id=msg.id
            ).first()
            if not is_read:
                unread_count += 1

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
                "read_receipt_enabled": other_user.read_receipt_enabled,
            },
            "last_message": {
                "from_me": last_msg.sender_id == user_id if last_msg else False,
                "content": content,
                "timestamp": str(last_msg.timestamp) if last_msg else None
            },
            "unread_count": unread_count,    # <--- ÖNEMLİ!
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
            decrypted_content = "[Çözülemedi]"

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

        read_by_users = [
            r.user_id for r in db.query(UserMessageRead)
            .filter_by(message_id=m.id).all()
        ]

        decrypted_messages.append(MessageOut(
            id=int(m.id),
            sender_id=int(m.sender_id),
            content=msg_text,
            timestamp=m.timestamp,
            read_by=read_by_users  
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

        #karşı tarafa badge update 
        unread_count = get_unread_count(db, conversation_id, receiver_id)
        await globals_mod.sio.emit("unread_count_update", {
            "conversation_id": conversation_id,
            "user_id": receiver_id,
            "unread_count": unread_count,
        }, to=receiver_sid)

    return {"message": "Mesaj gönderildi"}

@router.post("/start_conversation")
def start_conversation(
    payload: ConversationStartRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user_from_cookie)
):
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
    link = db.query(UserConversationState).filter_by(
        conversation_id=conversation_id,
        user_id=current_user["id"]
    ).first()

    if not link:
        raise HTTPException(status_code=404, detail="Konuşma bulunamadı.")

    link.cleared_at = datetime.now()
    db.commit()
    return JSONResponse(status_code=204, content=None)

@router.post("/mark_as_read")
async def mark_messages_as_read(
    payload: MarkReadRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user_from_cookie)
):
    user_id = current_user["id"]
    now = datetime.now()
    updated_conversation_ids = set()
    affected_messages = []

    for msg_id in payload.message_ids:
        msg = db.query(UserChatMessage).filter_by(id=msg_id).first()
        if msg:
            updated_conversation_ids.add(msg.conversation_id)
            exists = db.query(UserMessageRead).filter_by(
                user_id=user_id, message_id=msg_id
            ).first()
            if not exists:
                db.add(UserMessageRead(user_id=user_id, message_id=msg_id, read_at=now))
                affected_messages.append((msg.conversation_id, msg_id))
    db.commit()

    for convo_id, msg_id in affected_messages:
        convo = db.query(UserConversation).filter_by(id=convo_id).first()
        peer_id = convo.user2_id if convo.user1_id == user_id else convo.user1_id
        peer_obj = db.query(Users).filter(Users.id == peer_id).first()
        peer_sid = globals_mod.connected_users.get(str(peer_id))

        read_by_users = [
            r.user_id for r in db.query(UserMessageRead).filter_by(message_id=msg_id).all()
        ]
        print("EMITTING message_read_update:", convo_id, msg_id, read_by_users)


        if peer_obj and peer_obj.read_receipt_enabled and peer_sid and globals_mod.sio:
            user_obj = db.query(Users).filter(Users.id == user_id).first()
            await globals_mod.sio.emit(
                "message_read_update",
                {
                    "conversation_id": convo_id,
                    "message_id": msg_id,
                    "read_by": read_by_users,
                    "peer_read_receipt_enabled": peer_obj.read_receipt_enabled,
                    "my_read_receipt_enabled": user_obj.read_receipt_enabled if user_obj else True,
                },
                to=peer_sid
            )

    for convo_id in updated_conversation_ids:
        sid = globals_mod.connected_users.get(str(user_id))
        if sid and globals_mod.sio:
            unread_count = get_unread_count(db, convo_id, user_id)
            await globals_mod.sio.emit(
                "unread_count_update",
                {
                    "conversation_id": convo_id,
                    "user_id": user_id,
                    "unread_count": unread_count,
                },
                to=sid,
            )
    return {"success": True, "marked": payload.message_ids}
