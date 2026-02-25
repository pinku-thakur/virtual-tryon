"""
Virtual Try-On service — handles AI try-on via IDM-VTON Gradio space or mock mode.
"""
import asyncio
import logging
import time
from pathlib import Path

from app.config import get_settings
from app.utils.image_utils import file_to_base64_data_uri
from app.utils.hf_errors import HFTokenError

logger = logging.getLogger(__name__)

# Error substrings that indicate HF token / rate-limit issues
_HF_AUTH_ERRORS = [
    "401",
    "403",
    "unauthorized",
    "authentication",
    "invalid token",
    "token is invalid",
    "access denied",
]

_HF_RATE_ERRORS = [
    "429",
    "rate limit",
    "rate_limit",
    "too many requests",
    "exceeded",
    "quota",
    "usage limit",
]


def _is_hf_token_error(error: Exception) -> bool:
    """Check if the error is related to HF token auth or rate limiting."""
    msg = str(error).lower()
    return any(s in msg for s in _HF_AUTH_ERRORS + _HF_RATE_ERRORS)


async def process_tryon(
    person_path: Path,
    clothing_path: Path,
    hf_token: str | None = None,
    category: str = "clothing",
) -> str:
    """
    Run the virtual try-on pipeline.

    Args:
        person_path: Path to the person image on disk.
        clothing_path: Path to the clothing image on disk.
        hf_token: Optional user-provided HuggingFace token (takes priority over server token).

    Returns:
        Base64 data URI of the result image.
    """
    settings = get_settings()

    if settings.USE_MOCK_AI:
        return await _mock_tryon(clothing_path)
    else:
        return await _real_tryon(person_path, clothing_path, hf_token=hf_token, category=category)


async def _mock_tryon(clothing_path: Path) -> str:
    """
    Mock try-on: simulate processing delay, return the clothing image as the result.
    Useful for local development without GPU.
    """
    logger.info("Running in MOCK MODE — returning clothing image as result")
    await asyncio.sleep(1)  # Simulate brief processing
    return file_to_base64_data_uri(clothing_path)


async def _real_tryon(
    person_path: Path,
    clothing_path: Path,
    hf_token: str | None = None,
    category: str = "clothing",
) -> str:
    """
    Real try-on: call the IDM-VTON Gradio space on HuggingFace.
    Uses: user-provided token > server .env token > no token (priority order).
    """
    logger.info("Calling IDM-VTON Gradio space for real try-on...")

    TIMEOUT_SECONDS = 120

    def _call_gradio():
        from gradio_client import Client, handle_file

        settings = get_settings()

        # Token priority: user-provided > server config > none
        token = hf_token or settings.HF_TOKEN or None
        token_source = "user" if hf_token else ("server" if settings.HF_TOKEN else "none")
        logger.info(f"Using HF token from: {token_source}")

        try:
            client = Client("yisol/IDM-VTON", token=token) if token else Client("yisol/IDM-VTON")
        except Exception as e:
            if _is_hf_token_error(e):
                raise HFTokenError(
                    "Your HuggingFace token is invalid or has been rate-limited. "
                    "Please provide a valid token to continue."
                )
            raise ConnectionError(
                f"Cannot connect to IDM-VTON space (it may be sleeping or your network is blocking it). "
                f"Try again in a minute, or set USE_MOCK_AI=True in .env for local testing. Error: {e}"
            )

        try:
            result = client.predict(
                dict={
                    "background": handle_file(str(person_path)),
                    "layers": [],
                    "composite": None,
                },
                garm_img=handle_file(str(clothing_path)),
                garment_des=category,
                is_checked=True,
                is_checked_crop=False,
                denoise_steps=30,
                seed=42,
                api_name="/tryon",
            )
        except Exception as e:
            if _is_hf_token_error(e):
                raise HFTokenError(
                    "HuggingFace API rate limit reached or token expired. "
                    "Please provide a valid HuggingFace token to continue."
                )
            raise  # Re-raise non-token errors

        # result is a tuple: (output_image_path, masked_image_path)
        return result[0]

    loop = asyncio.get_event_loop()
    try:
        output_path = await asyncio.wait_for(
            loop.run_in_executor(None, _call_gradio),
            timeout=TIMEOUT_SECONDS,
        )
    except asyncio.TimeoutError:
        raise TimeoutError(
            f"IDM-VTON did not respond within {TIMEOUT_SECONDS}s. "
            "The HuggingFace space may be cold-starting — try again in a minute, "
            "or set USE_MOCK_AI=True in .env."
        )
    except HFTokenError:
        raise  # Propagate to router for structured response
    except ConnectionError:
        raise  # Re-raise our custom message
    except Exception as e:
        # Last-resort check: maybe a wrapped HF error
        if _is_hf_token_error(e):
            raise HFTokenError(
                "HuggingFace API access denied. "
                "Please provide your own HuggingFace token to continue."
            )
        raise RuntimeError(
            f"IDM-VTON call failed: {e}. "
            "Set USE_MOCK_AI=True in .env to test without the remote model."
        )

    logger.info(f"IDM-VTON returned result at: {output_path}")
    return file_to_base64_data_uri(output_path)
