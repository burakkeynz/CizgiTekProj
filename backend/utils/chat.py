from backend.models import UserConversationState, UserChatMessage, UserConversation
from sqlalchemy.orm import Session
from backend.utils.security import encrypt_message

def get_or_create_link(user_id: int, conversation_id: int, db: Session) -> UserConversationState:
    link = db.query(UserConversationState).filter_by(user_id=user_id, conversation_id=conversation_id).first()
    if link:
        if link.cleared_at:  # daha önce silinmiş gibi düşünülüyorsa
            link.cleared_at = None
            db.commit()
        return link

    link = UserConversationState(user_id=user_id, conversation_id=conversation_id)
    db.add(link)
    db.commit()
    db.refresh(link)
    return link

def create_message(sender_id: int, receiver_id: int, content: str, db: Session, conversation_id: int = None) -> UserChatMessage:
    # Eğer conversation_id verilmişse o konuyu al
    if conversation_id:
        conversation = db.query(UserConversation).filter(UserConversation.id == conversation_id).first()
    else:
        conversation = get_or_create_conversation(sender_id, receiver_id, db)

    get_or_create_link(sender_id, conversation.id, db)
    get_or_create_link(receiver_id, conversation.id, db)

    encrypted_content = encrypt_message({"text": content})

    message = UserChatMessage(
        conversation_id=conversation.id,
        sender_id=sender_id,
        content=encrypted_content
    )
    db.add(message)
    db.commit()
    db.refresh(message)
    return message
