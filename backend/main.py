from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os
import socketio

from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from sqlalchemy import or_, and_

from backend.database import engine, get_db
from backend.models import Base, Users, SessionLog, now_tr
from backend.utils.security import encrypt_message, decrypt_message
from datetime import datetime, timezone, timedelta

from backend.routers import (
    auth, users, gemini, chatlogs, patients, upload, files, conversations, sessionlogs
)

import asyncio
import backend.globals as globals_mod
import io, time, wave, re
import webrtcvad
from backend.routers.gemini import upload_and_wait_active, client as gemini_client

load_dotenv()

fastapi_app = FastAPI()

origins_env = os.getenv("CORS_ORIGINS", "")
origins = [origin.strip() for origin in origins_env.split(",") if origin.strip()]

fastapi_app.add_middleware(
    CORSMiddleware,
    allow_origins=origins or ["*"],  # dev için serbest; prod'da whitelist
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

fastapi_app.include_router(auth.router)
fastapi_app.include_router(users.router)
fastapi_app.include_router(gemini.router)
fastapi_app.include_router(chatlogs.router)
fastapi_app.include_router(patients.router)
fastapi_app.include_router(upload.router)
fastapi_app.include_router(files.router)
fastapi_app.include_router(conversations.router)
fastapi_app.include_router(sessionlogs.router)

@fastapi_app.get("/entry")
def entry_point():
    return {"status": "SocketIO entegre FastAPI aktif."}

Base.metadata.create_all(bind=engine)


sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins=origins or "*")
app = socketio.ASGIApp(sio, other_asgi_app=fastapi_app)
sio_app = app

globals_mod.sio = sio
globals_mod.connected_users = {}

SAMPLE_RATE = 16000
FRAME_MS = 20
FRAME_BYTES = int(SAMPLE_RATE * (FRAME_MS / 1000.0) * 2)  # 640 byte @16k/20ms

SILENCE_TAIL_MS = 900
MIN_SEGMENT_MS  = 1200
VAD = webrtcvad.Vad(2)

#Gemini RPM limiter (default 8 rpm; env ile değiştirilebilir)
RATE_LIMIT_RPM = int(os.getenv("GEMINI_RPM", "8"))
_MIN_INTERVAL = 60.0 / max(1, RATE_LIMIT_RPM)
_last_call_ts = 0.0
_rate_lock = asyncio.Lock()

async def _rate_limit_gate():
    """Dakika başına istek için basit kapı."""
    global _last_call_ts
    async with _rate_lock:
        now = time.time()
        wait = max(0.0, _MIN_INTERVAL - (now - _last_call_ts))
        if wait > 0:
            await asyncio.sleep(wait)
        _last_call_ts = time.time()

def _extract_retry_delay_seconds(err) -> float | None:
    """Gemini 429 detayından önerilen bekleme süresini al."""
    try:
        payload = err.args[0]
        details = payload.get("error", {}).get("details", [])
        for it in details:
            if it.get("@type", "").endswith("RetryInfo"):
                s = it.get("retryDelay", "18s")
                return float(s[:-1]) if s.endswith("s") else float(s)
    except Exception:
        pass
    return None

def _sync_call_with_backoff(wav_bytes: bytes, prompt: str):
    """Gemini generate_content için basit backoff stratejisi."""
    delay_default = 10.0
    attempts = 3
    for _ in range(attempts):
        try:
            active_file = upload_and_wait_active(wav_bytes, "audio/wav")
            try:
                resp = gemini_client.models.generate_content(
                    model="gemini-2.5-flash",
                    contents=[prompt, active_file],
                )
                return getattr(resp, "text", "") or ""
            finally:
                try:
                    if getattr(active_file, "name", None):
                        gemini_client.files.delete(name=active_file.name)
                except Exception:
                    pass
        except Exception as e:
            msg = str(e)
            if ("RESOURCE_EXHAUSTED" in msg) or ("429" in msg) or ("Quota" in msg):
                rd = _extract_retry_delay_seconds(e) or delay_default
                time.sleep(rd)
                delay_default = min(delay_default * 2, 60.0)
                continue
            if ("not in an ACTIVE state" in msg) or ("FAILED_PRECONDITION" in msg):
                time.sleep(2.0)
                continue
            raise
    raise RuntimeError("Gemini backoff attempts exhausted")

#Çöp metin filtresi 
_FILLER_WORDS = {
    "uh","uhhuh","umm","hm","hmm","mm","eee","ı","i","hıhı","haha","ha","hahaha"
}
_ALLOW_SHORT = {
    "evet","hayır","hayir","tamam","olur","peki","tabi","teşekkürler","tesekkurler",
    "sağ ol","sag ol","yok","var","merhaba","alo"
}

