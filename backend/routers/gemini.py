from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from dotenv import load_dotenv
import os
import anyio
import json
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
async def gemini_chat(
    message: str = Form(...),
    file: UploadFile = File(None),
    web_search: bool = Form(False),
    contents: str = Form(None),
):
    try:
        chat_history = None
        if contents:
            import json
            chat_history = json.loads(contents)

        contents_list = []

        # Metin mesajı
        if message and message.strip():
            user_msg = types.Content(
                role="user",
                parts=[types.Part(text=message)]
            )
            contents_list.append(user_msg)

        # Dosya mesajı (varsa)
        if file:
            file_bytes = await file.read()
            doc_msg = types.Content(
                role="user",
                parts=[
                    types.Part(
                        inline_data=types.Blob(
                            mime_type=file.content_type,
                            data=file_bytes
                        )
                    )
                ]
            )
            contents_list.append(doc_msg)

        config = None
        if web_search:
            grounding_tool = types.Tool(google_search=types.GoogleSearch())
            config = types.GenerateContentConfig(tools=[grounding_tool])

        def make_request():
            if config:
                return client.models.generate_content(
                    model=MODEL,
                    contents=contents_list,
                    config=config
                )
            else:
                return client.models.generate_content(
                    model=MODEL,
                    contents=contents_list
                )
        response = await anyio.to_thread.run_sync(make_request)
        if hasattr(response, "text") and response.text:
            return {
                "response": response.text,
                "history": chat_history
            }
        else:
            return {
                "raw_response": str(response),
                "history": chat_history
            }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Gemini SDK Hatası: {str(e)}")
