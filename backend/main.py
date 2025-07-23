from fastapi import FastAPI
from backend.routers import auth, users, gemini, chatlogs, patients, upload, files
from backend.models import Base
from fastapi.middleware.cors import CORSMiddleware
from backend.database import engine
import os
from dotenv import load_dotenv

load_dotenv()
app = FastAPI()

origins = os.getenv("CORS_ORIGINS", "").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get('/entry')
def enrtry_point():
  return {'entry_point': 'Health check'}


Base.metadata.create_all(bind=engine)
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(gemini.router)
app.include_router(chatlogs.router)
app.include_router(patients.router)
app.include_router(upload.router)
app.include_router(files.router)