def _norm_token(w: str) -> str:
    return w.lower().replace("-", "").strip()

def _is_trash_text(s: str) -> bool:
    s = (s or "").strip()
    if not s:
        return True

    # kısa ama anlamlı yanıtları korumak adına 
    norm = re.sub(r"\s+", " ", s.lower())
    if norm in _ALLOW_SHORT:
        return False

    if len(s) < 10:
        return True

    words = re.findall(r"[^\W\d_]+", s, flags=re.UNICODE)
    if len(words) < 3:
        return True

    letters = re.findall(r"[^\W\d_]", s, flags=re.UNICODE)
    if (len(letters) / max(1, len(s))) < 0.6:
        return True

    if all(_norm_token(w) in _FILLER_WORDS for w in words):
        return True

    return False

# PCM akış state
pcm_states = {
    # sid: {...}
}
sid_to_user = {}

def _parse_client_iso(ts: str):
    """'2025-08-10T20:32:16.680Z' -> datetime (tz-aware)"""
    if not ts:
        return now_tr()
    try:
        if ts.endswith("Z"):
            ts = ts[:-1] + "+00:00"
        return datetime.fromisoformat(ts)
    except Exception:
        return now_tr()

def _pcm16_to_wav(pcm: bytes, sr: int = SAMPLE_RATE) -> bytes:
    bio = io.BytesIO()
    with wave.open(bio, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sr)
        wf.writeframes(pcm)
    return bio.getvalue()

async def _transcribe_wav_bytes(
    wav_bytes: bytes,
    prompt: str = "Transcribe the Turkish (and English if any) speech as plain text.",
) -> str:
    await _rate_limit_gate()
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(None, lambda: _sync_call_with_backoff(wav_bytes, prompt))

async def _finalize_segment_and_emit(sid: str):
    st = pcm_states.get(sid)
    if not st or not st["seg_buf"]:
        if st:
            st["voiced"] = False
        return

    # kısa segmentleri atla
    seg_ms = (len(st["seg_buf"]) / FRAME_BYTES) * FRAME_MS
    if seg_ms < MIN_SEGMENT_MS:
        st["voiced"] = False
        return

    raw = bytes(st["seg_buf"])
    st["seg_buf"].clear()
    st["voiced"] = False

    print(f"[PCM][SEGMENT][FINALIZE] sid={sid} bytes={len(raw)}")
    wav_bytes = _pcm16_to_wav(raw, SAMPLE_RATE)
    try:
        text = (await _transcribe_wav_bytes(wav_bytes)).strip()
    except Exception as e:
        print(f"[PCM][SEGMENT][ERR] {e}")
        await sio.emit("transcribe_error", f"{e}", to=sid)
        return

    # Çöpleri at
    if not text or _is_trash_text(text):
        print("[PCM][SEGMENT][DROP] trash/empty segment atıldı.")
        return

    st["segments"].append(text)
    st["n_segments"] += 1
    print(f"[PCM][SEGMENT][TEXT] #{st['n_segments']} len={len(text)}")
    await sio.emit("partial_transcript", {"text": text, "is_final": True}, to=sid)

    peer_sid = None
    if st.get("peer_user_id") is not None:
        peer_sid = globals_mod.connected_users.get(str(st["peer_user_id"]))
    if peer_sid:
        await sio.emit("partial_transcript", {"text": text, "is_final": True}, to=peer_sid)

