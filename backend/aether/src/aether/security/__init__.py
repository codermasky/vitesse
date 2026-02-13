"""
Aether Security Module

Provides security utilities for agentic applications:
- PII masking (SSN, EIN, credit cards)
- Secure logging
- Data sanitization
"""

from aether.security.pii import (
    mask_pii_in_text,
    mask_pii_in_data,
    hash_pii_value,
)

__all__ = [
    "mask_pii_in_text",
    "mask_pii_in_data",
    "hash_pii_value",
]
