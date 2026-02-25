"""
Image utility helpers for file I/O and base64 encoding.
"""
import base64
import shutil
import uuid
from pathlib import Path

from fastapi import UploadFile

from app.config import get_settings


async def save_upload_to_temp(upload: UploadFile, prefix: str = "") -> Path:
    """
    Save an uploaded file to the temp directory and return its path.
    """
    settings = get_settings()
    settings.TEMP_DIR.mkdir(parents=True, exist_ok=True)

    ext = Path(upload.filename or "image.png").suffix or ".png"
    file_id = uuid.uuid4().hex[:12]
    filename = f"{prefix}_{file_id}{ext}" if prefix else f"{file_id}{ext}"
    dest = settings.TEMP_DIR / filename

    with open(dest, "wb") as f:
        shutil.copyfileobj(upload.file, f)

    return dest


def file_to_base64_data_uri(file_path: str | Path, mime_type: str = "image/png") -> str:
    """
    Read a file and return a base64-encoded data URI string.
    """
    with open(file_path, "rb") as f:
        img_data = f.read()
    b64 = base64.b64encode(img_data).decode("utf-8")
    return f"data:{mime_type};base64,{b64}"


def bytes_to_base64_data_uri(data: bytes, mime_type: str = "image/png") -> str:
    """
    Convert raw bytes to a base64-encoded data URI string.
    """
    b64 = base64.b64encode(data).decode("utf-8")
    return f"data:{mime_type};base64,{b64}"


def save_base64_to_storage(base64_str: str) -> str:
    """
    Decode a base64 string, save it to storage, record in DB, and return the URL path.
    Example return: "/images/ab12cd34.png"
    """
    if "," in base64_str:
        header, encoded = base64_str.split(",", 1)
        # extracting extension from header "data:image/png;base64"
        ext = ".png"
        if "image/jpeg" in header:
            ext = ".jpg"
        elif "image/webp" in header:
            ext = ".webp"
    else:
        encoded = base64_str
        ext = ".png"

    data = base64.b64decode(encoded)
    return _save_bytes_to_storage(data, ext)


def save_image_to_storage(file_path: Path) -> str:
    """
    Read an image file from disk, save it to persistent storage, record in DB, and return URL.
    """
    with open(file_path, "rb") as f:
        data = f.read()
    ext = file_path.suffix or ".png"
    return _save_bytes_to_storage(data, ext)


def _save_bytes_to_storage(data: bytes, ext: str) -> str:
    from app.database import save_image_metadata

    settings = get_settings()
    settings.STORAGE_DIR.mkdir(parents=True, exist_ok=True)

    file_id = uuid.uuid4().hex
    filename = f"{file_id}{ext}"
    dest = settings.STORAGE_DIR / filename

    with open(dest, "wb") as f:
        f.write(data)

    # Relative URL path that will be served by StaticFiles
    url_path = f"/images/{filename}"

    # Save to SQLite
    save_image_metadata(filename, url_path)

    return url_path
