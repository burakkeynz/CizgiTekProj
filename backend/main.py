from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.routers import auth, users, gemini, chatlogs, patients, upload, files, conversations
from backend.models import Base, Users
from backend.database import engine, get_db
from dotenv import load_dotenv
import os

# SocketIO
import socketio
from backend.globals import sio as global_sio, connected_users as global_connected_users

load_dotenv()

fastapi_app = FastAPI()

origins = os.getenv("CORS_ORIGINS", "").split(",") if os.getenv("CORS_ORIGINS") else ["*"]

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
    return {"entry_point": "Health check"}

Base.metadata.create_all(bind=engine)

# --- SocketIO global olarak bağla ---
sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins=origins)
app = socketio.ASGIApp(sio, other_asgi_app=fastapi_app)

# global referanslara ata!
import backend.globals as globals_mod
globals_mod.sio = sio
globals_mod.connected_users = {}

# --- SocketIO EVENTS ---
@sio.event
async def connect(sid, environ):
    print("🔌 Bağlantı kuruldu:", sid)

@sio.event
async def join(sid, data):
    print(f"JOIN: user_id={data.get('user_id')}, sid={sid}")
    user_id = data.get("user_id")
    print(f"JOIN: user_id={user_id}, sid={sid}")
    globals_mod.connected_users[user_id] = sid
    print(f"User {user_id} joined (sid={sid})")

    db = next(get_db())
    user = db.query(Users).filter(Users.id == user_id).first()
    if user:
        user.status = "online"
        db.commit()
        await sio.emit("user_status_update", {
            "user_id": user.id,
            "status": user.status,
        })

@sio.event
async def message(sid, data):
    print("MESSAGE EVENT:", data)
    from backend.utils.chat import create_message
    db = next(get_db())
    sender_id = data.get("sender_id")
    receiver_id = data.get("receiver_id")
    content = data.get("content")
    conversation_id = data.get("conversation_id")

    # Mesajı dbye kaydet
    message = create_message(sender_id, receiver_id, content, db, conversation_id)

    # Gönderen ve alıcıya anlık mesaj ilet
    for target_id in [receiver_id, sender_id]:
        target_sid = globals_mod.connected_users.get(target_id)
        print(f"Emit to user_id={target_id}, sid={target_sid}")
        if target_sid:
            await sio.emit("receive_message", {
                "conversation_id": message.conversation_id,
                "sender_id": sender_id,
                "content": content,
                "timestamp": message.timestamp.isoformat()
            }, to=target_sid)
    print("EMIT to:", [receiver_sid, sender_sid])

@sio.event
async def typing(sid, data):
    receiver_id = data.get("receiver_id")
    sender_id = data.get("sender_id")
    receiver_sid = globals_mod.connected_users.get(receiver_id)
    if receiver_sid:
        await sio.emit("typing", {
            "sender_id": sender_id
        }, to=receiver_sid)

@sio.event
async def disconnect(sid):
    disconnected_user = None
    for user_id, s in globals_mod.connected_users.items():
        if s == sid:
            disconnected_user = user_id
            break
    if disconnected_user:
        del globals_mod.connected_users[disconnected_user]
        print(f"User {disconnected_user} disconnected (sid={sid})")

        db = next(get_db())
        user = db.query(Users).filter(Users.id == disconnected_user).first()
        if user:
            user.status = "offline"
            db.commit()
            await sio.emit("user_status_update", {
                "user_id": user.id,
                "status": user.status,
            })
