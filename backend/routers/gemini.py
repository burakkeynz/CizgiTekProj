from fastapi import APIRouter, HTTPException, Body
from dotenv import load_dotenv
import os
import google.generativeai as genai
import google.generativeai.types as types

load_dotenv()

router = APIRouter(prefix="/gemini", tags=["gemini"])

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
MODEL = "gemini-2.5-flash-lite-preview-06-17"

genai.configure(api_key=GEMINI_API_KEY)
model = genai.GenerativeModel(MODEL)

@router.post("/chat")
async def gemini_chat(payload: dict = Body(...)):
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=500, detail="Gemini API key not set")

    contents = payload.get("contents", [])
    use_web_search = payload.get("web_search", False)

    try:
        generation_config = None
        tool_config = None

        if use_web_search:
            grounding_tool = types.Tool(google_search=types.GoogleSearch())
            generation_config = types.GenerateContentConfig(tools=[grounding_tool])
            tool_config = types.tool_config.ToolConfig(
                function_calling_config=types.tool_config.FunctionCallingConfig(
                    mode=types.tool_config.FunctionCallingConfig.Mode.AUTO
                )
            )

        if generation_config:
            response = await model.generate_content_async(
                contents=contents,
                generation_config=generation_config,
                tool_config=tool_config
            )
        else:
            response = await model.generate_content_async(contents=contents)

        if response and hasattr(response, "candidates") and response.candidates:
            return response.to_dict()
        else:
            raise HTTPException(
                status_code=500,
                detail="Gemini modelinden boş veya geçersiz yanıt alındı."
            )
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Gemini SDK Hatası: {str(e)}")
