"""
Shared test fixtures and configuration.
"""
import io
import os

import pytest
from fastapi.testclient import TestClient

# Force mock mode and no Gemini key for testing
os.environ["USE_MOCK_AI"] = "True"
os.environ["GEMINI_API_KEY"] = ""

from app.main import app  # noqa: E402


@pytest.fixture
def client():
    """FastAPI test client."""
    return TestClient(app)


@pytest.fixture
def dummy_image_bytes():
    """Generate minimal valid PNG bytes for testing."""
    # Minimal 1x1 red pixel PNG
    from PIL import Image

    img = Image.new("RGB", (10, 10), color="red")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return buf.read()


@pytest.fixture
def dummy_image_file(dummy_image_bytes):
    """Return a tuple (filename, bytes, content_type) for upload."""
    return ("test.png", io.BytesIO(dummy_image_bytes), "image/png")
