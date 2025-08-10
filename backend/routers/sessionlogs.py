from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
from sqlalchemy.orm import Session

import io
import os
import re
from urllib.parse import quote

from backend.database import get_db
from backend.models import SessionLog, Users
from backend.routers.auth import get_current_user_from_cookie
from backend.utils.security import encrypt_message, decrypt_message

from google import genai
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
MODEL = "gemini-2.5-flash"


from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont


router = APIRouter(prefix="/sessionlogs", tags=["sessionlogs"])

_TR_MAP = str.maketrans({
    "ı":"i","İ":"I","ş":"s","Ş":"S","ç":"c","Ç":"C",
    "ğ":"g","Ğ":"G","ö":"o","Ö":"O","ü":"u","Ü":"U"
})

def turkish_ascii_slug(s: str) -> str:
    s2 = s.translate(_TR_MAP)
    s2 = re.sub(r"[^\w\s.-]", "", s2)
    s2 = re.sub(r"\s+", "-", s2.strip())
    s2 = re.sub(r"-{2,}", "-", s2)
    return s2 or "dosya"

def content_disposition(filename_utf8: str, fallback_ascii: Optional[str] = None) -> str:
    ascii_name = (fallback_ascii or turkish_ascii_slug(filename_utf8))
    # RFC 5987/6266
    return f'attachment; filename="{ascii_name}"; filename*=UTF-8\'\'{quote(filename_utf8)}'


_FONT_CANDIDATES = [
    os.getenv("PDF_FONT_PATH") or "",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
]

def _register_unicode_font() -> str:
    """
    Uygun bir TTF bulursa 'AppFont' ismiyle kaydeder ve adını döndürür.
    Bulamazsa 'Helvetica' döner (Unicode olmayan).
    """
    for path in _FONT_CANDIDATES:
        if path and os.path.exists(path):
            try:
                pdfmetrics.registerFont(TTFont("AppFont", path))
                return "AppFont"
            except Exception:
                pass
    return "Helvetica"

def _escape_xml(s: str) -> str:
    return (s or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

def summary_text_to_pdf_bytes(title: str, subtitle_lines: List[str], body_text: str) -> bytes:
    font_name = _register_unicode_font()

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=18*mm,
        rightMargin=18*mm,
        topMargin=16*mm,
        bottomMargin=18*mm,
        title=title,
        author="Gemini",
        subject="Sesssion Summary"
    )

    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name="TitleCustom", parent=styles["Title"], fontName=font_name, fontSize=18, leading=22, spaceAfter=6))
    styles.add(ParagraphStyle(name="Subtle", parent=styles["Normal"], fontName=font_name, fontSize=10.5, textColor="#666666", spaceAfter=2))
    styles.add(ParagraphStyle(name="Body", parent=styles["Normal"], fontName=font_name, fontSize=11.5, leading=16))

    story = []
    story.append(Paragraph(_escape_xml(title), styles["TitleCustom"]))
    for line in subtitle_lines:
        story.append(Paragraph(_escape_xml(line), styles["Subtle"]))
    story.append(Spacer(1, 6))

    # Satır sonlarını koru
    for part in (body_text or "").split("\n"):
        if part.strip() == "":
            story.append(Spacer(1, 4))
        else:
            story.append(Paragraph(_escape_xml(part), styles["Body"]))

    doc.build(story)
    return buf.getvalue()


class SessionLogCreate(BaseModel):
    user2_id: int
    session_time_stamp: datetime = Field(default_factory=datetime.utcnow)
    transcript: dict | list | str

class SessionLogOut(BaseModel):
    id: int
    user1_id: int
    user2_id: int
    session_time_stamp: datetime
    transcript: list
    created_at: datetime
    updated_at: datetime
    class Config:
        from_attributes = True

def _check_users(db: Session, user1_id: int, user2_id: int):
    if not db.query(Users).filter(Users.id == user2_id).first():
        raise HTTPException(404, detail="user2 not found")
    if user1_id == user2_id:
        raise HTTPException(400, detail="user1_id and user2_id cannot be same")

@router.post("/", response_model=SessionLogOut)
def create_session_log(
    payload: SessionLogCreate,
    db: Session = Depends(get_db),
    me: dict = Depends(get_current_user_from_cookie),
):
    if not me or not me.get("id"):
        raise HTTPException(401, "Authentication failed")

    user1_id = int(me["id"])
    _check_users(db, user1_id, payload.user2_id)

    encrypted = encrypt_message(payload.transcript)
    row = SessionLog(
        user1_id=user1_id,
        user2_id=payload.user2_id,
        session_time_stamp=payload.session_time_stamp,
        transcript=encrypted,
    )
    db.add(row); db.commit(); db.refresh(row)

    return SessionLogOut(
        id=row.id,
        user1_id=row.user1_id,
        user2_id=row.user2_id,
        session_time_stamp=row.session_time_stamp,
        transcript=decrypt_message(row.transcript),
        created_at=row.created_at,
        updated_at=row.updated_at,
    )

