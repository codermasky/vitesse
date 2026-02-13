"""
Aether Utils Module

General utility functions for agentic applications:
- String manipulation
- Data transformation
- ID generation
- Time utilities
"""

import hashlib
import uuid
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional


# ============================================================================
# ID GENERATION
# ============================================================================


def generate_workflow_id(prefix: str = "wf") -> str:
    """Generate a unique workflow ID."""
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


def generate_request_id(prefix: str = "req") -> str:
    """Generate a unique request ID."""
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


def generate_agent_run_id(agent_id: str) -> str:
    """Generate a unique run ID for an agent execution."""
    timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
    short_uuid = uuid.uuid4().hex[:8]
    return f"{agent_id}_{timestamp}_{short_uuid}"


# ============================================================================
# HASHING
# ============================================================================


def hash_dict(data: Dict[str, Any], algorithm: str = "sha256") -> str:
    """
    Create a deterministic hash of a dictionary.

    Args:
        data: Dictionary to hash
        algorithm: Hash algorithm (sha256, md5, etc.)

    Returns:
        Hex digest of hash
    """
    import json

    # Sort keys for deterministic hashing
    json_str = json.dumps(data, sort_keys=True)

    if algorithm == "sha256":
        return hashlib.sha256(json_str.encode()).hexdigest()
    elif algorithm == "md5":
        return hashlib.md5(json_str.encode()).hexdigest()
    else:
        raise ValueError(f"Unsupported algorithm: {algorithm}")


def hash_string(
    text: str, algorithm: str = "sha256", length: Optional[int] = None
) -> str:
    """
    Hash a string.

    Args:
        text: String to hash
        algorithm: Hash algorithm
        length: Optional length to truncate hash

    Returns:
        Hex digest (optionally truncated)
    """
    if algorithm == "sha256":
        hash_obj = hashlib.sha256(text.encode())
    elif algorithm == "md5":
        hash_obj = hashlib.md5(text.encode())
    else:
        raise ValueError(f"Unsupported algorithm: {algorithm}")

    digest = hash_obj.hexdigest()

    if length:
        return digest[:length]
    return digest


# ============================================================================
# TIME UTILITIES
# ============================================================================


def get_utc_now() -> datetime:
    """Get current UTC datetime."""
    return datetime.utcnow()


def get_utc_timestamp() -> str:
    """Get current UTC timestamp in ISO format."""
    return datetime.utcnow().isoformat()


def time_ago(dt: datetime) -> str:
    """
    Get human-readable time difference.

    Args:
        dt: Datetime to compare

    Returns:
        String like "2 hours ago", "5 minutes ago"
    """
    now = datetime.utcnow()
    diff = now - dt

    seconds = diff.total_seconds()

    if seconds < 60:
        return f"{int(seconds)} seconds ago"
    elif seconds < 3600:
        return f"{int(seconds / 60)} minutes ago"
    elif seconds < 86400:
        return f"{int(seconds / 3600)} hours ago"
    else:
        return f"{int(seconds / 86400)} days ago"


# ============================================================================
# DATA TRANSFORMATION
# ============================================================================


def flatten_dict(nested: Dict[str, Any], sep: str = ".") -> Dict[str, Any]:
    """
    Flatten a nested dictionary.

    Args:
        nested: Nested dictionary
        sep: Separator for keys

    Returns:
        Flat dictionary

    Example:
        flatten_dict({"a": {"b": 1}}) -> {"a.b": 1}
    """

    def _flatten(current: Dict, prefix: str = "") -> Dict:
        flat = {}
        for key, value in current.items():
            new_key = f"{prefix}{sep}{key}" if prefix else key

            if isinstance(value, dict):
                flat.update(_flatten(value, new_key))
            else:
                flat[new_key] = value

        return flat

    return _flatten(nested)


def unflatten_dict(flat: Dict[str, Any], sep: str = ".") -> Dict[str, Any]:
    """
    Unflatten a dictionary.

    Args:
        flat: Flat dictionary
        sep: Separator in keys

    Returns:
        Nested dictionary

    Example:
        unflatten_dict({"a.b": 1}) -> {"a": {"b": 1}}
    """
    nested = {}

    for key, value in flat.items():
        parts = key.split(sep)
        current = nested

        for part in parts[:-1]:
            if part not in current:
                current[part] = {}
            current = current[part]

        current[parts[-1]] = value

    return nested


def deep_merge(dict1: Dict[str, Any], dict2: Dict[str, Any]) -> Dict[str, Any]:
    """
    Deep merge two dictionaries.

    Args:
        dict1: First dictionary
        dict2: Second dictionary (takes precedence)

    Returns:
        Merged dictionary
    """
    result = dict1.copy()

    for key, value in dict2.items():
        if key in result and isinstance(result[key], dict) and isinstance(value, dict):
            result[key] = deep_merge(result[key], value)
        else:
            result[key] = value

    return result


# ============================================================================
# STRING UTILITIES
# ============================================================================


def truncate_string(text: str, max_length: int = 100, suffix: str = "...") -> str:
    """
    Truncate string with suffix.

    Args:
        text: String to truncate
        max_length: Maximum length
        suffix: Suffix to add

    Returns:
        Truncated string
    """
    if len(text) <= max_length:
        return text

    return text[: max_length - len(suffix)] + suffix


def sanitize_filename(filename: str) -> str:
    """
    Sanitize filename by removing/replacing invalid characters.

    Args:
        filename: Original filename

    Returns:
        Sanitized filename
    """
    import re

    # Remove invalid characters
    filename = re.sub(r'[<>:"/\\|?*]', "", filename)

    # Replace spaces with underscores
    filename = filename.replace(" ", "_")

    # Remove leading/trailing dots
    filename = filename.strip(".")

    return filename


# ============================================================================
# VALIDATION HELPERS
# ============================================================================


def is_valid_email(email: str) -> bool:
    """Check if string is a valid email format."""
    import re

    pattern = r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
    return re.match(pattern, email) is not None


def is_valid_url(url: str) -> bool:
    """Check if string is a valid URL format."""
    import re

    pattern = r"^https?://[^\s/$.?#].[^\s]*$"
    return re.match(pattern, url) is not None
