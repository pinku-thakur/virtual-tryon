"""
Custom exceptions for HuggingFace API errors.
"""


class HFTokenError(Exception):
    """
    Raised when the HuggingFace token is missing, invalid, or rate-limited.
    The frontend detects the error_code to prompt the user for a token.
    """

    def __init__(self, user_message: str, error_code: str = "hf_token_required"):
        self.user_message = user_message
        self.error_code = error_code
        super().__init__(user_message)