@router.get("/{log_id}", response_model=SessionLogOut)
def get_session_log(
    log_id: int,
    db: Session = Depends(get_db),
    me: dict = Depends(get_current_user_from_cookie),
):
    if not me or not me.get("id"):
        raise HTTPException(401, "Authentication failed")
    row = db.query(SessionLog).filter(SessionLog.id == log_id).first()
    if not row:
        raise HTTPException(404, "Not found")
    if me["id"] not in (row.user1_id, row.user2_id):
        raise HTTPException(403, "Forbidden")

    return SessionLogOut(
        id=row.id,
        user1_id=row.user1_id,
        user2_id=row.user2_id,
        session_time_stamp=row.session_time_stamp,
        transcript=decrypt_message(row.transcript),
        created_at=row.created_at,
        updated_at=row.updated_at,
    )

@router.get("/", response_model=List[SessionLogOut])
def list_session_logs(
    peer_id: Optional[int] = None,
    db: Session = Depends(get_db),
    me: dict = Depends(get_current_user_from_cookie),
):
    if not me or not me.get("id"):
        raise HTTPException(401, "Authentication failed")

    q = db.query(SessionLog).filter(
        (SessionLog.user1_id == me["id"]) | (SessionLog.user2_id == me["id"])
    )
    if peer_id is not None:
        q = q.filter(
            ((SessionLog.user1_id == me["id"]) & (SessionLog.user2_id == peer_id)) |
            ((SessionLog.user2_id == me["id"]) & (SessionLog.user1_id == peer_id))
        )
    rows = q.order_by(SessionLog.session_time_stamp.desc()).all()

    return [
        SessionLogOut(
            id=r.id,
            user1_id=r.user1_id,
            user2_id=r.user2_id,
            session_time_stamp=r.session_time_stamp,
            transcript=decrypt_message(r.transcript),
            created_at=r.created_at,
            updated_at=r.updated_at,
        )
        for r in rows
    ]

@router.delete("/{log_id}", status_code=204)
def delete_session_log(
    log_id: int,
    db: Session = Depends(get_db),
    me: dict = Depends(get_current_user_from_cookie),
):
    if not me or not me.get("id"):
        raise HTTPException(401, "Authentication failed")

    row = db.query(SessionLog).filter(SessionLog.id == log_id).first()
    if not row:
        raise HTTPException(404, "Not found")
    if me["id"] not in (row.user1_id, row.user2_id):
        raise HTTPException(403, "Forbidden")

    db.delete(row)
    db.commit()
    return

@router.post("/{log_id}/summarize")
def summarize_session_log(
    log_id: int,
    lang: str = "tr",
    db: Session = Depends(get_db),
    me: dict = Depends(get_current_user_from_cookie),
):
    row = db.query(SessionLog).filter(SessionLog.id == log_id).first()
    if not row:
        raise HTTPException(404, "Not found")
    if me["id"] not in (row.user1_id, row.user2_id):
        raise HTTPException(403, "Forbidden")

    parts = decrypt_message(row.transcript)
    text = "\n".join(
        p["text"] if isinstance(p, dict) and "text" in p else str(p)
        for p in (parts or [])
    )[:200_000]

    prompt = (
        "Aşağıdaki görüşmenin öz ve maddeli özetini çıkar; kararlar, aksiyonlar ve tarihler. Türkçe yanıtla."
        if lang == "tr"
        else "Summarize the call concisely in bullet points. Extract decisions, action items, and dates. Respond in English."
    )
    resp = client.models.generate_content(model=MODEL, contents=[prompt, text])
    summary = getattr(resp, "text", "") or ""
    return {"summary": summary}

@router.get("/{log_id}/summary-pdf")
def summary_pdf(
    log_id: int,
    lang: str = "tr",
    db: Session = Depends(get_db),
    me: dict = Depends(get_current_user_from_cookie),
):
    """
    Gemini ile özeti üretir ve PDF döndürür.
    """
    row = db.query(SessionLog).filter(SessionLog.id == log_id).first()
    if not row:
        raise HTTPException(404, "Not found")
    if me["id"] not in (row.user1_id, row.user2_id):
        raise HTTPException(403, "Forbidden")

    parts = decrypt_message(row.transcript)
    text = "\n".join(
        p["text"] if isinstance(p, dict) and "text" in p else str(p)
        for p in (parts or [])
    )[:200_000]

    prompt = (
        "Aşağıdaki görüşmenin öz ve maddeli özetini çıkar; kararlar, aksiyonlar ve tarihler. Türkçe yanıtla."
        if lang == "tr"
        else "Summarize the call concisely in bullet points. Extract decisions, action items, and dates. Respond in English."
    )
    resp = client.models.generate_content(model=MODEL, contents=[prompt, text])
    summary = getattr(resp, "text", "") or ""

    title = "Görüşme Özeti" if lang == "tr" else "Session Summary"
    subtitle = [
        f"Log ID: {row.id}",
        f"Tarih: {row.session_time_stamp}",
    ]
    pdf_bytes = summary_text_to_pdf_bytes(title, subtitle, summary)

    filename_utf8 = f"{title} {row.id}.pdf"
    headers = {"Content-Disposition": content_disposition(filename_utf8)}
    return StreamingResponse(io.BytesIO(pdf_bytes), media_type="application/pdf", headers=headers)
