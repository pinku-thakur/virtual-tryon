"""
SQLite database for storing image metadata.
"""
import sqlite3
import datetime
from pathlib import Path

from app.config import get_settings


def get_db_connection() -> sqlite3.Connection:
    """Get a connection to the SQLite database."""
    settings = get_settings()
    # Ensure parent directory exists
    settings.DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    
    conn = sqlite3.connect(settings.DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Initialize the database tables."""
    conn = get_db_connection()
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS images (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            filename TEXT UNIQUE NOT NULL,
            url TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.commit()
    conn.close()


def save_image_metadata(filename: str, url: str) -> int:
    """Save image metadata and return the new ID."""
    conn = get_db_connection()
    c = conn.cursor()
    try:
        c.execute(
            'INSERT INTO images (filename, url) VALUES (?, ?)',
            (filename, url)
        )
        conn.commit()
        return c.lastrowid
    finally:
        conn.close()
