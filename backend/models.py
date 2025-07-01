from sqlalchemy import Column, Integer, String, Boolean, ForeignKey
from backend.database import Base

class Users(Base):
  __tablename__='users'
  id=Column(Integer, primary_key=True, index=True)
  username = Column(String(length=150), unique=True)
  email = Column(String(length=255), unique=True)
  first_name = Column(String(length=100))
  last_name = Column(String(length=100))
  hashed_password = Column(String(length=255))
  role= Column(String(length=50))
  
  