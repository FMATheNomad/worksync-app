from datetime import datetime, timedelta, timezone
from typing import Any, Optional
from uuid import UUID

import bcrypt
from jose import JWTError, jwt

from app.core.config import settings


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(
        plain_password.encode("utf-8"), hashed_password.encode("utf-8")
    )


def create_access_token(
    user_id: UUID,
    role: str,
    plan: str,
    expires_delta: Optional[timedelta] = None,
) -> str:
    to_encode: dict[str, Any] = {
        "sub": str(user_id),
        "role": role,
        "plan": plan,
        "type": "access",
    }
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.access_token_expire_minutes)
    )
    to_encode["exp"] = expire
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)


def create_refresh_token(user_id: UUID, expires_delta: Optional[timedelta] = None) -> str:
    to_encode: dict[str, Any] = {
        "sub": str(user_id),
        "type": "refresh",
    }
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(days=settings.refresh_token_expire_days)
    )
    to_encode["exp"] = expire
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)


def decode_token(token: str) -> dict[str, Any]:
    try:
        payload = jwt.decode(
            token, settings.secret_key, algorithms=[settings.algorithm]
        )
        return payload
    except JWTError:
        raise ValueError("Invalid or expired token")
