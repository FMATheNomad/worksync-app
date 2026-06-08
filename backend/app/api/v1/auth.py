"""
Authentication routes — login, refresh, logout, and user info.

WHY THIS EXISTS: Handles the complete auth lifecycle. These endpoints are the
gateway to the entire application — no authenticated action is possible without
first passing through login or refresh.

RATE LIMITING RATIONALE:
  - /login is rate-limited at 10 requests/minute per IP address.
  - WHY: Prevents brute-force password guessing. 10 attempts/minute is enough
    for legitimate use (a user might mistype their password 2-3 times) but
    severely limits automated attackers. For even stricter security, add
    account-level rate limiting (lockout after N failed attempts).
  - /refresh, /logout, and /me are NOT rate-limited because:
    - /refresh is called frequently (every 30 min) and rate limiting would
      cause UX issues (sudden logout).
    - /logout is self-protecting (only the token owner can call it).
    - /me is read-only and stateless (no DB write).

SECURITY BOUNDARIES BETWEEN ENDPOINTS:
  - /login: No auth required. Takes email+password, returns tokens.
  - /refresh: No auth required (the user might have an expired access token).
    Takes a refresh token, returns new token pair. Old refresh token is revoked.
  - /logout: Auth required. Revokes the current access token.
  - /me: Auth required. Returns the current user's profile.

WHY /refresh doesn't require auth:
  The refresh token IS the authentication. The user proves they are who they
  claim to be by presenting a valid, unexpired refresh token. Requiring an
  access token for refresh would create a chicken-and-egg problem when the
  access token expires.
"""

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.limiter import limiter

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.schemas.auth import LoginRequest, RefreshTokenRequest, TokenResponse
from app.schemas.user import UserResponse
from app.models.user import User
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
async def login(body: LoginRequest, request: Request, db: AsyncSession = Depends(get_db)):
    """
    Authenticates user credentials and returns JWT token pair.
    
    Rate-limited to 10 req/min per IP. Returns 401 for both wrong email
    and wrong password (prevents user enumeration).
    
    The slowapi Limiter decorator uses the client IP as the rate limit key.
    In production behind a reverse proxy, configure Limiter to use
    X-Forwarded-For header via get_remote_address configuration.
    """
    user = await auth_service.authenticate_user(db, body.email, body.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    return await auth_service.generate_tokens(user)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(request: RefreshTokenRequest, db: AsyncSession = Depends(get_db)):
    """
    Exchanges a valid refresh token for a new token pair (rotation).
    
    No rate limiting — called frequently by the frontend interceptor when
    access tokens expire. The old refresh token is revoked server-side.
    
    Returns 401 if the refresh token is invalid, expired, or already revoked.
    """
    tokens = await auth_service.refresh_access_token(db, request.refresh_token)
    if not tokens:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )
    return tokens


@router.post("/logout")
async def logout(
    request: Request,
    current_user: User = Depends(get_current_user),
):
    """
    Revokes the current access token.
    
    Requires authentication (user must present a valid access token).
    The token is added to the in-memory blacklist so it can't be used again.
    The frontend should also clear localStorage after calling this.
    """
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[7:]
        await auth_service.logout_user(token)
    return {"message": "Successfully logged out"}


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    """
    Returns the authenticated user's profile.
    
    Depends on get_current_user which validates the access token, loads
    the user from DB, and checks is_active. This is the standard pattern
    for all protected routes.
    """
    return current_user
