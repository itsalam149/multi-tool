from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from gtts import gTTS
from rembg import remove
import tempfile
import yt_dlp
import qrcode
import os
import io
import shutil

app = FastAPI(
    title="Multi-Service API",
    description="APIs for video download, QR generation, TTS, and background removal"
)

# CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -------------------- MODELS --------------------
class VideoDownloadRequest(BaseModel):
    url: str
    quality: Optional[str] = "best"

class QRCodeRequest(BaseModel):
    text: str
    size: Optional[int] = 10
    border: Optional[int] = 4

class TextToSpeechRequest(BaseModel):
    text: str
    language: Optional[str] = "en"
    slow: Optional[bool] = False

# -------------------- ENDPOINTS --------------------

# 1. VIDEO DOWNLOAD
@app.post("/api/download-video")
async def download_video(request: VideoDownloadRequest):
    try:
        with tempfile.TemporaryDirectory() as tmpdir:
            ydl_opts = {
                'format': request.quality,
                'outtmpl': os.path.join(tmpdir, '%(title).100s.%(ext)s'),
                'noplaylist': True,
            }

            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(request.url, download=True)
                downloaded_path = ydl.prepare_filename(info)

            temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(downloaded_path)[1])
            temp_file.close()
            shutil.copyfile(downloaded_path, temp_file.name)

        return FileResponse(
            temp_file.name,
            media_type='application/octet-stream',
            filename=os.path.basename(temp_file.name),
            headers={"Content-Disposition": f"attachment; filename={os.path.basename(temp_file.name)}"}
        )

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error downloading video: {str(e)}")


# 2. GENERATE QR CODE
@app.post("/api/generate-qr")
async def generate_qr_code(request: QRCodeRequest):
    try:
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_L,
            box_size=request.size,
            border=request.border,
        )
        qr.add_data(request.text)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white")

        img_buffer = io.BytesIO()
        img.save(img_buffer, format='PNG')
        img_buffer.seek(0)

        return StreamingResponse(
            img_buffer,
            media_type="image/png",
            headers={"Content-Disposition": "attachment; filename=qrcode.png"}
        )

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error generating QR code: {str(e)}")

# 3. TEXT TO SPEECH
@app.post("/api/text-to-speech")
async def text_to_speech(request: TextToSpeechRequest):
    try:
        tts = gTTS(text=request.text, lang=request.language, slow=request.slow)

        with tempfile.NamedTemporaryFile(delete=False, suffix='.mp3') as tmp_file:
            tts.save(tmp_file.name)
            tmp_file_path = tmp_file.name

        return FileResponse(
            tmp_file_path,
            media_type="audio/mpeg",
            filename="speech.mp3",
            headers={"Content-Disposition": "attachment; filename=speech.mp3"}
        )

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error generating speech: {str(e)}")

# 4. REMOVE BACKGROUND FROM IMAGE
@app.post("/api/remove-background")
async def remove_background(file: UploadFile = File(...)):
    try:
        if not file.content_type.startswith("image/"):
            raise HTTPException(status_code=400, detail="Only image files are allowed")

        image_data = await file.read()
        output_data = remove(image_data)

        return StreamingResponse(
            io.BytesIO(output_data),
            media_type="image/png",
            headers={"Content-Disposition": "attachment; filename=no_bg_image.png"}
        )

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error removing background: {str(e)}")

# 5. HEALTH CHECKS
@app.get("/")
async def root():
    return {
        "message": "Multi-Service API is running!",
        "services": [
            "Video Download: POST /api/download-video",
            "QR Code Generation: POST /api/generate-qr",
            "Text to Speech: POST /api/text-to-speech",
            "Background Removal: POST /api/remove-background"
        ]
    }

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

# -------------------- MAIN --------------------
if __name__ == "__main__":
    import uvicorn
    import os

    port = int(os.environ.get("PORT", 10000))  # Use Render's dynamic port or default to 10000 locally
    uvicorn.run(app, host="0.0.0.0", port=port)
