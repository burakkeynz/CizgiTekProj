# from fastapi import APIRouter, Depends, HTTPException
# from pydantic import BaseModel, Field
# from typing import List, Optional
# from datetime import datetime, timezone
# from sqlalchemy.orm import Session

# from backend.database import get_db
# from backend.models import SessionLog, Users
# from backend.routers.auth import get_current_user_from_cookie
# from backend.utils.security import encrypt_message, decrypt_message

# router = APIRouter(prefix="/sessionlogs", tags=["sessionlogs"])

# class SessionLogCreate(BaseModel):
#     user2_id: int
#     session_time_stamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
#     transcript: dict | list | str

# class SessionLogOut(BaseModel):
#     id: int
#     user1_id: int
#     user2_id: int
#     session_time_stamp: datetime
#     transcript: list
#     created_at: datetime
#     updated_at: datetime
#     class Config:
#         from_attributes = True

# def _check_users(db: Session, user1_id: int, user2_id: int):
#     if not db.query(Users).filter(Users.id == user2_id).first():
#         raise HTTPException(404, detail="user2 not found")
#     if user1_id == user2_id:
#         raise HTTPException(400, detail="user1_id and user2_id cannot be same")

# @router.post("/", response_model=SessionLogOut)
# def create_session_log(
#     payload: SessionLogCreate,
#     db: Session = Depends(get_db),
#     me: dict = Depends(get_current_user_from_cookie),
# ):
#     if not me or not me.get("id"):
#         raise HTTPException(401, "Authentication failed")

#     user1_id = int(me["id"])
#     _check_users(db, user1_id, payload.user2_id)

#     encrypted = encrypt_message(payload.transcript)
#     row = SessionLog(
#         user1_id=user1_id,
#         user2_id=payload.user2_id,
#         session_time_stamp=payload.session_time_stamp,
#         transcript=encrypted,
#     )
#     db.add(row); db.commit(); db.refresh(row)

#     return SessionLogOut(
#         id=row.id,
#         user1_id=row.user1_id,
#         user2_id=row.user2_id,
#         session_time_stamp=row.session_time_stamp,
#         transcript=decrypt_message(row.transcript),
#         created_at=row.created_at,
#         updated_at=row.updated_at,
#     )

# @router.get("/{log_id}", response_model=SessionLogOut)
# def get_session_log(
#     log_id: int,
#     db: Session = Depends(get_db),
#     me: dict = Depends(get_current_user_from_cookie),
# ):
#     if not me or not me.get("id"):
#         raise HTTPException(401, "Authentication failed")
#     row = db.query(SessionLog).filter(SessionLog.id == log_id).first()
#     if not row:
#         raise HTTPException(404, "Not found")
#     if me["id"] not in (row.user1_id, row.user2_id):
#         raise HTTPException(403, "Forbidden")

#     return SessionLogOut(
#         id=row.id,
#         user1_id=row.user1_id,
#         user2_id=row.user2_id,
#         session_time_stamp=row.session_time_stamp,
#         transcript=decrypt_message(row.transcript),
#         created_at=row.created_at,
#         updated_at=row.updated_at,
#     )

# @router.get("/", response_model=List[SessionLogOut])
# def list_session_logs(
#     peer_id: Optional[int] = None,
#     db: Session = Depends(get_db),
#     me: dict = Depends(get_current_user_from_cookie),
# ):
#     if not me or not me.get("id"):
#         raise HTTPException(401, "Authentication failed")

#     q = db.query(SessionLog).filter(
#         (SessionLog.user1_id == me["id"]) | (SessionLog.user2_id == me["id"])
#     )
#     if peer_id is not None:
#         q = q.filter(
#             ((SessionLog.user1_id == me["id"]) & (SessionLog.user2_id == peer_id)) |
#             ((SessionLog.user2_id == me["id"]) & (SessionLog.user1_id == peer_id))
#         )
#     rows = q.order_by(SessionLog.session_time_stamp.desc()).all()

#     return [
#         SessionLogOut(
#             id=r.id,
#             user1_id=r.user1_id,
#             user2_id=r.user2_id,
#             session_time_stamp=r.session_time_stamp,
#             transcript=decrypt_message(r.transcript),
#             created_at=r.created_at,
#             updated_at=r.updated_at,
#         )
#         for r in rows
#     ]
