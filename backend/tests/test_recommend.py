"""
Tests for the /recommend endpoint.
"""
from unittest.mock import patch, AsyncMock


class TestRecommend:
    """Tests for the POST /recommend endpoint."""

    def test_recommend_with_full_body(self, client):
        """Full valid request body should return a recommendation."""
        response = client.post(
            "/recommend",
            json={
                "clothing_type": "shirt",
                "occasion": "formal",
                "preferences": "minimalist",
                "colors": ["navy", "white"],
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert len(data["suggestion"]) > 0
        assert data["source"] in ("gemini", "fallback")

    def test_recommend_with_empty_body(self, client):
        """Empty JSON body should still return a default recommendation."""
        response = client.post("/recommend", json={})
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert len(data["suggestion"]) > 0

    def test_recommend_with_no_body(self, client):
        """No request body at all should return a default recommendation."""
        response = client.post(
            "/recommend",
            headers={"Content-Type": "application/json"},
            content="null",
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"

    def test_recommend_with_only_occasion(self, client):
        """Only occasion provided should return occasion-specific fallback."""
        response = client.post("/recommend", json={"occasion": "casual"})
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert data["source"] == "fallback"  # No Gemini key in tests

    def test_recommend_with_only_clothing_type(self, client):
        """Only clothing_type provided should return type-specific recommendation."""
        response = client.post("/recommend", json={"clothing_type": "jacket"})
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert "jacket" in data["suggestion"].lower() or len(data["suggestion"]) > 0

    def test_recommend_fallback_source_without_gemini(self, client):
        """Without Gemini API key, source should be 'fallback'."""
        response = client.post(
            "/recommend",
            json={"occasion": "party"},
        )
        data = response.json()
        assert data["source"] == "fallback"

    def test_recommend_formal_occasion_has_specific_suggestion(self, client):
        """Formal occasion should give occasion-specific fallback."""
        response = client.post("/recommend", json={"occasion": "formal"})
        data = response.json()
        assert "formal" in data["suggestion"].lower() or len(data["suggestion"]) > 20

    @patch("app.services.gemini_service._get_model")
    def test_recommend_with_gemini_mock(self, mock_get_model, client):
        """When Gemini is available, it should use it and return source='gemini'."""
        # Create a mock model that returns a response
        mock_model = mock_get_model.return_value
        mock_response = type("Response", (), {"text": "Try a slim navy blazer with loafers."})()
        mock_model.generate_content.return_value = mock_response

        response = client.post("/recommend", json={"occasion": "formal"})
        data = response.json()
        assert data["status"] == "success"
        assert data["source"] == "gemini"
        assert "blazer" in data["suggestion"].lower()

    @patch("app.services.gemini_service._get_model")
    def test_recommend_gemini_error_falls_back(self, mock_get_model, client):
        """If Gemini raises an error, it should fall back gracefully."""
        mock_model = mock_get_model.return_value
        mock_model.generate_content.side_effect = Exception("API quota exceeded")

        response = client.post("/recommend", json={"occasion": "casual"})
        data = response.json()
        assert data["status"] == "success"
        assert data["source"] == "fallback"
        assert len(data["suggestion"]) > 0
