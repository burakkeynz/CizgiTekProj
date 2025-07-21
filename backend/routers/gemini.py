from fastapi import APIRouter, HTTPException, Body
from dotenv import load_dotenv
import os
import anyio
from google import genai
from google.genai import types

load_dotenv()

router = APIRouter(prefix="/gemini", tags=["gemini"])

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
MODEL = "gemini-2.5-flash"

if not GEMINI_API_KEY:
    raise RuntimeError("Gemini API key not set!")

client = genai.Client(api_key=GEMINI_API_KEY)

@router.post("/chat")
async def gemini_chat(payload: dict = Body(...)):
    contents = payload.get("contents", "")

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
                    contents=contents,
                    config=config
                )
            else:
                return client.models.generate_content(
                    model=MODEL,
                    contents=contents 
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
