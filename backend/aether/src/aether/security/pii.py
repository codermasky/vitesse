"""
Aether Security - PII Masking Utilities

Provides PII (Personally Identifiable Information) masking for:
- Social Security Numbers (SSN)
- Employer Identification Numbers (EIN)
- Credit Card Numbers
- Email addresses
- Phone numbers

All PII is hashed using SHA256 for logging and tracing while maintaining privacy.
"""

import re
import hashlib
from typing import Any, Dict, List, Union
import structlog

logger = structlog.get_logger(__name__)

# PII pattern definitions
SSN_PATTERN = re.compile(r"\b\d{3}-\d{2}-\d{4}\b|\b\d{9}\b")
EIN_PATTERN = re.compile(r"\b\d{2}-\d{7}\b")
CREDIT_CARD_PATTERN = re.compile(r"\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b")
EMAIL_PATTERN = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b")
PHONE_PATTERN = re.compile(r"\b\d{3}[-.]?\d{3}[-.]?\d{4}\b")


def hash_pii_value(value: str, prefix: str = "PII") -> str:
    """
    Hash a PII value using SHA256.

    Args:
        value: The PII value to hash
        prefix: Prefix for the hash (e.g., "SSN", "EIN")

    Returns:
        Hashed value with prefix
    """
    hash_obj = hashlib.sha256(value.encode())
    hash_hex = hash_obj.hexdigest()[:12]  # Use first 12 chars for readability
    return f"<{prefix}:{hash_hex}>"


def mask_ssn(text: str) -> str:
    """Mask SSN numbers in text."""

    def replacer(match):
        return hash_pii_value(match.group(0), "SSN")

    return SSN_PATTERN.sub(replacer, text)


def mask_ein(text: str) -> str:
    """Mask EIN numbers in text."""

    def replacer(match):
        return hash_pii_value(match.group(0), "EIN")

    return EIN_PATTERN.sub(replacer, text)


def mask_credit_card(text: str) -> str:
    """Mask credit card numbers in text."""

    def replacer(match):
        return hash_pii_value(match.group(0), "CC")

    return CREDIT_CARD_PATTERN.sub(replacer, text)


def mask_email(text: str) -> str:
    """Mask email addresses in text."""

    def replacer(match):
        return hash_pii_value(match.group(0), "EMAIL")

    return EMAIL_PATTERN.sub(replacer, text)


def mask_phone(text: str) -> str:
    """Mask phone numbers in text."""

    def replacer(match):
        return hash_pii_value(match.group(0), "PHONE")

    return PHONE_PATTERN.sub(replacer, text)


def mask_pii_in_text(text: str) -> str:
    """
    Mask all PII in text string.

    Args:
        text: Text containing potential PII

    Returns:
        Text with PII replaced by hashes
    """
    if not isinstance(text, str):
        return text

    # Apply all masking functions
    masked = text
    masked = mask_ssn(masked)
    masked = mask_ein(masked)
    masked = mask_credit_card(masked)
    masked = mask_email(masked)
    masked = mask_phone(masked)

    return masked


def mask_pii_in_data(data: Any) -> Any:
    """
    Recursively mask PII in nested data structures (dicts, lists, strings).

    Args:
        data: Data structure containing potential PII

    Returns:
        Data structure with PII masked
    """
    if isinstance(data, str):
        return mask_pii_in_text(data)

    elif isinstance(data, dict):
        return {key: mask_pii_in_data(value) for key, value in data.items()}

    elif isinstance(data, list):
        return [mask_pii_in_data(item) for item in data]

    elif isinstance(data, tuple):
        return tuple(mask_pii_in_data(item) for item in data)

    else:
        # Return as-is for other types (int, float, bool, None, etc.)
        return data


# Convenience functions for common use cases
def safe_log_dict(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Safely prepare a dictionary for logging by masking PII.

    Args:
        data: Dictionary to log

    Returns:
        Dictionary with PII masked
    """
    return mask_pii_in_data(data)


def safe_log_message(message: str) -> str:
    """
    Safely prepare a message for logging by masking PII.

    Args:
        message: Message to log

    Returns:
        Message with PII masked
    """
    return mask_pii_in_text(message)
