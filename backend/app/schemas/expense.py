from datetime import date, datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class ExpenseCreate(BaseModel):
    item_name: str
    amount: float
    category: str
    photo_url: Optional[str] = None
    description: Optional[str] = None
    date: date


class ExpenseResponse(BaseModel):
    id: UUID
    user_id: UUID
    item_name: str
    amount: float
    category: str
    photo_url: Optional[str] = None
    description: Optional[str] = None
    date: date
    created_at: datetime

    model_config = {"from_attributes": True}


class ExpenseListResponse(BaseModel):
    expenses: list[ExpenseResponse]
    total: int
