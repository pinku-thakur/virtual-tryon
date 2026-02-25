"""
Tests for the /try_on endpoint and health check.
"""
import io

import pytest


class TestHealthCheck:
    """Tests for the GET / health check endpoint."""

    def test_health_check_returns_200(self, client):
        response = client.get("/")
        assert response.status_code == 200

    def test_health_check_contains_status(self, client):
        data = client.get("/").json()
        assert data["status"] == "Online"
        assert "service" in data
        assert "version" in data

    def test_health_check_shows_mock_mode(self, client):
        data = client.get("/").json()
        assert data["mock_mode"] is True

    def test_health_check_shows_gemini_not_configured(self, client):
        data = client.get("/").json()
        assert data["gemini_configured"] is False


class TestTryOn:
    """Tests for the POST /try_on endpoint."""

    def test_try_on_success_with_valid_images(self, client, dummy_image_bytes):
        """Valid request should return status='success' and an image URL."""
        response = client.post(
            "/try_on",
            files={
                "person_image": ("person.png", io.BytesIO(dummy_image_bytes), "image/png"),
                "garment_image": ("garment.png", io.BytesIO(dummy_image_bytes), "image/png"),
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert "image_url" in data
        assert data["image_url"].startswith("http") or data["image_url"].startswith("/images/")

    def test_try_on_returns_accessible_url(self, client, dummy_image_bytes):
        """Result image URL should be accessible."""
        response = client.post(
            "/try_on",
            files={
                "person_image": ("person.png", io.BytesIO(dummy_image_bytes), "image/png"),
                "garment_image": ("garment.png", io.BytesIO(dummy_image_bytes), "image/png"),
            },
        )
        data = response.json()
        image_url = data["image_url"]
        
        # If it's a full URL, we need to extract the path to test with client.get
        # Example: http://testserver/images/xyz.png -> /images/xyz.png
        if "://" in image_url:
            from urllib.parse import urlparse
            path = urlparse(image_url).path
        else:
            path = image_url
            
        # Verify we can fetch the image
        img_response = client.get(path)
        assert img_response.status_code == 200
        assert img_response.headers["content-type"] in ["image/png", "image/jpeg", "image/webp"]

    def test_try_on_missing_person_image(self, client, dummy_image_bytes):
        """Missing person_image should return 422 validation error."""
        response = client.post(
            "/try_on",
            files={
                "garment_image": ("garment.png", io.BytesIO(dummy_image_bytes), "image/png"),
            },
        )
        assert response.status_code == 422

    def test_try_on_missing_garment_image(self, client, dummy_image_bytes):
        """Missing garment_image should return 422 validation error."""
        response = client.post(
            "/try_on",
            files={
                "person_image": ("person.png", io.BytesIO(dummy_image_bytes), "image/png"),
            },
        )
        assert response.status_code == 422

    def test_try_on_missing_both_images(self, client):
        """Missing both images should return 422."""
        response = client.post("/try_on")
        assert response.status_code == 422

    def test_try_on_with_jpeg_images(self, client):
        """Should work with JPEG files too."""
        from PIL import Image

        buf = io.BytesIO()
        Image.new("RGB", (10, 10), color="blue").save(buf, format="JPEG")
        jpeg_bytes = buf.getvalue()

        response = client.post(
            "/try_on",
            files={
                "person_image": ("person.jpg", io.BytesIO(jpeg_bytes), "image/jpeg"),
                "garment_image": ("garment.jpg", io.BytesIO(jpeg_bytes), "image/jpeg"),
            },
        )
        assert response.status_code == 200
        assert response.json()["status"] == "success"
