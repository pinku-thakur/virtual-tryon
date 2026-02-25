"""
Application configuration via environment variables.
"""
import os
from pathlib import Path
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings loaded from .env file."""

    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 10000

    # CORS — comma-separated origins, or "*" for all
    CORS_ORIGINS: str = "*"

    # AI Try-On
    USE_MOCK_AI: bool = False
    HF_TOKEN: str = ""  # HuggingFace token for higher ZeroGPU quota

    # Google Gemini
    GEMINI_API_KEY: str = ""

    # Paths
    TEMP_DIR: Path = Path(__file__).parent.parent / "temp"
    STORAGE_DIR: Path = Path(__file__).parent.parent / "storage" / "images"
    DB_PATH: Path = Path(__file__).parent.parent / "storage" / "metadata.db"

    model_config = {
        "env_file": os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"),
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }

    @property
    def cors_origin_list(self) -> list[str]:
        """Parse CORS_ORIGINS string into a list."""
        if self.CORS_ORIGINS.strip() == "*":
            return ["*"]
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


@lru_cache()
def get_settings() -> Settings:
    """Cached settings singleton."""
    return Settings()
