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
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if not user:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user


async def generate_tokens(user: User) -> TokenResponse:
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
    try:
        payload = decode_token(refresh_token)
    except ValueError:
        return None
    if payload.get("type") != "refresh":
        return None
    user_id = payload.get("sub")
    if not user_id:
        return None
    revoke_token(refresh_token)
    result = await db.execute(select(User).where(User.id == UUID(user_id)))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        return None
    return await generate_tokens(user)


async def logout_user(access_token: str) -> None:
    try:
        payload = decode_token(access_token)
        revoke_token(access_token)
    except ValueError:
        pass


async def get_user_by_id(db: AsyncSession, user_id: UUID) -> User | None:
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


async def get_user_by_email(db: AsyncSession, email: str) -> User | None:
    result = await db.execute(select(User).where(User.email == email))
    return result.scalar_one_or_none()


async def create_user(db: AsyncSession, request: UserCreate) -> User:
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