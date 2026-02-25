"""
Pydantic request/response schemas for all API endpoints.
"""
from pydantic import BaseModel, Field
from typing import Optional


# ── Try-On ──────────────────────────────────────────────────────────

class TryOnResponse(BaseModel):
    """Response from the /try_on endpoint."""
    status: str = Field(..., examples=["success"])
    image_url: Optional[str] = Field(None, description="URL of the result image")
    message: Optional[str] = Field(None, description="Error message if status is 'error'")


# ── Recommendation ──────────────────────────────────────────────────

class RecommendRequest(BaseModel):
    """Request body for the /recommend endpoint."""
    clothing_type: Optional[str] = Field(None, examples=["shirt", "jacket"])
    occasion: Optional[str] = Field(None, examples=["formal", "casual", "party"])
    preferences: Optional[str] = Field(None, examples=["minimalist", "bold colors"])
    colors: Optional[list[str]] = Field(None, examples=[["navy", "white"]])
    image_data: Optional[str] = Field(None, description="Base64 encoded image of the user/outfit for analysis")


class RecommendResponse(BaseModel):
    """Response from the /recommend endpoint."""
    status: str = Field(..., examples=["success"])
    suggestion: str = Field(..., description="AI-generated style recommendation text")
    source: str = Field(..., examples=["gemini", "fallback"], description="Whether AI or fallback was used")


# ── Combos ──────────────────────────────────────────────────────────

class ComboAccessories(BaseModel):
    """Accessory paths/data for a combo."""
    glasses: Optional[str] = None
    watch: Optional[str] = None
    chain: Optional[str] = None
    earring: Optional[str] = None
    bag: Optional[str] = None
    shoes: Optional[str] = None


class ComboResponse(BaseModel):
    """Response from the /combos/{style} endpoint."""
    status: str = Field(..., examples=["success"])
    style: str = Field(..., examples=["formal"])
    clothing: str = Field(..., description="Path to the clothing image")
    accessories: ComboAccessories
    ai_tip: Optional[str] = Field(None, description="AI-generated styling tip for this combo")


# ── Generic Error ───────────────────────────────────────────────────

class ErrorResponse(BaseModel):
    """Standard error response."""
    status: str = "error"
    message: str
