# Gerekli modülleri import et
from fastapi import APIRouter, HTTPException, Body
from dotenv import load_dotenv
import os
import anyio
from google import genai
from google.genai import types

# .env dosyasını yükle
load_dotenv()

# API Router oluştur
router = APIRouter(prefix="/gemini", tags=["gemini"])

# API key ve model ismini oku
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
MODEL = "gemini-2.5-flash"  # Web search desteği için önerilen model adı

if not GEMINI_API_KEY:
    raise RuntimeError("Gemini API key not set!")

# Gemini client'ı başlat
client = genai.Client(api_key=GEMINI_API_KEY)

# Chat endpoint'i
@router.post("/chat")
async def gemini_chat(payload: dict = Body(...)):
    # 1. Prompt'ı düzgün şekilde string olarak hazırla
    contents = payload.get("contents", "")
    # Eğer contents array ise, son mesajın texti 
    if isinstance(contents, list) and contents:
        last_msg = contents[-1]
        text = ""
        if "parts" in last_msg and isinstance(last_msg["parts"], list):
            for part in last_msg["parts"]:
                if "text" in part:
                    text = part["text"]
                    break
        else:
            text = last_msg.get("text", "")
    else:
        text = contents

    use_web_search = payload.get("web_search", False)

    try:
        config = None
        if use_web_search:
            grounding_tool = types.Tool(
                google_search=types.GoogleSearch()
            )
            config = types.GenerateContentConfig(
                tools=[grounding_tool]
            )

        def make_request():
            if config:
                return client.models.generate_content(
                    model=MODEL,
                    contents=text,
                    config=config
                )
            else:
                return client.models.generate_content(
                    model=MODEL,
                    contents=text
                )
        response = await anyio.to_thread.run_sync(make_request)
        if hasattr(response, "text") and response.text:
            return {"response": response.text}
        else:
            return {"raw_response": str(response)}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Gemini SDK Hatası: {str(e)}")