async def _flush_and_save_sessionlog(sid: str):
    st = pcm_states.get(sid)
    if not st:
        return

    if st["seg_buf"]:
        await _finalize_segment_and_emit(sid)

    items = [{"text": t} for t in st["segments"] if t]
    plain_all = " ".join(x["text"] for x in items).strip()

    print(
        f"[PCM][FLUSH] sid={sid} frames={st.get('n_frames',0)} voiced={st.get('n_voiced',0)} "
        f"segments={st.get('n_segments',0)} transcript_items={len(items)}"
    )

    # Tümü çöp ise kaydetme
    if not items or _is_trash_text(plain_all):
        print("[PCM][FLUSH] tüm segmentler çöp görünüyor; DB kaydı atlandı.")
        pcm_states.pop(sid, None)
        return

    if st.get("user_id") and st.get("peer_user_id"):
        db: Session = next(get_db())
        call_id = st.get("call_id")
        try:
            row = None

            if call_id and hasattr(SessionLog, "call_id"):
                row = db.query(SessionLog).filter(SessionLog.call_id == call_id).first()
                if row:
                    existing = decrypt_message(row.transcript) or []
                    row.transcript = encrypt_message((existing + items)[-500:])  
                    row.updated_at = now_tr()
                else:
                    row = SessionLog(
                        call_id=call_id,
                        user1_id=int(st["user_id"]),
                        user2_id=int(st["peer_user_id"]),
                        session_time_stamp=st.get("session_ts") or now_tr(),
                        transcript=encrypt_message(items),
                    )
                    db.add(row)
            else:
                # call_id yoksa, zaman penceresi + iki yönlü eşleştirme
                approx = st.get("session_ts") or now_tr()
                win_start = approx - timedelta(minutes=10)
                win_end = approx + timedelta(minutes=10)
                row = (
                    db.query(SessionLog)
                    .filter(
                        or_(
                            and_(
                                SessionLog.user1_id == int(st["user_id"]),
                                SessionLog.user2_id == int(st["peer_user_id"]),
                            ),
                            and_(
                                SessionLog.user1_id == int(st["peer_user_id"]),
                                SessionLog.user2_id == int(st["user_id"]),
                            ),
                        ),
                        SessionLog.session_time_stamp >= win_start,
                        SessionLog.session_time_stamp <= win_end,
                    )
                    .order_by(SessionLog.id.desc())
                    .first()
                )
                if row:
                    existing = decrypt_message(row.transcript) or []
                    row.transcript = encrypt_message((existing + items)[-500:])
                    row.updated_at = now_tr()
                else:
                    row = SessionLog(
                        user1_id=int(st["user_id"]),
                        user2_id=int(st["peer_user_id"]),
                        session_time_stamp=approx,
                        transcript=encrypt_message(items),
                    )
                    db.add(row)

            db.commit()
            print(f"[PCM][SAVE] session_logs.id={row.id}")
            try:
                await sio.emit("sessionlog_saved", {"id": row.id}, to=sid)
                peer_sid = globals_mod.connected_users.get(str(st["peer_user_id"]))
                if peer_sid:
                    await sio.emit("sessionlog_saved", {"id": row.id}, to=peer_sid)
            except Exception:
                pass

        except IntegrityError:
            db.rollback()
            if call_id and hasattr(SessionLog, "call_id"):
                row = db.query(SessionLog).filter(SessionLog.call_id == call_id).first()
                if row:
                    existing = decrypt_message(row.transcript) or []
                    row.transcript = encrypt_message((existing + items)[-500:])
                    row.updated_at = now_tr()
                    db.commit()
                    print(f"[PCM][SAVE][MERGED] session_logs.id={row.id} (IntegrityError sonrası)")
        except Exception as e:
            print(f"[PCM][SAVE][ERR] {e}")
            try:
                await sio.emit("transcribe_error", f"SessionLog save error: {e}", to=sid)
            except Exception:
                pass

    pcm_states.pop(sid, None)


# ---------------- Socket.IO events ----------------
@sio.event
async def connect(sid, environ):
    print(f"[Socket][CONNECT] Yeni bağlantı: SID={sid}")
    print("[Socket][CONNECT] globals_mod.connected_users id:", id(globals_mod.connected_users),
          "content:", globals_mod.connected_users)

@sio.event
async def join(sid, data):
    user_id = str(data.get("user_id"))
    globals_mod.connected_users[user_id] = sid
    try:
        sid_to_user[sid] = int(user_id)
    except Exception:
        sid_to_user[sid] = None
    print(f"[Socket][JOIN] user_id={user_id}, sid={sid}")

@sio.event
async def typing(sid, data):
    receiver_id = str(data.get("receiver_id"))
    sender_id = str(data.get("sender_id"))
    conversation_id = str(data.get("conversation_id"))
    receiver_sid = globals_mod.connected_users.get(receiver_id)
    if receiver_sid:
        await sio.emit("typing", {"sender_id": sender_id, "conversation_id": conversation_id}, to=receiver_sid)

@sio.event
async def disconnect(sid):
    disconnected_user_id = None
    for uid, stored_sid in list(globals_mod.connected_users.items()):
        if stored_sid == sid:
            disconnected_user_id = uid
            break
    if disconnected_user_id:
        del globals_mod.connected_users[disconnected_user_id]
        print(f"[Socket][DISCONNECT] user_id={disconnected_user_id} SID={sid} disconnected.")

    try:
        await _flush_and_save_sessionlog(sid)
    finally:
        sid_to_user.pop(sid, None)

