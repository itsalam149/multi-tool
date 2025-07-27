from fastapi import FastAPI, HTTPException, UploadFile, File, Request
from fastapi.responses import FileResponse, StreamingResponse, HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
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
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Multi-Service API",
    description="APIs for video download, QR generation, TTS, and background removal",
    version="1.0.0"
)

# -------------------- CONFIGURATION --------------------
# Get environment variables
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")
DEBUG = ENVIRONMENT == "development"
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "").split(",") if os.getenv("CORS_ORIGINS") else []

# Set allowed origins based on environment
if DEBUG:
    allowed_origins = ["*"]  # Allow all for development
else:
    # Production: Use environment variable or common deployment patterns
    allowed_origins = CORS_ORIGINS if CORS_ORIGINS else [
        "https://*.onrender.com",
        "https://*.herokuapp.com",
        "https://*.railway.app",
        "https://*.vercel.app"
    ]

# -------------------- MIDDLEWARE --------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -------------------- STATIC & TEMPLATES --------------------
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

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

# 1. Health check (important for hosting platforms)
@app.get("/health")
async def health_check():
    return {
        "status": "healthy", 
        "version": "1.0.0",
        "environment": ENVIRONMENT,
        "services": ["video-download", "qr-generator", "text-to-speech", "background-remover"]
    }

