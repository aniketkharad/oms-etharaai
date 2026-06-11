"""Pydantic schemas — all request data is validated before it touches the DB."""
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


# ---------------------------------------------------------------- Products
class ProductBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    sku: str = Field(..., min_length=1, max_length=64)
    price: Decimal = Field(..., ge=0, decimal_places=2)
    quantity: int = Field(..., ge=0)

    @field_validator("name", "sku")
    @classmethod
    def strip_whitespace(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("must not be blank")
        return v


class ProductCreate(ProductBase):
    pass


class ProductUpdate(BaseModel):
    """Partial update — only supplied fields are changed."""
    name: str | None = Field(None, min_length=1, max_length=200)
    sku: str | None = Field(None, min_length=1, max_length=64)
    price: Decimal | None = Field(None, ge=0, decimal_places=2)
    quantity: int | None = Field(None, ge=0)


class ProductOut(ProductBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime


# ---------------------------------------------------------------- Customers
class CustomerBase(BaseModel):
    full_name: str = Field(..., min_length=1, max_length=200)
    email: EmailStr
    phone: str = Field(..., min_length=5, max_length=32)

    @field_validator("full_name", "phone")
    @classmethod
    def strip_whitespace(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("must not be blank")
        return v


class CustomerCreate(CustomerBase):
    pass


class CustomerOut(CustomerBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime


# ---------------------------------------------------------------- Orders
class OrderItemIn(BaseModel):
    product_id: int = Field(..., ge=1)
    quantity: int = Field(..., ge=1)


class OrderCreate(BaseModel):
    customer_id: int = Field(..., ge=1)
    items: list[OrderItemIn] = Field(..., min_length=1)

    @field_validator("items")
    @classmethod
    def no_duplicate_products(cls, items: list[OrderItemIn]) -> list[OrderItemIn]:
        ids = [i.product_id for i in items]
        if len(ids) != len(set(ids)):
            raise ValueError("duplicate product_id in items — merge quantities instead")
        return items


class OrderItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    product_id: int
    quantity: int
    unit_price: Decimal
    subtotal: Decimal
    product_name: str | None = None


class OrderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    customer_id: int
    total_amount: Decimal
    status: str
    created_at: datetime
    items: list[OrderItemOut] = []
    customer_name: str | None = None
