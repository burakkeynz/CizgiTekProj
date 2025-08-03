from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.routers import auth, users, gemini, chatlogs, patients, upload, files, conversations
from backend.models import Base, Users
from backend.database import engine, get_db
from dotenv import load_dotenv
import os
import socketio
import backend.globals as globals_mod

load_dotenv()
fastapi_app = FastAPI()

origins_env = os.getenv("CORS_ORIGINS", "")
origins = [origin.strip() for origin in origins_env.split(",") if origin.strip()]

fastapi_app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
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

@fastapi_app.get("/entry")
def entry_point():
    return {"status": "SocketIO entegre FastAPI aktif."}

Base.metadata.create_all(bind=engine)


sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins=origins)
app = socketio.ASGIApp(sio, other_asgi_app=fastapi_app)

globals_mod.sio = sio
globals_mod.connected_users = {}

# # Debug için
# @sio.on("*")
# async def catch_all(event, sid, data):
#     print(f"[SOCKET][CATCH-ALL] event={event} sid={sid} data={data}")

@sio.event
async def connect(sid, environ):
    print(f"[Socket][CONNECT] Yeni bağlantı: SID={sid}")
    print("[Socket][CONNECT] globals_mod.connected_users id:", id(globals_mod.connected_users), "content:", globals_mod.connected_users)

@sio.event
async def join(sid, data):
    user_id = str(data.get("user_id"))
    print(f"[Socket][JOIN] user_id={user_id}, sid={sid}")
    globals_mod.connected_users[user_id] = sid

@sio.event
async def typing(sid, data):
    receiver_id = str(data.get("receiver_id"))
    sender_id =str(data.get("sender_id"))
    conversation_id = str(data.get("conversation_id"))
    print("[Socket][TYPING] globals_mod.connected_users id:", id(globals_mod.connected_users), "content:", globals_mod.connected_users)
    receiver_sid = globals_mod.connected_users.get(receiver_id)
    print(f"[Socket][TYPING] {sender_id=} -> {receiver_id=}, {receiver_sid=}")
    if receiver_sid:
        await sio.emit(
            "typing",
            {
                "sender_id": sender_id,
                "conversation_id": conversation_id
            },
            to=receiver_sid
        )
    else:
        print(f"[Socket][TYPING] UYARI: {receiver_id} için SID yok, typing emit olmadı.")

@sio.event
async def disconnect(sid):
    disconnected_user_id = None
    for uid, stored_sid in globals_mod.connected_users.items():
        if stored_sid == sid:
            disconnected_user_id = uid
            break
    if disconnected_user_id:
        del globals_mod.connected_users[disconnected_user_id]
        print(f"[Socket][DISCONNECT] user_id={disconnected_user_id} SID={sid} disconnected.")

# WebRTC Signaling Events 
@sio.on("webrtc_offer")
async def webrtc_offer(sid, data):
    print(f"[BACKEND][OFFER] GELDİ! sid={sid} | data={data}")
    print(f"[BACKEND][OFFER] connected_users: {globals_mod.connected_users}")
    to_user = str(data["to_user_id"])
    to_sid = globals_mod.connected_users.get(str(data["to_user_id"]))
    print(f"[BACKEND][OFFER] to_user_id={to_user} => to_sid={to_sid}")
    if to_sid:
        print(f"[BACKEND][OFFER] EMIT EDİLİYOR -> {to_user} ({to_sid})")
        await sio.emit("webrtc_offer", data, to=to_sid)
    else:
        print(f"[BACKEND][OFFER] Kullanıcı çevrimdışı! {to_user}")

@sio.on("webrtc_answer")
async def webrtc_answer(sid, data):
    print(f"[WebRTC][ANSWER] GELDİ! sid={sid} | data={data}")
    to_sid = globals_mod.connected_users.get(str(data["to_user_id"]))
    print(f"[WebRTC][ANSWER] to_user_id={data['to_user_id']} => to_sid={to_sid}")
    if to_sid:
        await sio.emit("webrtc_answer", data, to=to_sid)
        print(f"[WebRTC][ANSWER] EMIT EDİLDİ -> {to_sid}")
    else:
        print(f"[WebRTC][ANSWER] Kullanıcı çevrimdışı!")

@sio.on("webrtc_ice_candidate")
async def webrtc_ice_candidate(sid, data):
    print(f"[WebRTC][ICE] GELDİ! sid={sid} | data={data}")
    to_sid = globals_mod.connected_users.get(str(data["to_user_id"]))
    print(f"[WebRTC][ICE] to_user_id={data['to_user_id']} => to_sid={to_sid}")
    if to_sid:
        await sio.emit("webrtc_ice_candidate", data, to=to_sid)
        print(f"[WebRTC][ICE] EMIT EDİLDİ -> {to_sid}")
    else:
        print(f"[WebRTC][ICE] Kullanıcı çevrimdışı!")

@sio.on("webrtc_call_end")
async def webrtc_call_end(sid, data):
    print(f"[WebRTC][CALL END] GELDİ! sid={sid} | data={data}")
    to_sid = globals_mod.connected_users.get(str(data["to_user_id"]))
    print(f"[WebRTC][CALL END] to_user_id={data['to_user_id']} => to_sid={to_sid}")
    if to_sid:
        await sio.emit("webrtc_call_end", data, to=to_sid)
        print(f"[WebRTC][CALL END] EMIT EDİLDİ -> {to_sid}")
    else:
        print(f"[WebRTC][CALL END] Kullanıcı çevrimdışı!")
        
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
        print(f"[Socket][STATUS] Kullanıcı {user_id} -> {status} yapıldı.")
        await sio.emit("user_status_update", {
            "user_id": user.id,
            "status": status
        })

sio_app = app