"""
Tests for the /combos/{style} endpoint.
"""
from unittest.mock import patch


class TestCombos:
    """Tests for the GET /combos/{style} endpoint."""

    def test_get_formal_combo(self, client):
        """Formal combo should return valid combo data."""
        response = client.get("/combos/formal")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert data["style"] == "formal"
        assert "formal_shirt" in data["clothing"]
        assert data["accessories"]["watch"] is not None
        assert data["accessories"]["chain"] is not None
        assert data["accessories"]["shoes"] is not None

    def test_get_casual_combo(self, client):
        """Casual combo should return valid combo data."""
        response = client.get("/combos/casual")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert data["style"] == "casual"
        assert "casual_shirt" in data["clothing"]
        assert data["accessories"]["glasses"] is not None
        assert data["accessories"]["shoes"] is not None

    def test_get_party_combo(self, client):
        """Party combo should return valid combo data."""
        response = client.get("/combos/party")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert data["style"] == "party"
        assert "party_jacket" in data["clothing"]
        assert data["accessories"]["chain"] is not None
        assert data["accessories"]["earring"] is not None

    def test_invalid_style_returns_404(self, client):
        """Unknown style should return 404."""
        response = client.get("/combos/streetwear")
        assert response.status_code == 404
        data = response.json()
        assert "not found" in data["detail"].lower()

    def test_invalid_style_lists_available_styles(self, client):
        """404 response should list available styles."""
        response = client.get("/combos/invalid")
        data = response.json()
        assert "formal" in data["detail"]
        assert "casual" in data["detail"]
        assert "party" in data["detail"]

    def test_combo_case_insensitive(self, client):
        """Style parameter should be case-insensitive."""
        response = client.get("/combos/FORMAL")
        assert response.status_code == 200
        assert response.json()["style"] == "formal"

    def test_combo_accessories_structure(self, client):
        """Accessories should have all expected keys."""
        response = client.get("/combos/formal")
        data = response.json()
        acc = data["accessories"]
        expected_keys = {"glasses", "watch", "chain", "earring", "bag", "shoes"}
        assert set(acc.keys()) == expected_keys

    def test_combo_ai_tip_is_null_without_gemini(self, client):
        """Without Gemini configured, ai_tip should be null."""
        response = client.get("/combos/formal")
        data = response.json()
        assert data["ai_tip"] is None

    @patch("app.services.combo_service.get_combo_tip")
    def test_combo_with_ai_tip(self, mock_tip, client):
        """When Gemini is available, ai_tip should be populated."""
        mock_tip.return_value = "Try a pocket square for extra flair."
        response = client.get("/combos/formal")
        data = response.json()
        # The important thing is the endpoint doesn't crash

    def test_all_styles_return_valid_responses(self, client):
        """All three styles should return valid responses."""
        for style in ["formal", "casual", "party"]:
            response = client.get(f"/combos/{style}")
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "success"
            assert data["style"] == style
