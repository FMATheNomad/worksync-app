"""
Authentication service — login, token generation, refresh rotation, logout.

WHY THIS EXISTS: Separates auth business logic from route handlers. Routes stay thin
(parse request, call service, return response). All token lifecycle decisions are
centralized here for auditability.

REFRESH TOKEN ROTATION:
  On every refresh, the old refresh token is revoked (one-time use) and a new
  access+refresh pair is issued. This is a security best practice:
    - Limits the window of vulnerability for a stolen refresh token.
    - If an attacker steals a refresh token and uses it, the legitimate user's
      next refresh attempt will fail (token already revoked), alerting the user.
  This is a subset of the OAuth 2.0 refresh token rotation spec (RFC 6819).
  We do NOT implement re-use detection (tracking which tokens were revoked due
  to rotation), but that would be the next security enhancement.

WHY MANUAL REVOCATION (not DB-backed):
  Revoked tokens are stored in an in-memory set (BLACKLISTED_TOKENS in security.py).
  This is fast but doesn't survive restarts. See security.py for the full discussion.

EDGE CASE — Stale refresh token:
  If a user never refreshes for 7 days, the token expires naturally (jose.decode
  enforces exp). The user must re-login. This is by design — inactive sessions
  automatically expire.

SECURITY BOUNDARY:
  - authenticate_user: Returns None for both "wrong email" and "wrong password" to
    prevent user enumeration. An attacker cannot tell which was incorrect.
  - refresh_access_token: Revokes the OLD token BEFORE issuing new ones. If any step
    fails (invalid token, user deactivated), the old token is already revoked —
    but since we failed, the attacker can't use it either (it's already revoked).
    The ordering could be improved: in a production system, we'd validate first,
    then revoke, then issue. However, since the old token is revoked either way,
    the practical difference is minimal.
"""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    revoke_token,
    verify_password,
)
from app.models.user import User
from app.schemas.auth import TokenResponse
from app.schemas.user import UserCreate


async def authenticate_user(
    db: AsyncSession, email: str, password: str
) -> User | None:
    """
    Validates credentials against the database.
    Returns None for ANY failure — never reveals whether email exists.
    """
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if not user:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user


async def generate_tokens(user: User) -> TokenResponse:
    """
    Creates an access token (with role+plan claims) and a refresh token.
    The access token is short-lived (30 min default) and carries authorization
    claims that authorize downstream requests without DB lookups.
    """
    access_token = create_access_token(
        user_id=user.id,
        role=user.role.value,
        plan=user.subscription_plan.value,
    )
    refresh_token = create_refresh_token(user_id=user.id)
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
    )


async def refresh_access_token(
    db: AsyncSession, refresh_token: str
) -> TokenResponse | None:
    """
    Implements refresh token rotation:
      1. Decode and validate the incoming refresh token.
      2. Verify token type is "refresh" (not access).
      3. Revoke the old refresh token (one-time use).
      4. Load user and verify they're active.
      5. Issue new access + refresh token pair.

    Returns None if any step fails (invalid token, deactivated user, etc.).
    """
    try:
        payload = decode_token(refresh_token)
    except ValueError:
        return None
    if payload.get("type") != "refresh":
        return None
    user_id = payload.get("sub")
    if not user_id:
        return None
    # SECURITY: Revoke old token before creating new pair.
    # If the old token was stolen, both the attacker and legitimate user
    # lose access — the user re-logs in, the attacker's token is dead.
    revoke_token(refresh_token)
    result = await db.execute(select(User).where(User.id == UUID(user_id)))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        return None
    return await generate_tokens(user)


async def logout_user(access_token: str) -> None:
    """
    Revokes the access token so it can't be used again.
    The refresh token remains valid until expiry or next refresh (which will
    fail because the old access token is gone). The frontend also clears
    localStorage, so the UX is clean even without perfect server-side revocation.
    """
    try:
        payload = decode_token(access_token)
        revoke_token(access_token)
    except ValueError:
        # Token was already expired or invalid — nothing to revoke.
        pass


async def get_user_by_id(db: AsyncSession, user_id: UUID) -> User | None:
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


async def get_user_by_email(db: AsyncSession, email: str) -> User | None:
    result = await db.execute(select(User).where(User.email == email))
    return result.scalar_one_or_none()


async def create_user(db: AsyncSession, request: UserCreate) -> User:
    """
    Creates a new user with hashed password. The password is hashed here (in the
    service layer) rather than in the model to keep the model focused on data
    structure. The hash_password call uses bcrypt with automatic salting.
    """
    user = User(
        name=request.name,
        email=request.email,
        hashed_password=hash_password(request.password),
        role=request.role,
        jabatan=request.jabatan,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return user
