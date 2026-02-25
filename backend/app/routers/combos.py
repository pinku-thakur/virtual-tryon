"""
Combos router — outfit combo data with optional AI styling tips.
"""
import logging

from fastapi import APIRouter, HTTPException

from app.models.schemas import ComboResponse, ErrorResponse
from app.services.combo_service import get_combo, get_available_styles

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Combos"])


@router.get(
    "/combos/{style}",
    response_model=ComboResponse,
    responses={404: {"model": ErrorResponse}},
    summary="Get outfit combo for a style",
    description="Returns clothing and accessory paths for a given style (formal, casual, party), with an optional AI styling tip.",
)
async def get_combo_by_style(style: str) -> ComboResponse:
    """Get combo data for a specific style."""
    logger.info(f"Combo request for style: {style}")

    result = await get_combo(style)

    if result is None:
        available = get_available_styles()
        raise HTTPException(
            status_code=404,
            detail=f"Style '{style}' not found. Available styles: {', '.join(available)}",
        )

    return result
