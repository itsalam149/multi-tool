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
import asyncio
from concurrent.futures import ThreadPoolExecutor
import time

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
# Create directories if they don't exist
os.makedirs("static", exist_ok=True)
os.makedirs("templates", exist_ok=True)

app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

# Thread pool for CPU-intensive operations
executor = ThreadPoolExecutor(max_workers=2)

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

# -------------------- UTILITY FUNCTIONS --------------------
def download_video_sync(url: str, quality: str, tmpdir: str):
    """Synchronous video download function to run in thread pool"""
    try:
        # More conservative yt-dlp options for Render
        ydl_opts = {
            'format': f'{quality}[height<=720]/best[height<=720]/best',  # Limit to 720p max
            'outtmpl': os.path.join(tmpdir, '%(title).50s.%(ext)s'),  # Shorter filename
            'noplaylist': True,
            'no_warnings': True,
            'extractaudio': False,
            'writeinfojson': False,
            'writedescription': False,
            'writesubtitles': False,
            'writeautomaticsub': False,
            'ignoreerrors': False,
            'no_color': True,
            'extract_flat': False,
            'writethumbnail': False,
            'writeinfojson': False,
            # Additional options for stability
            'socket_timeout': 30,
            'retries': 3,
            'fragment_retries': 3,
            'skip_unavailable_fragments': True,
            # Memory and performance optimizations
            'http_chunk_size': 1048576,  # 1MB chunks
            'buffersize': 1048576,
            # Instagram specific options
            'cookiefile': None,
            'nocheckcertificate': True,
        }

        # Add user agent to avoid blocking
        ydl_opts['http_headers'] = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-us,en;q=0.5',
            'Accept-Encoding': 'gzip,deflate',
            'Accept-Charset': 'ISO-8859-1,utf-8;q=0.7,*;q=0.7',
            'Connection': 'keep-alive',
        }

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            # Extract info first
            info = ydl.extract_info(url, download=False)
            
            # Check video duration (limit to 10 minutes for Render)
            duration = info.get('duration', 0)
            if duration and duration > 600:  # 10 minutes
                raise Exception("Video too long (max 10 minutes allowed)")
            
            # Check filesize if available
            filesize = info.get('filesize') or info.get('filesize_approx')
            if filesize and filesize > 100 * 1024 * 1024:  # 100MB limit
                raise Exception("Video file too large (max 100MB)")
            
            # Now download
            info = ydl.extract_info(url, download=True)
            downloaded_path = ydl.prepare_filename(info)
            
            # Verify file exists and has reasonable size
            if not os.path.exists(downloaded_path):
                raise Exception("Downloaded file not found")
            
            file_size = os.path.getsize(downloaded_path)
            if file_size == 0:
                raise Exception("Downloaded file is empty")
            
            if file_size > 100 * 1024 * 1024:  # 100MB limit
                os.remove(downloaded_path)
                raise Exception("Downloaded file too large")
            
            return downloaded_path, info
            
    except yt_dlp.utils.DownloadError as e:
        error_msg = str(e)
        if "Video unavailable" in error_msg:
            raise Exception("Video is unavailable or private")
        elif "Unsupported URL" in error_msg:
            raise Exception("Unsupported video site or URL format")
        elif "Copyright" in error_msg:
            raise Exception("Video is copyrighted and cannot be downloaded")
        else:
            raise Exception(f"Download failed: {error_msg}")
    except Exception as e:
        raise Exception(str(e))

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
    try:
        return templates.TemplateResponse("index.html", {"request": request})
    except Exception:
        # Fallback if template doesn't exist
        return HTMLResponse("""
        <html>
            <head><title>Multi-Service API</title></head>
            <body>
                <h1>Multi-Service API</h1>
                <p>API is running. Available endpoints:</p>
                <ul>
                    <li>/docs - API documentation</li>
                    <li>/api/download-video - Video download</li>
                    <li>/api/generate-qr - QR code generation</li>
                    <li>/api/text-to-speech - Text to speech</li>
                    <li>/api/remove-background - Background removal</li>
                </ul>
            </body>
        </html>
        """)

