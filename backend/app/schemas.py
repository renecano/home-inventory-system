from pydantic import BaseModel
from datetime import datetime


class ProductCreate(BaseModel):
    name: str
    category: str = "General"
    unit: str = "pcs"
    location: str = "Casa"
    min_stock: int = 1
    current_stock: int = 0

class ProductOut(ProductCreate):
    id: int
    active: bool

    class Config:
        from_attributes = True

class MovementCreate(BaseModel):
    product_id: int
    type: str   # IN / OUT / ADJUST
    qty: int
    note: str | None = None

class MovementOut(BaseModel):
    id: int
    product_id: int
    type: str
    qty: int
    note: str | None = None
    created_at: datetime
    user_id: int | None = None

    class Config:
        from_attributes = True


class ShoppingCheckSet(BaseModel):
    checked: bool

class ShoppingCheckOut(BaseModel):
    product_id: int
    checked: bool
    updated_at: datetime

    class Config:
        from_attributes = True


class UserCreate(BaseModel):
    name: str
    pin: str  # 4-6 dígitos

class UserOut(BaseModel):
    id: int
    name: str
    active: bool

    class Config:
        from_attributes = True

class LoginReq(BaseModel):
    name: str
    pin: str

class LoginRes(BaseModel):
    id: int
    name: str

