"""
Recommendation router — AI-powered style recommendations via Gemini.
"""
import logging

from fastapi import APIRouter

from app.models.schemas import RecommendRequest, RecommendResponse
from app.services.gemini_service import get_recommendation

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Recommendations"])


@router.post(
    "/recommend",
    response_model=RecommendResponse,
    summary="Get AI style recommendation",
    description="Send clothing details and get personalized style suggestions powered by Google Gemini AI.",
)
async def recommend(request: RecommendRequest = None) -> RecommendResponse:
    """Generate a style recommendation."""
    # Handle empty/null body gracefully
    if request is None:
        request = RecommendRequest()

    logger.info(f"Recommendation request: type={request.clothing_type}, occasion={request.occasion}")

    suggestion, source = await get_recommendation(
        clothing_type=request.clothing_type,
        occasion=request.occasion,
        preferences=request.preferences,
        colors=request.colors,
        image_data=request.image_data,
    )

    return RecommendResponse(
        status="success",
        suggestion=suggestion,
        source=source,
    )
