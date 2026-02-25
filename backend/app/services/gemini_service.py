"""
Google Gemini AI service — provides recommendations and style tips.
"""
import logging
import base64
import io
from PIL import Image
from typing import Optional, List, Union

from app.config import get_settings

logger = logging.getLogger(__name__)

# Module-level model cache
_model = None


def _get_model():
    """Lazy-initialize the Gemini model."""
    global _model
    if _model is not None:
        return _model

    settings = get_settings()
    if not settings.GEMINI_API_KEY:
        logger.warning("GEMINI_API_KEY not set — AI features will use fallback mode")
        return None

    try:
        import google.generativeai as genai

        genai.configure(api_key=settings.GEMINI_API_KEY)
        _model = genai.GenerativeModel("gemini-2.0-flash")
        logger.info("Gemini model initialized successfully")
        return _model
    except Exception as e:
        logger.error(f"Failed to initialize Gemini model: {e}")
        return None


async def get_recommendation(
    clothing_type: Optional[str] = None,
    occasion: Optional[str] = None,
    preferences: Optional[str] = None,
    colors: Optional[list[str]] = None,
    image_data: Optional[str] = None,
) -> tuple[str, str]:
    """
    Get an AI-powered style recommendation.

    Returns:
        Tuple of (suggestion_text, source) where source is "gemini" or "fallback".
    """
    model = _get_model()

    if model is None:
        return _fallback_recommendation(clothing_type, occasion), "fallback"

    try:
        # Prepare inputs for Gemini
        prompt_parts = _build_recommendation_prompt(clothing_type, occasion, preferences, colors, has_image=bool(image_data))
        
        content = [prompt_parts]
        
        if image_data:
            try:
                # Remove header if present (e.g. "data:image/png;base64,")
                if "base64," in image_data:
                    image_data = image_data.split("base64,")[1]
                
                image_bytes = base64.b64decode(image_data)
                image = Image.open(io.BytesIO(image_bytes))
                content.append(image)
                logger.info("Image attached to recommendation request")
            except Exception as img_err:
                logger.error(f"Failed to process image for recommendation: {img_err}")
                # Continue without image if it fails

        response = model.generate_content(content)
        suggestion = response.text.strip()
        logger.info("Gemini recommendation generated successfully")
        return suggestion, "gemini"
    except Exception as e:
        logger.error(f"Gemini recommendation failed: {e}")
        return _fallback_recommendation(clothing_type, occasion), "fallback"


async def get_combo_tip(style: str) -> Optional[str]:
    """
    Get an AI-generated styling tip for a combo style.

    Returns:
        AI tip string, or None if Gemini is unavailable.
    """
    model = _get_model()
    if model is None:
        return None

    try:
        prompt = (
            f"You are a men's fashion stylist. Give ONE short, practical styling tip "
            f"(2-3 sentences max) for a '{style}' outfit combo. Be specific about "
            f"colors, fit, and accessories. Keep it conversational and actionable."
        )
        response = model.generate_content(prompt)
        return response.text.strip()
    except Exception as e:
        logger.error(f"Gemini combo tip failed: {e}")
        return None


def _build_recommendation_prompt(
    clothing_type: Optional[str],
    occasion: Optional[str],
    preferences: Optional[str],
    colors: Optional[list[str]],
    has_image: bool = False,
) -> str:
    """Build a structured prompt for Gemini recommendation."""
    parts = [
        "You are an expert personal stylist. Analyze the user's request" + 
        (" and the provided image of the user" if has_image else "") + "."
        "Provide a 'Pro Suggestion' that is personalized.",
        "If an image is provided, analyze the user's SKIN TONE and features to suggest specific colors "
        "and styles that complement them best. Mention why these colors work for their skin tone.",
        "Suggest specific accessories (glasses, jewelry), shoes, and clothing items.",
        "Keep the advice concise (3-4 sentences), encouraging, and fashion-forward."
    ]

    if clothing_type:
        parts.append(f"\nClothing type: {clothing_type}")
    if occasion:
        parts.append(f"Occasion: {occasion}")
    if preferences:
        parts.append(f"Style preferences: {preferences}")
    if colors:
        parts.append(f"Current colors being worn: {', '.join(colors)}")

    if not any([clothing_type, occasion, preferences, colors]):
        parts.append(
            "\nNo specific details provided. Give a general versatile outfit suggestion "
            "that works for most casual occasions."
        )

    return "\n".join(parts)


def _fallback_recommendation(
    clothing_type: Optional[str] = None,
    occasion: Optional[str] = None,
) -> str:
    """Fallback recommendations when Gemini is unavailable."""
    suggestions = {
        "formal": "Pair with a slim-fit navy blazer, brown Oxford shoes, and a leather strap watch for a polished look.",
        "casual": "Try white sneakers, a minimal leather belt, and silver-tone accessories for a relaxed yet put-together style.",
        "party": "Go bold with black Chelsea boots, a statement chain necklace, and a fitted dark jacket.",
    }

    if occasion and occasion.lower() in suggestions:
        return f"AI Suggests: {suggestions[occasion.lower()]}"

    if clothing_type:
        return f"AI Suggests: Complement your {clothing_type} with neutral accessories — a leather watch, clean sneakers, and a slim belt work well."

    return "AI Suggests: White sneakers, a brown leather watch, and a minimal chain create a versatile look for any occasion."


async def analyze_vto_images(person_b64: str, garment_b64: str) -> str:
    """Analyze person and garment images to output VTO metadata and coordinates using Gemini."""
    model = _get_model()
    if not model:
        return '{"error": "Gemini API key not configured"}'
        
    try:
        content = [
            "Role: Expert Computer Vision Engineer specializing in Virtual Try-On (VTO). Task: Analyze the provided person image and garment image to generate a realistic overlay. Context: Using Supabase for storage and a GAN/Diffusion-based warping pipeline. Workflow: 1. Segment human body parts. 2. Estimate 2D/3D pose keypoints. 3. Warp garment to match leg geometry and pose. 4. Blend using lighting-aware synthesis. Constraints: Maintain fabric texture; preserve original person’s skin tone and background; output high-resolution result. Format: Return JSON metadata for coordinates and the final processed image URL."
        ]
        
        # Process and attach Person image
        if "base64," in person_b64:
            person_b64 = person_b64.split("base64,")[1]
        p_bytes = base64.b64decode(person_b64)
        p_img = Image.open(io.BytesIO(p_bytes))
        content.append("Person Image:")
        content.append(p_img)
        
        # Process and attach Garment image
        if "base64," in garment_b64:
            garment_b64 = garment_b64.split("base64,")[1]
        g_bytes = base64.b64decode(garment_b64)
        g_img = Image.open(io.BytesIO(g_bytes))
        content.append("Garment Image:")
        content.append(g_img)

        response = model.generate_content(content)
        
        # Try to parse the markdown block out if the AI wrapped it in ```json
        result_text = response.text.strip()
        if result_text.startswith("```json"):
            result_text = result_text.split("```json")[1].split("```")[0].strip()
        elif result_text.startswith("```"):
            result_text = result_text.split("```")[1].split("```")[0].strip()

        logger.info("Gemini VTO Analysis generated successfully")
        return result_text
    except Exception as e:
        logger.error(f"Gemini VTO Analysis failed: {e}")
        return '{"error": "Failed to analyze images"}'