@sio.on("webrtc_offer")
async def webrtc_offer(sid, data):
    to_user = str(data.get("to_user_id"))
    to_sid = globals_mod.connected_users.get(to_user)
    if to_sid:
        await sio.emit("webrtc_offer", data, to=to_sid)
    else:
        print(f"[WebRTC][OFFER] Kullanıcı çevrimdışı! {to_user}")

@sio.on("webrtc_answer")
async def webrtc_answer(sid, data):
    to_user = str(data.get("to_user_id"))
    to_sid = globals_mod.connected_users.get(to_user)
    if to_sid:
        await sio.emit("webrtc_answer", data, to=to_sid)
    else:
        print(f"[WebRTC][ANSWER] Kullanıcı çevrimdışı!")

@sio.on("webrtc_ice_candidate")
async def webrtc_ice_candidate(sid, data):
    to_user = str(data.get("to_user_id"))
    to_sid = globals_mod.connected_users.get(to_user)
    if to_sid:
        await sio.emit("webrtc_ice_candidate", data, to=to_sid)
    else:
        print(f"[WebRTC][ICE] Kullanıcı çevrimdışı!")

@sio.on("webrtc_call_end")
async def webrtc_call_end(sid, data):
    to_user = str(data.get("to_user_id"))
    to_sid = globals_mod.connected_users.get(to_user)
    if to_sid:
        await sio.emit("webrtc_call_end", data, to=to_sid)
    else:
        print(f"[WebRTC][CALL END] Kullanıcı çevrimdışı!")
    try:
        await _flush_and_save_sessionlog(sid)
    except Exception:
        pass

@sio.on("user_status")
async def user_status(sid, data):
    user_id = data.get("user_id")
    status = data.get("status")
    if not user_id or not status:
        return
    db = next(get_db())
    user = db.query(Users).filter(Users.id == int(user_id)).first()
    if user:
        user.status = status
        db.commit()
        print(f"[Socket][STATUS] Kullanıcı {user_id} -> {status}")
        await sio.emit("user_status_update", {"user_id": user.id, "status": status})

@sio.on("pcm_begin")
async def pcm_begin(sid, data):
    user_id = data.get("user_id") or sid_to_user.get(sid)
    peer_user_id = data.get("peer_user_id")
    session_ts = _parse_client_iso(data.get("session_time_stamp"))
    pcm_states[sid] = {
        "buf": bytearray(),
        "seg_buf": bytearray(),
        "voiced": False,
        "last_voice": 0.0,
        "user_id": int(user_id) if user_id is not None else None,
        "peer_user_id": int(peer_user_id) if peer_user_id is not None else None,
        "session_ts": session_ts or now_tr(),
        "segments": [],
        "call_id": data.get("call_id"),   # 🔑 istemciden gelen call_id
        "role": data.get("role"),
        "n_frames": 0,
        "n_voiced": 0,
        "n_segments": 0,
    }
    print(f"[PCM][BEGIN] sid={sid} call_id={pcm_states[sid]['call_id']} user={user_id} peer={peer_user_id} ts={session_ts}")

@sio.on("pcm_chunk")
async def pcm_chunk(sid, data):
    st = pcm_states.get(sid)
    if not st:
        return
    chunk = data.get("pcm") if isinstance(data, dict) and "pcm" in data else data
    b = chunk if isinstance(chunk, (bytes, bytearray, memoryview)) else bytes(chunk)
    st["buf"].extend(b)

    while len(st["buf"]) >= FRAME_BYTES:
        frame = st["buf"][:FRAME_BYTES]
        del st["buf"][:FRAME_BYTES]

        st["n_frames"] += 1
        is_speech = VAD.is_speech(frame, SAMPLE_RATE)
        now_ts = time.time()

        if is_speech:
            st["seg_buf"].extend(frame)
            st["voiced"] = True
            st["last_voice"] = now_ts
            st["n_voiced"] += 1
        else:
            if st["voiced"] and (now_ts - st["last_voice"]) * 1000 >= SILENCE_TAIL_MS:
                await _finalize_segment_and_emit(sid)

        if st["n_frames"] % 50 == 0:
            print(
                f"[PCM][CHUNK] sid={sid} frames={st['n_frames']} voiced={st['n_voiced']} open_seg_bytes={len(st['seg_buf'])}"
            )

@sio.on("pcm_end")
async def pcm_end(sid, data=None):
    print(f"[PCM][END] sid={sid}")
    await _flush_and_save_sessionlog(sid)
