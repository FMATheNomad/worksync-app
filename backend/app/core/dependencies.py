"""
FastAPI dependency injection for authentication and authorization.

WHY THIS EXISTS: Extracts user authentication from request headers, validates the
JWT, loads the user from the database, and caches the user's plan on request.state
for downstream use (middleware, route handlers). This is the authorization gate
for all protected endpoints.

ARCHITECTURE — request.state:
  request.state is a Starlette feature that allows attaching arbitrary data to the
  request object. We store `user_plan` here so that middleware (SubscriptionMiddleware)
  can check plan-based feature access without re-decoding the JWT or re-querying
  the database.

  WHY not just rely on the JWT claims? The JWT's `plan` claim is only as fresh as
  the token issuance time. Storing it on request.state provides a single source of
  truth for the current request's authorization context, accessible from both
  dependencies AND middleware.

SECURITY DESIGN:
  - Token type enforcement: After decoding the token, we explicitly check that
    `payload.get("type") == "access"`. This prevents a stolen refresh token from
    being used to authenticate API requests. Refresh tokens have type="refresh"
    and are only accepted by the /auth/refresh endpoint.
  - Active user check: Even with a valid token, a deactivated user (is_active=False)
    is rejected with 403. This allows admins to disable accounts without invalidating
    existing tokens. Combined with the blacklist, this provides two layers of
    revocation control.
  - User existence check: If a user is deleted from the database but their token
    hasn't expired yet, they get 401 "User not found". This prevents phantom
    sessions.
"""

from uuid import UUID

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import decode_token
from app.models.user import User


async def get_current_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    Primary authentication dependency. Used by ALL protected routes.

    Flow:
      1. Extract Bearer token from Authorization header.
      2. Decode and validate the JWT (signature, expiration, blacklist).
      3. Verify token type is "access" (not "refresh").
      4. Extract user_id from `sub` claim.
      5. Load user from database.
      6. Verify user exists and is active.
      7. Cache subscription_plan on request.state for middleware.

    WHY manual token extraction (vs. OAuth2PasswordBearer):
      OAuth2PasswordBearer is designed for form-based login. Our API uses
      JSON request bodies and returns JSON responses. Manual extraction gives
      us full control over error message format.

    EDGE CASE — Missing Authorization header:
      The check `not auth_header or not auth_header.startswith("Bearer ")`
      catches both missing headers and malformed ones (e.g., "Token xxx").
      Returns 401, not 400, because the client should re-authenticate.

    EDGE CASE — Deactivated user during active session:
      Returns 403, not 401. The token is valid, but the account has been disabled.
      Returning 401 would suggest re-authentication is possible (it's not, if the
      account is deactivated).
    """
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid authorization header",
        )
    token = auth_header.split(" ")[1]
    try:
        payload = decode_token(token)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )
    # SECURITY: Token type check prevents refresh token misuse.
    if payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type",
        )
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )
    result = await db.execute(select(User).where(User.id == UUID(user_id)))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    if not user.is_active:
        # 403 (Forbidden) rather than 401 (Unauthorized) because the token is valid
        # but the account has been disabled. 401 would suggest re-login could help,
        # which would fail with the same error.
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated",
        )
    # Cache plan on request.state so middleware can access it without
    # re-decoding the JWT or re-querying the database.
    request.state.user_plan = user.subscription_plan.value
    return user


async def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """
    Authorization dependency for admin-only routes.

    WHY separate dependency (not a field check in routes): Reusability. Any route
    that needs admin access just adds `current_user: User = Depends(require_admin)`.
    If the admin check logic changes (e.g., adding super_admin role), it changes
    in one place.

    This is a clear example of the dependency injection pattern: `require_admin`
    itself depends on `get_current_user`, which depends on `get_db`. FastAPI
    resolves the entire chain automatically.
    """
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required",
        )
    return current_user
