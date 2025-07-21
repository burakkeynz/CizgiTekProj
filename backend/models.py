from sqlalchemy import Column, Integer, String, Boolean, Float,  ForeignKey, JSON, DateTime
from backend.database import Base
from datetime import datetime, timezone
from sqlalchemy.orm import relationship
import pytz

class Users(Base):
  __tablename__='users'
  id=Column(Integer, primary_key=True, index=True)
  username = Column(String(length=150), unique=True)
  email = Column(String(length=255), unique=True)
  first_name = Column(String(length=100))
  last_name = Column(String(length=100))
  hashed_password = Column(String(length=255))
  role= Column(String(length=50))
  

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