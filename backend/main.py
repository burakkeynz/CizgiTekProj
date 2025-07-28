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

#socketio setup#


sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins=origins)
app = socketio.ASGIApp(sio, other_asgi_app=fastapi_app)

globals_mod.sio = sio
globals_mod.connected_users = {}

#socket events#


@sio.event
async def connect(sid, environ):
    print(f"[Socket][CONNECT] Yeni bağlantı: SID={sid}")
    print("[Socket][CONNECT] globals_mod.connected_users id:", id(globals_mod.connected_users), "content:", globals_mod.connected_users)

@sio.event
async def join(sid, data):
    user_id = data.get("user_id")
    print(f"[Socket][JOIN] user_id={user_id}, sid={sid}")
    print("[Socket][JOIN] globals_mod.connected_users id:", id(globals_mod.connected_users), "content:", globals_mod.connected_users)
    globals_mod.connected_users[user_id] = sid
    print("[Socket][JOIN] GÜNCEL connected_users:", globals_mod.connected_users)

    db = next(get_db())
    user = db.query(Users).filter(Users.id == user_id).first()
    if user:
        user.status = "online"
        db.commit()
        print(f"[Socket][JOIN] Kullanıcı {user_id} -> online yapıldı.")
        await sio.emit("user_status_update", {
            "user_id": user.id,
            "status": "online"
        })

@sio.event
async def typing(sid, data):
    receiver_id = data.get("receiver_id")
    sender_id = data.get("sender_id")
    conversation_id = data.get("conversation_id")
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

    print("[Socket][DISCONNECT] globals_mod.connected_users id:", id(globals_mod.connected_users), "content:", globals_mod.connected_users)
    if disconnected_user_id:
        print(f"[Socket][DISCONNECT] user_id={disconnected_user_id} SID={sid} disconnected.")
        del globals_mod.connected_users[disconnected_user_id]
        print("[Socket][DISCONNECT] GÜNCEL connected_users:", globals_mod.connected_users)

        db = next(get_db())
        user = db.query(Users).filter(Users.id == disconnected_user_id).first()
        if user:
            user.status = "offline"
            db.commit()
            print(f"[Socket][DISCONNECT] Kullanıcı {user.id} -> offline yapıldı.")
            await sio.emit("user_status_update", {
                "user_id": user.id,
                "status": "offline"
            })
    else:
        print(f"[Socket][DISCONNECT] SID={sid} için eşleşen user_id bulunamadı!")

sio_app = app