# 2. Root endpoint
@app.get("/", response_class=HTMLResponse)
async def serve_index(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

# 3. Video download with better error handling
@app.post("/api/download-video")
async def download_video(request: VideoDownloadRequest):
    try:
        logger.info(f"Processing video download for URL: {request.url}")
        
        # Validate URL format
        if not request.url.startswith(('http://', 'https://')):
            raise HTTPException(status_code=400, detail="Invalid URL format")
        
        with tempfile.TemporaryDirectory() as tmpdir:
            ydl_opts = {
                'format': request.quality,
                'outtmpl': os.path.join(tmpdir, '%(title).100s.%(ext)s'),
                'noplaylist': True,
                'no_warnings': True,
                'extractaudio': False,
                'writeinfojson': False,
                'writedescription': False,
                'writesubtitles': False,
                'writeautomaticsub': False,
            }

            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                try:
                    info = ydl.extract_info(request.url, download=True)
                    downloaded_path = ydl.prepare_filename(info)
                    
                    # Check if file exists
                    if not os.path.exists(downloaded_path):
                        raise HTTPException(status_code=404, detail="Downloaded file not found")
                        
                except yt_dlp.utils.DownloadError as e:
                    logger.error(f"yt-dlp download error: {str(e)}")
                    raise HTTPException(status_code=400, detail=f"Failed to download video: {str(e)}")
                except Exception as e:
                    logger.error(f"yt-dlp error: {str(e)}")
                    raise HTTPException(status_code=400, detail=f"Failed to download video: {str(e)}")

            # Create temporary file for response
            temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(downloaded_path)[1])
            temp_file.close()
            shutil.copyfile(downloaded_path, temp_file.name)

        # Clean filename for download
        safe_title = "".join(c for c in info.get('title', 'download')[:50] if c.isalnum() or c in (' ', '-', '_')).rstrip()
        filename = f"{safe_title}.{info.get('ext', 'mp4')}"

        return FileResponse(
            temp_file.name,
            media_type='application/octet-stream',
            filename=filename,
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in video download: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error occurred")

# 4. QR Code generation
@app.post("/api/generate-qr")
async def generate_qr_code(request: QRCodeRequest):
    try:
        logger.info(f"Generating QR code for text length: {len(request.text)}")
        
        if len(request.text) > 2000:
            raise HTTPException(status_code=400, detail="Text too long (max 2000 characters)")
        
        if not request.text.strip():
            raise HTTPException(status_code=400, detail="Text cannot be empty")
        
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_L,
            box_size=max(5, min(20, request.size)),  # Clamp size between 5-20
            border=max(1, min(10, request.border)),   # Clamp border between 1-10
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

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating QR code: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to generate QR code")

# 5. Text to speech
@app.post("/api/text-to-speech")
async def text_to_speech(request: TextToSpeechRequest):
    try:
        logger.info(f"Converting text to speech, length: {len(request.text)}")
        
        if len(request.text) > 5000:
            raise HTTPException(status_code=400, detail="Text too long (max 5000 characters)")
        
        if not request.text.strip():
            raise HTTPException(status_code=400, detail="Text cannot be empty")
        
        # Validate language code
        valid_languages = ['en', 'en-gb', 'es', 'fr', 'de', 'it', 'pt', 'ja', 'ko', 'zh']
        if request.language not in valid_languages:
            logger.warning(f"Invalid language code: {request.language}, using 'en'")
            language = 'en'
        else:
            language = request.language
        
        tts = gTTS(text=request.text, lang=language, slow=request.slow)

        with tempfile.NamedTemporaryFile(delete=False, suffix='.mp3') as tmp_file:
            tts.save(tmp_file.name)
            tmp_file_path = tmp_file.name

        return FileResponse(
            tmp_file_path,
            media_type="audio/mpeg",
            filename="speech.mp3",
            headers={"Content-Disposition": "attachment; filename=speech.mp3"}
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating speech: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to generate speech")

# 6. Background removal
@app.post("/api/remove-background")
async def remove_background(file: UploadFile = File(...)):
    try:
        logger.info(f"Processing background removal for file: {file.filename}")
        
        if not file.content_type or not file.content_type.startswith("image/"):
            raise HTTPException(status_code=400, detail="Only image files are allowed")
        
        # Check file size (10MB limit)
        contents = await file.read()
        if len(contents) > 10 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="File too large (max 10MB)")
        
        # Validate image format
        valid_formats = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/bmp']
        if file.content_type not in valid_formats:
            raise HTTPException(status_code=400, detail="Unsupported image format")
        
        output_data = remove(contents)

        return StreamingResponse(
            io.BytesIO(output_data),
            media_type="image/png",
            headers={"Content-Disposition": "attachment; filename=no_bg_image.png"}
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error removing background: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to remove background")

# Additional utility endpoints
@app.get("/api/supported-sites")
async def get_supported_sites():
    """Return list of supported video sites"""
    try:
        import yt_dlp
        extractor_list = yt_dlp.list_extractors()[:20]  # Return first 20 for brevity
        return {
            "supported_sites": extractor_list,
            "total_supported": len(yt_dlp.list_extractors()),
            "note": "This is a partial list. Most video sites are supported."
        }
    except Exception as e:
        logger.error(f"Error getting supported sites: {str(e)}")
        return {"error": "Unable to fetch supported sites"}

@app.get("/api/languages")
async def get_supported_languages():
    """Return list of supported TTS languages"""
    return {
        "languages": [
            {"code": "en", "name": "English (US)"},
            {"code": "en-gb", "name": "English (UK)"},
            {"code": "es", "name": "Spanish"},
            {"code": "fr", "name": "French"},
            {"code": "de", "name": "German"},
            {"code": "it", "name": "Italian"},
            {"code": "pt", "name": "Portuguese"},
            {"code": "ja", "name": "Japanese"},
            {"code": "ko", "name": "Korean"},
            {"code": "zh", "name": "Chinese"}
        ]
    }

# Error handlers
@app.exception_handler(404)
async def not_found_handler(request: Request, exc):
    return templates.TemplateResponse("index.html", {"request": request}, status_code=404)

@app.exception_handler(413)
async def payload_too_large_handler(request: Request, exc):
    return {"error": "File too large", "max_size": "10MB"}

@app.exception_handler(429)
async def rate_limit_handler(request: Request, exc):
    return {"error": "Rate limit exceeded", "message": "Please wait before making another request"}

# Cleanup function for temporary files
import atexit
import glob

def cleanup_temp_files():
    """Clean up temporary files on app shutdown"""
    try:
        temp_pattern = os.path.join(tempfile.gettempdir(), "tmp*")
        temp_files = glob.glob(temp_pattern)
        for temp_file in temp_files:
            try:
                if os.path.isfile(temp_file):
                    os.unlink(temp_file)
            except:
                pass
        logger.info("Temporary files cleaned up")
    except Exception as e:
        logger.error(f"Error cleaning up temp files: {str(e)}")

atexit.register(cleanup_temp_files)

# -------------------- RUN APPLICATION --------------------
if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 10000))
    host = "0.0.0.0"
    
    logger.info(f"Starting server on {host}:{port}")
    logger.info(f"Environment: {ENVIRONMENT}")
    logger.info(f"Debug mode: {DEBUG}")
    
    uvicorn.run(
        app, 
        host=host, 
        port=port,
        log_level="info" if DEBUG else "warning"
    )