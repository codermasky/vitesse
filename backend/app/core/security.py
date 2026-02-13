import re
import hashlib
from datetime import datetime, timedelta
from typing import Any, Union, Optional

import jwt
from passlib.context import CryptContext

from app.core.config import settings

# Authentication Configuration
pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
ALGORITHM = "HS256"

# PII Masking Configuration
# Regex patterns for SSN and EIN
# SSN: XXX-XX-XXXX
SSN_PATTERN = r"\b\d{3}-\d{2}-\d{4}\b"
# EIN: XX-XXXXXXX
EIN_PATTERN = r"\b\d{2}-\d{7}\b"

# Consistent salt for hashing
PII_SALT = "vitesse-pii-salt-2024"

# --- Authentication Functions ---


def create_access_token(
    subject: Union[str, Any], expires_delta: Optional[timedelta] = None
) -> str:
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )
    to_encode = {"exp": expire, "sub": str(subject)}
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def verify_token(token: str) -> Union[str, None]:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
        return payload.get("sub")
    except jwt.PyJWTError:
        return None


# --- PII Masking Functions ---


def hash_pii(value: str) -> str:
    """Hash PII value using SHA-256 with a salt."""
    if not value:
        return value

    salted_value = f"{PII_SALT}:{value}"
    hashed = hashlib.sha256(salted_value.encode()).hexdigest()
    return f"HASHED_{hashed[:12]}"


def mask_pii_in_text(text: str) -> str:
    """Find and mask SSNs and EINs in text by hashing them."""
    if not text or not isinstance(text, str):
        return text

    def ssn_replacer(match):
        return hash_pii(match.group(0))

    def ein_replacer(match):
        return hash_pii(match.group(0))

    # Mask SSNs
    text = re.sub(SSN_PATTERN, ssn_replacer, text)
    # Mask EINs
    text = re.sub(EIN_PATTERN, ein_replacer, text)

    return text


def mask_pii_in_data(data: Any) -> Any:
    """Recursively mask PII in dicts, lists, and strings."""
    if isinstance(data, str):
        return mask_pii_in_text(data)
    elif isinstance(data, dict):
        return {k: mask_pii_in_data(v) for k, v in data.items()}
    elif isinstance(data, list):
        return [mask_pii_in_data(i) for i in data]
    return data
