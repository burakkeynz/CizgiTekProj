from sqlalchemy import Column, Integer, String, Boolean, Float,  ForeignKey, JSON, DateTime
from backend.database import Base
from datetime import datetime, timezone
from sqlalchemy.orm import relationship
import pytz
from sqlalchemy import UniqueConstraint

class Users(Base):
  __tablename__='users'
  id=Column(Integer, primary_key=True, index=True)
  username = Column(String(length=150), unique=True)
  email = Column(String(length=255), unique=True)
  first_name = Column(String(length=100))
  last_name = Column(String(length=100))
  hashed_password = Column(String(length=255))
  role= Column(String(length=50))
  status = Column(String(length=20), default="offline")
  profile_picture_url = Column(String(length=500), nullable=True)
  read_receipt_enabled = Column(Boolean, default=True, nullable=False) #7 Ağustos günü eklendi

#6 Ağustos 2025 tarihinde eklendi
class UserMessageRead(Base):
    __tablename__ = "user_message_reads"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    message_id = Column(Integer, ForeignKey("user_chat_messages.id"), nullable=False)
    read_at = Column(DateTime(timezone=True), default=lambda: datetime.now(pytz.timezone("Europe/Istanbul")))

    __table_args__ = (
        UniqueConstraint('user_id', 'message_id', name='unique_user_message_read'),
    )

#yeni eklendi 25.07.2025
class UserConversation(Base):
    __tablename__ = "user_conversations"

    id = Column(Integer, primary_key=True, index=True)
    user1_id = Column(Integer, ForeignKey("users.id"))
    user2_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(pytz.timezone("Europe/Istanbul")))

    user1 = relationship("Users", foreign_keys=[user1_id])
    user2 = relationship("Users", foreign_keys=[user2_id])

    __table_args__ = (
        UniqueConstraint("user1_id", "user2_id", name="unique_user_pair"),
    )
    
#yeni eklendi 25.07.2025
class UserChatMessage(Base):
    __tablename__ = "user_chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("user_conversations.id"))
    sender_id = Column(Integer, ForeignKey("users.id"))
    content = Column(String(length=2000), nullable=False)
    timestamp = Column(DateTime(timezone=True), default=lambda: datetime.now(pytz.timezone("Europe/Istanbul")))

    conversation = relationship("UserConversation", backref="messages")
    sender = relationship("Users", foreign_keys=[sender_id])

#yeni eklendi 25.07.2025
class UserConversationState(Base):
    __tablename__ = "user_conversation_states"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    conversation_id = Column(Integer, ForeignKey("user_conversations.id"))
    cleared_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        UniqueConstraint("user_id", "conversation_id", name="user_conversation_unique"),
    )

    user = relationship("Users")
    conversation = relationship("UserConversation")


class AssistantChatLog(Base):
    __tablename__ = "assistant_chat_logs"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    messages = Column(JSON, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(pytz.timezone("Europe/Istanbul")))
    ended_at = Column(DateTime(timezone=True), nullable=True)
    user = relationship("Users", backref="chat_logs")

class Patients(Base):
    __tablename__ = "patients"
    id = Column(Integer, primary_key=True, index=True)      
    doctor_id = Column(Integer, ForeignKey("users.id"), nullable=True) 
    first_name = Column(String(length=100), nullable=False)
    last_name = Column(String(length=100), nullable=False)
    tc_no = Column(String(length=11), unique=True, nullable=False)
    age = Column(Integer, nullable=True)
    gender = Column(String(length=20), nullable=True)        
    diagnosis = Column(String(length=255), nullable=True)       
    doctor = relationship("Users", backref="patients")
    
    def __repr__(self):
        return f"<Patient {self.first_name} {self.last_name}>"