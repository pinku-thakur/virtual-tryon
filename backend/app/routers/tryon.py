"""
Try-On router — handles virtual try-on image generation.
"""
import logging

from fastapi import APIRouter, File, Form, UploadFile, HTTPException, Request
from fastapi.responses import JSONResponse

from app.models.schemas import TryOnResponse
from app.services.tryon_service import process_tryon
from app.utils.image_utils import save_upload_to_temp, save_base64_to_storage
from app.utils.hf_errors import HFTokenError
import base64
from app.services.gemini_service import analyze_vto_images

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Try-On"])


@router.post(
    "/try_on",
    response_model=TryOnResponse,
    summary="Generate a virtual try-on image",
    description="Upload a person image and a garment image. Returns a composite image of the person wearing the garment.",
)
async def try_on(
    person_image: UploadFile = File(..., description="Photo of the person"),
    garment_image: UploadFile = File(..., description="Photo of the clothing item"),
    hf_token: str | None = Form(None, description="Optional user-provided HuggingFace token"),
    category: str = Form("upper_body", description="Clothing category: upper_body, lower_body, dresses"),
    request: Request = None,
) -> TryOnResponse | JSONResponse:
    """Process a virtual try-on request."""
    logger.info(f"Try-on request: person={person_image.filename}, garment={garment_image.filename}")

    # Sanitize token — never log it
    if hf_token is not None:
        hf_token = hf_token.strip() or None
        if hf_token:
            logger.info("User-provided HF token received (not logged for security)")

    try:
        # Save uploads to temp directory
        person_path = await save_upload_to_temp(person_image, prefix="person")
        clothing_path = await save_upload_to_temp(garment_image, prefix="garment")

        # Process try-on (mock or real) -> Returns base64 string
        result_data_uri = await process_tryon(person_path, clothing_path, hf_token=hf_token, category=category)

        # Decode base64 and save to persistent storage
        image_url_path = save_base64_to_storage(result_data_uri)

        if request:
            full_url = str(request.base_url).rstrip("/") + image_url_path
        else:
            full_url = image_url_path

        logger.info(f"Try-on completed successfully. Saved to: {image_url_path}")
        return TryOnResponse(status="success", image_url=full_url)

    except HFTokenError as e:
        # Structured error — frontend detects error_code to show token modal
        logger.warning(f"HF token error: {e.user_message}")
        return JSONResponse(
            status_code=200,
            content={
                "status": "error",
                "error_code": e.error_code,
                "message": e.user_message,
            },
        )

    except Exception as e:
        logger.error(f"Try-on failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post(
    "/analyze_vto",
    summary="Analyze VTO images via Gemini",
    description="Analyze the provided person image and garment image using an Expert Computer Vision prompt. Returns a JSON format with VTO metadata.",
)
async def analyze_vto(
    person_image: UploadFile = File(..., description="Photo of the person"),
    garment_image: UploadFile = File(..., description="Photo of the clothing item"),
) -> JSONResponse:
    try:
        p_bytes = await person_image.read()
        g_bytes = await garment_image.read()
        
        p_b64 = base64.b64encode(p_bytes).decode("utf-8")
        g_b64 = base64.b64encode(g_bytes).decode("utf-8")
        
        json_resp_str = await analyze_vto_images(p_b64, g_b64)
        
        import json
        try:
            parsed_json = json.loads(json_resp_str)
            return JSONResponse(status_code=200, content=parsed_json)
        except json.JSONDecodeError:
            # If the LLM failed to output strictly valid JSON, return as text inside a JSON wrapper
            return JSONResponse(status_code=200, content={"status": "success", "raw": json_resp_str})
    except Exception as e:
        logger.error(f"VTO Analysis routing failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