# 3. Video download with better error handling
@app.post("/api/download-video")
async def download_video(request: VideoDownloadRequest):
    start_time = time.time()
    tmpdir = None
    temp_file_path = None
    
    try:
        logger.info(f"Processing video download for URL: {request.url}")
        
        # Validate URL format
        if not request.url.startswith(('http://', 'https://')):
            raise HTTPException(status_code=400, detail="Invalid URL format")
        
        # Check for common problematic URLs (removed instagram.com to allow downloads)
        blocked_patterns = ['facebook.com', 'tiktok.com']
        if any(pattern in request.url.lower() for pattern in blocked_patterns):
            raise HTTPException(status_code=400, detail="This platform is not supported")
        
        # Create temp directory
        tmpdir = tempfile.mkdtemp(prefix="video_download_")
        
        try:
            # Run download in thread pool to avoid blocking
            loop = asyncio.get_event_loop()
            downloaded_path, info = await loop.run_in_executor(
                executor, 
                download_video_sync, 
                request.url, 
                request.quality, 
                tmpdir
            )
            
            # Check processing time (timeout after 120 seconds)
            if time.time() - start_time > 120:
                raise Exception("Download timeout - video processing took too long")
            
        except Exception as e:
            error_msg = str(e)
            logger.error(f"Download error: {error_msg}")
            
            # Clean error messages for user
            if "timeout" in error_msg.lower():
                raise HTTPException(status_code=408, detail="Download timeout - please try a shorter video")
            elif "too large" in error_msg.lower():
                raise HTTPException(status_code=413, detail="Video file is too large (max 100MB)")
            elif "too long" in error_msg.lower():
                raise HTTPException(status_code=413, detail="Video is too long (max 10 minutes)")
            elif "unavailable" in error_msg.lower():
                raise HTTPException(status_code=404, detail="Video is unavailable or private")
            elif "unsupported" in error_msg.lower():
                raise HTTPException(status_code=400, detail="Unsupported video site or URL format")
            elif "copyright" in error_msg.lower():
                raise HTTPException(status_code=403, detail="Video is copyrighted and cannot be downloaded")
            else:
                raise HTTPException(status_code=400, detail=f"Download failed: {error_msg}")

        # Create temporary file for response outside the tmpdir
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(downloaded_path)[1])
        temp_file.close()
        temp_file_path = temp_file.name
        
        # Copy file
        shutil.copyfile(downloaded_path, temp_file_path)

        # Clean filename for download
        safe_title = "".join(c for c in info.get('title', 'download')[:30] if c.isalnum() or c in (' ', '-', '_')).rstrip()
        if not safe_title:
            safe_title = "download"
        filename = f"{safe_title}.{info.get('ext', 'mp4')}"

        logger.info(f"Download completed in {time.time() - start_time:.2f} seconds")

        # Custom file response that cleans up after sending
        class CleanupFileResponse(FileResponse):
            def __init__(self, *args, cleanup_paths=None, **kwargs):
                super().__init__(*args, **kwargs)
                self.cleanup_paths = cleanup_paths or []
            
            async def __call__(self, scope, receive, send):
                try:
                    await super().__call__(scope, receive, send)
                finally:
                    # Clean up files after response is sent
                    for path in self.cleanup_paths:
                        try:
                            if os.path.exists(path):
                                if os.path.isfile(path):
                                    os.unlink(path)
                                elif os.path.isdir(path):
                                    shutil.rmtree(path)
                        except Exception as e:
                            logger.warning(f"Failed to cleanup {path}: {e}")

        return CleanupFileResponse(
            temp_file_path,
            media_type='application/octet-stream',
            filename=filename,
            headers={"Content-Disposition": f"attachment; filename=\"{filename}\""},
            cleanup_paths=[temp_file_path, tmpdir]
        )

    except HTTPException:
        # Clean up on error
        if temp_file_path and os.path.exists(temp_file_path):
            try:
                os.unlink(temp_file_path)
            except:
                pass
        if tmpdir and os.path.exists(tmpdir):
            try:
                shutil.rmtree(tmpdir)
            except:
                pass
        raise
    except Exception as e:
        # Clean up on error
        if temp_file_path and os.path.exists(temp_file_path):
            try:
                os.unlink(temp_file_path)
            except:
                pass
        if tmpdir and os.path.exists(tmpdir):
            try:
                shutil.rmtree(tmpdir)
            except:
                pass
        logger.error(f"Unexpected error in video download: {str(e)}")
        raise HTTPException(status_code=500, detail="An unexpected error occurred")

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
    temp_file_path = None
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

        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.mp3')
        temp_file.close()
        temp_file_path = temp_file.name
        
        tts.save(temp_file_path)

        # Custom file response that cleans up after sending
        class CleanupFileResponse(FileResponse):
            def __init__(self, *args, cleanup_path=None, **kwargs):
                super().__init__(*args, **kwargs)
                self.cleanup_path = cleanup_path
            
            async def __call__(self, scope, receive, send):
                try:
                    await super().__call__(scope, receive, send)
                finally:
                    # Clean up file after response is sent
                    if self.cleanup_path and os.path.exists(self.cleanup_path):
                        try:
                            os.unlink(self.cleanup_path)
                        except Exception as e:
                            logger.warning(f"Failed to cleanup {self.cleanup_path}: {e}")

        return CleanupFileResponse(
            temp_file_path,
            media_type="audio/mpeg",
            filename="speech.mp3",
            headers={"Content-Disposition": "attachment; filename=speech.mp3"},
            cleanup_path=temp_file_path
        )

    except HTTPException:
        if temp_file_path and os.path.exists(temp_file_path):
            try:
                os.unlink(temp_file_path)
            except:
                pass
        raise
    except Exception as e:
        if temp_file_path and os.path.exists(temp_file_path):
            try:
                os.unlink(temp_file_path)
            except:
                pass
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
        
        # Run background removal in thread pool
        loop = asyncio.get_event_loop()
        output_data = await loop.run_in_executor(executor, remove, contents)

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
        # Popular sites that work reliably
        popular_sites = [
            "YouTube", "Vimeo", "Dailymotion", "Twitter", "Reddit", "Instagram",
            "Streamable", "Twitch Clips", "SoundCloud", "Bandcamp"
        ]
        return {
            "popular_sites": popular_sites,
            "note": "Many video sites are supported. Some platforms like Facebook and TikTok may have restrictions."
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
    try:
        return templates.TemplateResponse("index.html", {"request": request}, status_code=404)
    except:
        return {"error": "Not found", "status_code": 404}

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
        cleaned = 0
        for temp_file in temp_files:
            try:
                if os.path.isfile(temp_file):
                    # Only clean files older than 1 hour
                    if time.time() - os.path.getmtime(temp_file) > 3600:
                        os.unlink(temp_file)
                        cleaned += 1
                elif os.path.isdir(temp_file) and "video_download_" in temp_file:
                    shutil.rmtree(temp_file)
                    cleaned += 1
            except:
                pass
        if cleaned > 0:
            logger.info(f"Cleaned up {cleaned} temporary files")
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
        log_level="info" if DEBUG else "warning",
        timeout_keep_alive=65,
        timeout_graceful_shutdown=30
    )