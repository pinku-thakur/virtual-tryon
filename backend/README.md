# AI Virtual Try-On — Backend

FastAPI backend for the AI Virtual Try-On application.

## Quick Setup

```bash
# 1. Install dependencies
cd backend
pip install -r requirements.txt

# 2. Configure environment
cp .env.example .env
# Edit .env — add your GEMINI_API_KEY for AI recommendations (optional)

# 3. Run the server
python -m app.main
```

Server starts at **http://127.0.0.1:8001** — open the frontend `login.html` in your browser and paste this URL in the "Backend Config" box.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | Health check |
| `POST` | `/try_on` | Virtual try-on (upload person + garment images) |
| `POST` | `/recommend` | AI style recommendation (JSON body) |
| `GET` | `/combos/{style}` | Get combo data (`formal`, `casual`, `party`) |

Interactive docs at: **http://127.0.0.1:8001/docs**

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `HOST` | `127.0.0.1` | Server bind address |
| `PORT` | `8001` | Server port |
| `CORS_ORIGINS` | `*` | Allowed CORS origins |
| `USE_MOCK_AI` | `True` | Mock mode (no GPU needed) |
| `GEMINI_API_KEY` | _(empty)_ | Google Gemini API key for AI features |

## Running Tests

```bash
cd backend
pytest tests/ -v
```

