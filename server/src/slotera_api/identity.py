from hashlib import sha256
from secrets import token_urlsafe


def normalize_email(value: str) -> str:
    return value.strip().casefold()


def issue_opaque_token() -> str:
    return token_urlsafe(32)


def hash_opaque_token(token: str) -> bytes:
    if not token:
        raise ValueError("opaque token cannot be empty")
    return sha256(token.encode("utf-8")).digest()
