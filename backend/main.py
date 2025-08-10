from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os
import socketio

from sqlalchemy.orm import Session
from backend.database import engine, get_db
from backend.models import Base, Users, SessionLog, now_tr
from backend.utils.security import encrypt_message
from datetime import datetime, timezone

from backend.routers import (
    auth,
    users,
    gemini,
    chatlogs,
    patients,
    upload,
    files,
    conversations,
    sessionlogs,
)

import asyncio
import backend.globals as globals_mod
import io, time, wave
import webrtcvad
from backend.routers.gemini import upload_and_wait_active, client as gemini_client

load_dotenv()

fastapi_app = FastAPI()

origins_env = os.getenv("CORS_ORIGINS", "")
origins = [origin.strip() for origin in origins_env.split(",") if origin.strip()]

fastapi_app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,          # prod: whitelist; dev: ["*"] olabilir
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

# Daha az parça => daha az API çağrısı
SILENCE_TAIL_MS = 900     # 300 -> 900
MIN_SEGMENT_MS  = 1200    # 1.2s altını finalize etme

VAD = webrtcvad.Vad(2)  # 0-3 arası 2 dengeli

# ---- Gemini RPM limiter (default 8 rpm, env ile değiştir)
RATE_LIMIT_RPM = int(os.getenv("GEMINI_RPM", "8"))
_MIN_INTERVAL = 60.0 / max(1, RATE_LIMIT_RPM)
_last_call_ts = 0.0
_rate_lock = asyncio.Lock()

async def _rate_limit_gate():
    """Dakikalık istek sınırına uymak için basit kapı."""
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
    """Gemini generate_content için 429/ACTIVE gecikmesi vb. durumlarda backoff'lu çağrı."""
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

pcm_states = {
    # sid: {
    #   "buf": bytearray(),
    #   "seg_buf": bytearray(),
    #   "voiced": bool,
    #   "last_voice": float_epoch,
    #   "user_id": int|None,
    #   "peer_user_id": int|None,
    #   "session_ts": datetime/iso|None,
    #   "segments": [str, ...],
    #   "n_frames": int, "n_voiced": int, "n_segments": int
    # }
}

sid_to_user = {}

def _parse_client_iso(ts: str):
    """'2025-08-10T20:32:16.680Z' -> datetime (tz-aware)"""
    if not ts:
        return now_tr()
    try:
        if ts.endswith("Z"):
            ts = ts[:-1] + "+00:00"
        return datetime.fromisoformat(ts)  # tz-aware
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
    # RPM kapısı
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

    if text:
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

    # açık segmenti kapat
    if st["seg_buf"]:
        await _finalize_segment_and_emit(sid)

    transcript = [{"text": t} for t in st["segments"] if t]

    print(
        f"[PCM][FLUSH] sid={sid} frames={st.get('n_frames',0)} voiced={st.get('n_voiced',0)} "
        f"segments={st.get('n_segments',0)} transcript_items={len(transcript)}"
    )

    if transcript and st.get("user_id") and st.get("peer_user_id"):
        try:
            db: Session = next(get_db())
            row = SessionLog(
                user1_id=int(st["user_id"]),
                user2_id=int(st["peer_user_id"]),
                session_time_stamp=st.get("session_ts") or now_tr(),
                transcript=encrypt_message(transcript),
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
        except Exception as e:
            print(f"[PCM][SAVE][ERR] {e}")
            await sio.emit("transcribe_error", f"SessionLog save error: {e}", to=sid)

    pcm_states.pop(sid, None)

@sio.event
async def connect(sid, environ):
    print(f"[Socket][CONNECT] Yeni bağlantı: SID={sid}")
    print("[Socket][CONNECT] globals_mod.connected_users id:", id(globals_mod.connected_users),
          "content:", globals_mod.connected_users)

@sio.event
async def join(sid, data):
    user_id = str(data.get("user_id"))
    print(f"[Socket][JOIN] user_id={user_id}, sid={sid}")
    globals_mod.connected_users[user_id] = sid
    try:
        sid_to_user[sid] = int(user_id)
    except Exception:
        sid_to_user[sid] = None

@sio.event
async def typing(sid, data):
    receiver_id = str(data.get("receiver_id"))
    sender_id = str(data.get("sender_id"))
    conversation_id = str(data.get("conversation_id"))
    receiver_sid = globals_mod.connected_users.get(receiver_id)

    if receiver_sid:
        await sio.emit("typing",
            {"sender_id": sender_id, "conversation_id": conversation_id},
            to=receiver_sid)
    else:
        print(f"[Socket][TYPING] UYARI: {receiver_id} için SID yok, typing emit olmadı.")

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
    print(f"[WebRTC][ICE] sid={sid} | data={data}")
    to_user = str(data.get("to_user_id"))
    to_sid = globals_mod.connected_users.get(to_user)
    print(f"[WebRTC][ICE] to_user_id={to_user} => to_sid={to_sid}")
    if to_sid:
        await sio.emit("webrtc_ice_candidate", data, to=to_sid)
        print(f"[WebRTC][ICE] EMIT -> {to_sid}")
    else:
        print(f"[WebRTC][ICE] Kullanıcı çevrimdışı!")

@sio.on("webrtc_call_end")
async def webrtc_call_end(sid, data):
    print(f"[WebRTC][CALL END] sid={sid} | data={data}")
    to_user = str(data.get("to_user_id"))
    to_sid = globals_mod.connected_users.get(to_user)
    print(f"[WebRTC][CALL END] to_user_id={to_user} => to_sid={to_sid}")
    if to_sid:
        await sio.emit("webrtc_call_end", data, to=to_sid)
        print(f"[WebRTC][CALL END] EMIT -> {to_sid}")
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
        # DEBUG sayaçları:
        "n_frames": 0,
        "n_voiced": 0,
        "n_segments": 0,
    }
    print(f"[PCM][BEGIN] sid={sid} user={user_id} peer={peer_user_id} ts={session_ts}")

@sio.on("pcm_chunk")
async def pcm_chunk(sid, data):
    st = pcm_states.get(sid)
    if not st:
        return

    chunk = data.get("pcm") if isinstance(data, dict) and "pcm" in data else data
    b = chunk if isinstance(chunk, (bytes, bytearray, memoryview)) else bytes(chunk)

    st["buf"].extend(b)

    # frame'lere böl
    while len(st["buf"]) >= FRAME_BYTES:
        frame = st["buf"][:FRAME_BYTES]
        del st["buf"][:FRAME_BYTES]

        st["n_frames"] += 1
        is_speech = VAD.is_speech(frame, SAMPLE_RATE)
        now = time.time()

        if is_speech:
            st["seg_buf"].extend(frame)
            st["voiced"] = True
            st["last_voice"] = now
            st["n_voiced"] += 1
        else:
            if st["voiced"] and (now - st["last_voice"]) * 1000 >= SILENCE_TAIL_MS:
                await _finalize_segment_and_emit(sid)

        if st["n_frames"] % 50 == 0:
            print(
                f"[PCM][CHUNK] sid={sid} frames={st['n_frames']} voiced={st['n_voiced']} "
                f"open_seg_bytes={len(st['seg_buf'])}"
            )

@sio.on("pcm_end")
async def pcm_end(sid, data=None):
    print(f"[PCM][END] sid={sid}")
    await _flush_and_save_sessionlog(sid)
