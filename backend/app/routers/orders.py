"""Order endpoints.

The critical business logic lives in create_order():
  1. Validate the customer exists.
  2. Lock all referenced product rows (SELECT ... FOR UPDATE) so two
     simultaneous orders can't both consume the same stock.
  3. Verify sufficient stock for every line item — fail atomically with 409
     and a precise message if any product falls short.
  4. Deduct stock, compute subtotals and the order total ON THE BACKEND
     (client-supplied totals are never trusted), persist everything in one
     transaction.
Cancelling an order (DELETE) restores stock inside the same kind of
transaction, then removes the order.
"""
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/orders", tags=["Orders"])


def _serialize(order: models.Order) -> schemas.OrderOut:
    out = schemas.OrderOut.model_validate(order)
    out.customer_name = order.customer.full_name if order.customer else None
    for item_out, item in zip(out.items, order.items):
        item_out.product_name = item.product.name if item.product else None
    return out


@router.post("", response_model=schemas.OrderOut, status_code=status.HTTP_201_CREATED)
def create_order(payload: schemas.OrderCreate, db: Session = Depends(get_db)):
    customer = db.get(models.Customer, payload.customer_id)
    if customer is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Customer {payload.customer_id} not found",
        )

    product_ids = [item.product_id for item in payload.items]

    # Row-level lock: holds these product rows until commit/rollback,
    # preventing concurrent orders from overselling the same stock.
    products = db.scalars(
        select(models.Product)
        .where(models.Product.id.in_(product_ids))
        .with_for_update()
    ).all()
    products_by_id = {p.id: p for p in products}

    missing = [pid for pid in product_ids if pid not in products_by_id]
    if missing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product(s) not found: {missing}",
        )

    # Validate stock for every line before touching anything.
    shortages = []
    for item in payload.items:
        product = products_by_id[item.product_id]
        if product.quantity < item.quantity:
            shortages.append(
                f"'{product.name}' (requested {item.quantity}, in stock {product.quantity})"
            )
    if shortages:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Insufficient stock for: " + "; ".join(shortages),
        )

    # Deduct stock and build line items; total computed server-side.
    order = models.Order(customer_id=customer.id, total_amount=Decimal("0"))
    total = Decimal("0")
    for item in payload.items:
        product = products_by_id[item.product_id]
        product.quantity -= item.quantity
        unit_price = Decimal(product.price)
        subtotal = unit_price * item.quantity
        total += subtotal
        order.items.append(
            models.OrderItem(
                product_id=product.id,
                quantity=item.quantity,
                unit_price=unit_price,
                subtotal=subtotal,
            )
        )
    order.total_amount = total

    db.add(order)
    db.commit()

    order = db.scalars(
        select(models.Order)
        .options(
            selectinload(models.Order.items).selectinload(models.OrderItem.product),
            selectinload(models.Order.customer),
        )
        .where(models.Order.id == order.id)
    ).one()
    return _serialize(order)


@router.get("", response_model=list[schemas.OrderOut])
def list_orders(db: Session = Depends(get_db)):
    orders = db.scalars(
        select(models.Order)
        .options(
            selectinload(models.Order.items).selectinload(models.OrderItem.product),
            selectinload(models.Order.customer),
        )
        .order_by(models.Order.id.desc())
    ).all()
    return [_serialize(o) for o in orders]


@router.get("/{order_id}", response_model=schemas.OrderOut)
def get_order(order_id: int, db: Session = Depends(get_db)):
    order = db.scalars(
        select(models.Order)
        .options(
            selectinload(models.Order.items).selectinload(models.OrderItem.product),
            selectinload(models.Order.customer),
        )
        .where(models.Order.id == order_id)
    ).one_or_none()
    if order is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Order {order_id} not found",
        )
    return _serialize(order)


@router.delete("/{order_id}", status_code=status.HTTP_204_NO_CONTENT)
def cancel_order(order_id: int, db: Session = Depends(get_db)):
    order = db.scalars(
        select(models.Order)
        .options(selectinload(models.Order.items))
        .where(models.Order.id == order_id)
    ).one_or_none()
    if order is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Order {order_id} not found",
        )

    # Restore stock atomically (lock the affected products first).
    product_ids = [i.product_id for i in order.items]
    if product_ids:
        products = db.scalars(
            select(models.Product)
            .where(models.Product.id.in_(product_ids))
            .with_for_update()
        ).all()
        by_id = {p.id: p for p in products}
        for item in order.items:
            if item.product_id in by_id:
                by_id[item.product_id].quantity += item.quantity

    db.delete(order)
    db.commit()
