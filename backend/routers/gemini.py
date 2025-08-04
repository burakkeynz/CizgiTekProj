import io, mimetypes, os, json
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Form
from fastapi.responses import StreamingResponse
from google import genai
from google.genai import types
from backend.utils.aws_s3 import read_file_from_s3

router = APIRouter(prefix="/gemini", tags=["gemini"])

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
MODEL = "gemini-2.5-flash"

def s3_key_from_url(url: str) -> str:
    return url.split(".amazonaws.com/", 1)[1]

@router.post("/chat/stream")
async def gemini_chat_stream(
    message: str = Form(...),
    files: Optional[List[str]] = Form(None),
    web_search: bool = Form(False),
    contents: str = Form(None),
):
    try:
        contents_list = []
        if contents:
            try:
                parsed = json.loads(contents)
                for entry in parsed:
                    if entry.get("files"): 
                        for url in entry["files"]:
                            s3_key = s3_key_from_url(url["url"] if isinstance(url, dict) else url)
                            data = read_file_from_s3(s3_key)
                            filename = os.path.basename(s3_key)
                            mime, _ = mimetypes.guess_type(filename)
                            if not mime:
                                mime = "application/octet-stream"
                            file_like = io.BytesIO(data)

                            uploaded = client.files.upload(
                                file=file_like,
                                config=dict(mime_type=mime)
                            )
                            file_data = types.FileData(
                                file_uri=uploaded.uri,
                                mime_type=mime
                            )
                            contents_list.append(
                                types.Content(role="user", parts=[types.Part(file_data=file_data)])
                            )
                    if entry["role"] == "user":
                        contents_list.append(types.Content(role="user", parts=[types.Part(text=entry["text"])]))
                    elif entry["role"] == "model":
                        contents_list.append(types.Content(role="model", parts=[types.Part(text=entry["text"])]))
            except Exception as e:
                print("[WARN] History parse hatası:", e)
        else:
            if message.strip():
                contents_list.append(types.Content(role="user", parts=[types.Part(text=message)]))
        if files:
            if isinstance(files, str): files = [files]
            for url in files:
                s3_key = s3_key_from_url(url)
                data = read_file_from_s3(s3_key)
                filename = os.path.basename(s3_key)
                mime, _ = mimetypes.guess_type(filename)
                if not mime:
                    mime = "application/octet-stream"
                file_like = io.BytesIO(data)

                uploaded = client.files.upload(
                    file=file_like,
                    config=dict(mime_type=mime)
                )
                file_data = types.FileData(
                    file_uri=uploaded.uri,
                    mime_type=mime
                )
                contents_list.append(
                    types.Content(role="user", parts=[types.Part(file_data=file_data)])
                )

        config = None
        if web_search:
            config = types.GenerateContentConfig(tools=[types.Tool(google_search=types.GoogleSearch())])

        def streaming_gen():
            try:
                if config:
                    response = client.models.generate_content_stream(
                        model=MODEL,
                        contents=contents_list,
                        config=config
                    )
                else:
                    response = client.models.generate_content_stream(
                        model=MODEL,
                        contents=contents_list
                    )
                for chunk in response:
                    print(f"[CHUNK] {chunk.text}")
                    if hasattr(chunk, "text") and chunk.text:
                        yield chunk.text
            except Exception as e:
                yield f"\n[ERROR]: {e}"

        return StreamingResponse(streaming_gen(), media_type="text/plain")
    except Exception as e:
        import traceback; traceback.print_exc()
        raise HTTPException(500, detail=f"Gemini Streaming Hatası: {e}")