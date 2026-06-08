"""
Authentication and token security primitives.

WHY THIS EXISTS: Encapsulates all JWT creation, verification, password hashing, and
token revocation in one place. Every auth operation in the system routes through this
module to ensure consistent security guarantees.

SECURITY ARCHITECTURE:
  - Passwords are hashed with bcrypt (cost factor = gensalt() default ~12).
    bcrypt is deliberately slow to resist brute-force attacks on leaked hashes.
  - Access tokens carry role + plan claims so downstream code (middleware, routes)
    can authorize without a database lookup on every request.
  - Refresh tokens carry only user_id + jti. They are separate from access tokens
    so that a compromised access token cannot be used to generate new tokens.
  - jti (JWT ID) is a unique UUID per token. It enables individual token revocation
    via an in-memory blacklist. Without jti, you could only revoke all tokens for a
    user (e.g., by changing their password).

TRADE-OFF: In-memory blacklist (BLACKLISTED_TOKENS set) does not persist across
server restarts. For production, this should be replaced with Redis or a database-backed
blacklist. The current approach is acceptable for single-server deployments where a
restart invalidates all sessions anyway (forcing re-login).

TOKEN ROTATION: See auth_service.refresh_access_token — refresh token is revoked
(one-time use) each time it's exchanged. This limits the window of vulnerability
if a refresh token is stolen.
"""

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Optional
from uuid import UUID

import bcrypt
from jose import JWTError, jwt

from app.core.config import settings

# In-memory token blacklist.
# WHY not a database table: Speed. Token validation happens on every authenticated
# request; a DB query for every request would add latency. A set lookup is O(1).
# NOTE: Replace with Redis for multi-instance deployments.
BLACKLISTED_TOKENS: set[str] = set()


def hash_password(password: str) -> str:
    """
    bcrypt hash with automatic salt. gensalt() uses a random salt of 22 characters
    (~= 2^128 possible salts), ensuring that identical passwords produce different hashes.
    This prevents rainbow table attacks and makes it infeasible to detect users who
    share passwords.
    """
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Constant-time comparison (bcrypt.checkpw handles timing attack mitigation internally).
    WHY not direct string comparison: Timing attacks on password verification could leak
    character-by-character information. bcrypt's implementation is resistant.
    """
    return bcrypt.checkpw(
        plain_password.encode("utf-8"), hashed_password.encode("utf-8")
    )


def create_access_token(
    user_id: UUID,
    role: str,
    plan: str,
    expires_delta: Optional[timedelta] = None,
) -> str:
    """
    Access token payload:
      sub  : user UUID — identifies the user for database lookups.
      role : "admin" | "employee" — used for authorization decisions at the route level.
      plan : "free" | "pro" | "enterprise" — used for feature gating in middleware.
      type : "access" — distinguishes from refresh tokens; prevents a stolen refresh
             token from being used as an access token.
      iat  : issued-at timestamp — allows the server to reason about token age.
      jti  : unique token ID — enables per-token revocation.
      exp  : expiration — enforced by jose.decode; short-lived (default 30 min).

    WHY include role and plan in the token: Avoids a database query on every request
    for authorization decisions. The trade-off is that role/plan changes only take
    effect after the token expires (max 30 min). For instant enforcement of plan
    downgrades, see the subscription_updated webhook handler.
    """
    to_encode: dict[str, Any] = {
        "sub": str(user_id),
        "role": role,
        "plan": plan,
        "type": "access",
        "iat": datetime.now(timezone.utc),
        "jti": str(uuid.uuid4()),
    }
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.access_token_expire_minutes)
    )
    to_encode["exp"] = expire
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)


def create_refresh_token(user_id: UUID, expires_delta: Optional[timedelta] = None) -> str:
    """
    Refresh token payload is deliberately minimal:
      sub  : user UUID
      type : "refresh" — critical for security; refresh endpoint rejects non-refresh tokens.
      iat  : issued-at timestamp
      jti  : unique token ID — used for rotation (one-time use enforcement).
      exp  : default 7 days.

    WHY minimal payload: Refresh tokens are long-lived and more sensitive than access tokens.
    Compartmentalization ensures that even if decoded, a refresh token leaks minimal
    information about the user's role or plan.
    """
    to_encode: dict[str, Any] = {
        "sub": str(user_id),
        "type": "refresh",
        "iat": datetime.now(timezone.utc),
        "jti": str(uuid.uuid4()),
    }
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(days=settings.refresh_token_expire_days)
    )
    to_encode["exp"] = expire
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)


def decode_token(token: str) -> dict[str, Any]:
    """
    Decodes and validates a JWT token.

    SECURITY:
      1. Checks the in-memory blacklist FIRST (before decoding) to fail fast on
         revoked tokens. This also prevents timing analysis of revoked vs. valid tokens.
      2. jose.decode automatically validates: signature, expiration (exp),
         not-before (nbf), issuer (iss) if present.
      3. Raises ValueError on ANY failure — never returns partial data.

    TRADE-OFF: We do NOT validate audience (aud) or issuer (iss) claims because
    this is a single-service backend. In a microservice architecture, those should
    be added to prevent token reuse across services.
    """
    if token in BLACKLISTED_TOKENS:
        raise ValueError("Token has been revoked")
    try:
        payload = jwt.decode(
            token, settings.secret_key, algorithms=[settings.algorithm]
        )
        return payload
    except JWTError:
        raise ValueError("Invalid or expired token")


def revoke_token(token: str) -> None:
    """
    Adds a token to the in-memory blacklist.

    WHY in-memory set: Speed. Token revocation happens during logout and refresh
    token rotation. In multi-instance deployments, this must be backed by Redis
    or a shared cache. The jti claim in each token makes individual revocation possible.

    NOTE: This does NOT remove the token from the set after expiration. Over time,
    the set could grow unbounded. A production enhancement would be to periodically
    prune expired jtis (e.g., by parsing the exp claim or using a TTL-backed store).
    """
    BLACKLISTED_TOKENS.add(token)
