from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timezone
from sqlalchemy.orm import Session

import io
import os
import re
from urllib.parse import quote

from backend.database import get_db
from backend.models import SessionLog, Users
from backend.routers.auth import get_current_user_from_cookie
from backend.utils.security import encrypt_message, decrypt_message
from backend.routers.prompts import summary_prompt

from google import genai
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
MODEL = "gemini-2.5-flash"

from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

import pytz

router = APIRouter(prefix="/sessionlogs", tags=["sessionlogs"])

TR_TZ = pytz.timezone("Europe/Istanbul")
UTC = pytz.UTC 

def now_tr() -> datetime:
    return datetime.now(TR_TZ)

def as_tr(dt: datetime | None) -> datetime | None:
    """
    Tüm tarihleri Europe/Istanbul'a çevir.
    Not: Naive (tz'siz) datetime gelirse UTC varsay (eski kayıtlar için kritik).
    """
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = UTC.localize(dt)   
    return dt.astimezone(TR_TZ)

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
    return f'attachment; filename="{ascii_name}"; filename*=UTF-8\'\'{quote(filename_utf8)}'

_FONT_CANDIDATES = [
    os.getenv("PDF_FONT_PATH") or "",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
]

def _summary_to_plain(cipher_or_plain: Optional[str], db: Session | None = None, row: SessionLog | None = None) -> str:
    s = (cipher_or_plain or "").strip()
    if not s:
        return ""
    try:
        parts = decrypt_message(s)
        return "\n".join(
            p["text"] if isinstance(p, dict) and "text" in p else str(p)
            for p in (parts or [])
        ).strip()
    except Exception:
        plain = s
        if db is not None and row is not None:
            try:
                row.summary = encrypt_message(plain)
                db.add(row); db.commit()
            except Exception:
                pass
        return plain

def _register_unicode_font() -> str:
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
        leftMargin=18*mm, rightMargin=18*mm, topMargin=16*mm, bottomMargin=18*mm,
        title=title, author="Gemini", subject="Session Summary"
    )
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name="TitleCustom", parent=styles["Title"], fontName=font_name, fontSize=18, leading=22, spaceAfter=6))
    styles.add(ParagraphStyle(name="Subtle", parent=styles["Normal"], fontName=font_name, fontSize=10.5, textColor="#666666", spaceAfter=2))
    styles.add(ParagraphStyle(name="Body", parent=styles["Normal"], fontName=font_name, fontSize=11.5, leading=16))
    story = [Paragraph(_escape_xml(title), styles["TitleCustom"])]
    for line in subtitle_lines:
        story.append(Paragraph(_escape_xml(line), styles["Subtle"]))
    story.append(Spacer(1, 6))
    for part in (body_text or "").split("\n"):
        story.append(Spacer(1, 4) if part.strip()=="" else Paragraph(_escape_xml(part), styles["Body"]))
    doc.build(story)
    return buf.getvalue()

class SessionLogCreate(BaseModel):
    user2_id: int
    # UTC yerine TR default
    session_time_stamp: datetime = Field(default_factory=now_tr)
    transcript: dict | list | str

class SessionLogOut(BaseModel):
    id: int
    user1_id: int
    user2_id: int
    user1_name: Optional[str] = None
    user2_name: Optional[str] = None
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

