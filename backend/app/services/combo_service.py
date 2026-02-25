"""
Combo service — static outfit combo definitions with optional AI tips.
"""
import logging
from typing import Optional

from app.models.schemas import ComboAccessories, ComboResponse
from app.services.gemini_service import get_combo_tip

logger = logging.getLogger(__name__)

# Static combo definitions — maps style to clothing + accessories image paths
# These paths are relative to the frontend's image directory
COMBO_DEFINITIONS: dict[str, dict] = {
    "formal": {
        "clothing": "images/combos/formal_shirt.png",
        "accessories": {
            "glasses": None,
            "watch": "images/combos/formal_watch.png",
            "chain": "images/combos/formal_chain.png",
            "earring": None,
            "bag": None,
            "shoes": "images/combos/formal_shoes.png",
        },
    },
    "casual": {
        "clothing": "images/combos/casual_shirt.png",
        "accessories": {
            "glasses": "images/combos/casual_glasses.png",
            "watch": None,
            "chain": None,
            "earring": None,
            "bag": None,
            "shoes": "images/combos/casual_shoes.png",
        },
    },
    "party": {
        "clothing": "images/combos/party_jacket.png",
        "accessories": {
            "glasses": None,
            "watch": None,
            "chain": "images/combos/party_chain.png",
            "earring": "images/combos/party_earring.png",
            "bag": None,
            "shoes": "images/combos/party_shoes.png",
        },
    },
}


def get_available_styles() -> list[str]:
    """Return list of available combo styles."""
    return list(COMBO_DEFINITIONS.keys())


async def get_combo(style: str, include_ai_tip: bool = True) -> Optional[ComboResponse]:
    """
    Get combo data for a given style.

    Args:
        style: The style name (e.g., "formal", "casual", "party").
        include_ai_tip: Whether to attempt fetching an AI styling tip.

    Returns:
        ComboResponse if style exists, None otherwise.
    """
    style_lower = style.lower()

    if style_lower not in COMBO_DEFINITIONS:
        return None

    combo = COMBO_DEFINITIONS[style_lower]
    accessories = ComboAccessories(**combo["accessories"])

    # Optionally get AI styling tip
    ai_tip = None
    if include_ai_tip:
        try:
            ai_tip = await get_combo_tip(style_lower)
        except Exception as e:
            logger.warning(f"Failed to get AI tip for combo '{style_lower}': {e}")

    return ComboResponse(
        status="success",
        style=style_lower,
        clothing=combo["clothing"],
        accessories=accessories,
        ai_tip=ai_tip,
    )
