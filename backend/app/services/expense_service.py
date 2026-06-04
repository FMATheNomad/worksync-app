from datetime import date
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.expense import Expense
from app.schemas.expense import ExpenseCreate, ExpenseListResponse, ExpenseResponse


async def create_expense(db: AsyncSession, user_id: UUID, request: ExpenseCreate) -> Expense:
    expense = Expense(
        user_id=user_id,
        item_name=request.item_name,
        amount=request.amount,
        category=request.category,
        photo_url=request.photo_url,
        description=request.description,
        date=request.date,
    )
    db.add(expense)
    await db.flush()
    await db.refresh(expense)
    return expense


async def list_expenses(
    db: AsyncSession,
    user_id: UUID | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    category: str | None = None,
    page: int = 1,
    size: int = 20,
) -> ExpenseListResponse:
    query = select(Expense)

    if user_id:
        query = query.where(Expense.user_id == user_id)
    if start_date:
        query = query.where(Expense.date >= start_date)
    if end_date:
        query = query.where(Expense.date <= end_date)
    if category:
        query = query.where(Expense.category == category)

    count_query = select(func.count()).select_from(Expense)
    if user_id:
        count_query = count_query.where(Expense.user_id == user_id)
    if start_date:
        count_query = count_query.where(Expense.date >= start_date)
    if end_date:
        count_query = count_query.where(Expense.date <= end_date)
    if category:
        count_query = count_query.where(Expense.category == category)

    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = query.order_by(Expense.date.desc()).offset((page - 1) * size).limit(size)
    result = await db.execute(query)
    expenses = result.scalars().all()

    return ExpenseListResponse(
        expenses=[ExpenseResponse.model_validate(e) for e in expenses],
        total=total,
    )


async def get_expense(db: AsyncSession, expense_id: UUID) -> Expense | None:
    result = await db.execute(select(Expense).where(Expense.id == expense_id))
    return result.scalar_one_or_none()


async def delete_expense(db: AsyncSession, expense_id: UUID) -> bool:
    result = await db.execute(select(Expense).where(Expense.id == expense_id))
    expense = result.scalar_one_or_none()
    if not expense:
        return False
    await db.delete(expense)
    await db.flush()
    return True