def _display_name(u: Optional[Users]) -> Optional[str]:
    if not u:
        return None
    fn = (u.first_name or "").strip()
    ln = (u.last_name or "").strip()
    full = (fn + " " + ln).strip()
    return full or (u.username or None)

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

    ts_tr = as_tr(payload.session_time_stamp)

    row = SessionLog(
        user1_id=user1_id,
        user2_id=payload.user2_id,
        session_time_stamp=ts_tr,
        transcript=encrypted,
    )
    db.add(row); db.commit(); db.refresh(row)

    u1 = db.query(Users).filter(Users.id == row.user1_id).first()
    u2 = db.query(Users).filter(Users.id == row.user2_id).first()

    return SessionLogOut(
        id=row.id,
        user1_id=row.user1_id,
        user2_id=row.user2_id,
        user1_name=_display_name(u1),
        user2_name=_display_name(u2),
        session_time_stamp=as_tr(row.session_time_stamp),  # TR
        transcript=decrypt_message(row.transcript),
        created_at=as_tr(row.created_at),                  # TR
        updated_at=as_tr(row.updated_at),                  # TR
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

    u1 = db.query(Users).filter(Users.id == row.user1_id).first()
    u2 = db.query(Users).filter(Users.id == row.user2_id).first()

    return SessionLogOut(
        id=row.id,
        user1_id=row.user1_id,
        user2_id=row.user2_id,
        user1_name=_display_name(u1),
        user2_name=_display_name(u2),
        session_time_stamp=as_tr(row.session_time_stamp),
        transcript=decrypt_message(row.transcript),
        created_at=as_tr(row.created_at),
        updated_at=as_tr(row.updated_at),
    )

@router.get("/", response_model=List[SessionLogOut])
def list_session_logs(
    peer_id: Optional[int] = None,
    all: int = 0,
    db: Session = Depends(get_db),
    me: dict = Depends(get_current_user_from_cookie),
):
    if not me or not me.get("id"):
        raise HTTPException(401, "Authentication failed")

    me_id = int(me["id"])
    q = db.query(SessionLog)
    if not all:
        q = q.filter((SessionLog.user1_id == me_id) | (SessionLog.user2_id == me_id))

    if peer_id is not None:
        q = q.filter(
            ((SessionLog.user1_id == me_id) & (SessionLog.user2_id == peer_id)) |
            ((SessionLog.user2_id == me_id) & (SessionLog.user1_id == peer_id))
        )

    rows = q.order_by(SessionLog.session_time_stamp.desc()).all()

    user_ids = {r.user1_id for r in rows} | {r.user2_id for r in rows}
    users = db.query(Users).filter(Users.id.in_(user_ids or [0])).all()
    umap = {u.id: _display_name(u) for u in users}

    return [
        SessionLogOut(
            id=r.id,
            user1_id=r.user1_id,
            user2_id=r.user2_id,
            user1_name=umap.get(r.user1_id),
            user2_name=umap.get(r.user2_id),
            session_time_stamp=as_tr(r.session_time_stamp),  # TR
            transcript=decrypt_message(r.transcript),
            created_at=as_tr(r.created_at),                  # TR
            updated_at=as_tr(r.updated_at),                  # TR
        ) for r in rows
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
    force: bool = False,
    db: Session = Depends(get_db),
    me: dict = Depends(get_current_user_from_cookie),
):
    row = db.query(SessionLog).filter(SessionLog.id == log_id).first()
    if not row:
        raise HTTPException(404, "Not found")
    if me["id"] not in (row.user1_id, row.user2_id):
        raise HTTPException(403, "Forbidden")

    if not force and (row.summary and row.summary.strip()):
        return {"summary": _summary_to_plain(row.summary, db, row)}

    u1 = db.query(Users).filter(Users.id == row.user1_id).first()
    u2 = db.query(Users).filter(Users.id == row.user2_id).first()
    participants = [
        _display_name(u1) or f"#{row.user1_id}",
        _display_name(u2) or f"#{row.user2_id}",
    ]
    when_str = as_tr(row.session_time_stamp).strftime("%d/%m/%Y %H:%M")  # TR

    parts = decrypt_message(row.transcript)
    text = "\n".join(
        p["text"] if isinstance(p, dict) and "text" in p else str(p)
        for p in (parts or [])
    )[:200_000]

    prompt = summary_prompt(lang, participants, when_str)
    try:
        resp = client.models.generate_content(model=MODEL, contents=[prompt, text])
        summary_plain = getattr(resp, "text", "") or ""
    except Exception as e:
        raise HTTPException(502, f"LLM summarize failed: {e}")

    row.summary = encrypt_message(summary_plain)
    db.add(row); db.commit()

    return {"summary": summary_plain}

@router.get("/{log_id}/summary-pdf")
def summary_pdf(
    log_id: int,
    lang: str = "tr",
    force: bool = False,
    db: Session = Depends(get_db),
    me: dict = Depends(get_current_user_from_cookie),
):
    row = db.query(SessionLog).filter(SessionLog.id == log_id).first()
    if not row:
        raise HTTPException(404, "Not found")
    if me["id"] not in (row.user1_id, row.user2_id):
        raise HTTPException(403, "Forbidden")

    summary_text = _summary_to_plain(row.summary, db, row) if row.summary else ""

    if not summary_text or force:
        u1 = db.query(Users).filter(Users.id == row.user1_id).first()
        u2 = db.query(Users).filter(Users.id == row.user2_id).first()
        participants = [
            _display_name(u1) or f"#{row.user1_id}",
            _display_name(u2) or f"#{row.user2_id}",
        ]
        when_str = as_tr(row.session_time_stamp).strftime("%d/%m/%Y %H:%M")  # TR

        parts = decrypt_message(row.transcript)
        text = "\n".join(
            p["text"] if isinstance(p, dict) and "text" in p else str(p)
            for p in (parts or [])
        )[:200_000]

        prompt = summary_prompt(lang, participants, when_str)
        try:
            resp = client.models.generate_content(model=MODEL, contents=[prompt, text])
            summary_text = getattr(resp, "text", "") or ""
        except Exception as e:
            raise HTTPException(502, f"LLM summarize failed: {e}")

        row.summary = encrypt_message(summary_text)
        db.add(row); db.commit()

    title = "Görüşme Özeti" if lang == "tr" else "Session Summary"
    subtitle = [
        f"Log ID: {row.id}",
        f"Tarih: {as_tr(row.session_time_stamp).strftime('%d/%m/%Y %H:%M')}"
    ]
    pdf_bytes = summary_text_to_pdf_bytes(title, subtitle, summary_text)

    filename_utf8 = f"{title} {row.id}.pdf"
    headers = {"Content-Disposition": content_disposition(filename_utf8)}
    return StreamingResponse(io.BytesIO(pdf_bytes), media_type="application/pdf", headers=headers)
