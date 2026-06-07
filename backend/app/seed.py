import asyncio
import os
import uuid
from datetime import datetime, timezone

from sqlalchemy import select

from app.core.database import engine, async_session_factory, Base
from app.core.security import hash_password
from app.models.user import User, UserRole, SubscriptionPlan, SubscriptionStatus


async def seed_database():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session_factory() as db:
        result = await db.execute(select(User).where(User.email == "admin@worksync.app"))
        existing = result.scalar_one_or_none()
        if existing:
            print("Admin user already exists, skipping seed.")
            return

    seed_pw = os.getenv("SEED_PASSWORD", "password123")
    admin = User(
            id=uuid.uuid4(),
            name="Admin Worksync",
            email="admin@worksync.app",
            hashed_password=hash_password(seed_pw),
            role=UserRole.admin,
            jabatan="System Administrator",
            is_active=True,
            subscription_plan=SubscriptionPlan.enterprise,
            subscription_status=SubscriptionStatus.active,
            max_employees=999999,
            created_at=datetime.now(timezone.utc),
        )

        employee = User(
            id=uuid.uuid4(),
            name="Employee Demo",
            email="employee@worksync.app",
            hashed_password=hash_password(seed_pw),
            role=UserRole.employee,
            jabatan="Staff",
            is_active=True,
            subscription_plan=SubscriptionPlan.free,
            subscription_status=SubscriptionStatus.active,
            max_employees=5,
            created_at=datetime.now(timezone.utc),
        )

        employee = User(
            id=uuid.uuid4(),
            name="Karyawan Demo",
            email="karyawan@worksync.app",
            hashed_password=hash_password("password123"),
            role=UserRole.employee,
            jabatan="Staff",
            is_active=True,
            subscription_plan=SubscriptionPlan.free,
            subscription_status=SubscriptionStatus.active,
            max_employees=5,
            created_at=datetime.now(timezone.utc),
        )

        db.add_all([admin, employee])
        await db.commit()
        print("Seed completed!")
        print("  Admin:    admin@worksync.app / password123")
        print("  Employee: karyawan@worksync.app / password123")


if __name__ == "__main__":
    asyncio.run(seed_database())
