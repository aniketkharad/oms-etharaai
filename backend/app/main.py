import time
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, select
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from . import models
from .config import get_settings
from .database import Base, engine, get_db
from .routers import customers, orders, products

settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    """Create tables on startup, retrying while PostgreSQL boots.

    (Simple and sufficient for this assessment; a long-lived production
    system would manage schema changes with Alembic migrations.)
    """
    for attempt in range(10):
        try:
            Base.metadata.create_all(bind=engine)
            break
        except OperationalError:
            if attempt == 9:
                raise
            time.sleep(2)
    yield


app = FastAPI(
    lifespan=lifespan,
    title=settings.app_name,
    version="1.0.0",
    description=(
        "Production-ready containerized Inventory & Order Management System. "
        "Manages products, customers, orders, and inventory levels."
    ),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(products.router)
app.include_router(customers.router)
app.include_router(orders.router)

LOW_STOCK_THRESHOLD = 5


@app.get("/", tags=["Health"])
def root():
    return {"service": settings.app_name, "status": "ok", "docs": "/docs"}


@app.get("/health", tags=["Health"])
def health():
    return {"status": "healthy"}


@app.get("/stats", tags=["Dashboard"])
def stats(db: Session = Depends(get_db)):
    """Summary numbers for the frontend dashboard."""
    total_products = db.scalar(select(func.count(models.Product.id))) or 0
    total_customers = db.scalar(select(func.count(models.Customer.id))) or 0
    total_orders = db.scalar(select(func.count(models.Order.id))) or 0
    low_stock = db.scalars(
        select(models.Product)
        .where(models.Product.quantity <= LOW_STOCK_THRESHOLD)
        .order_by(models.Product.quantity)
    ).all()
    return {
        "total_products": total_products,
        "total_customers": total_customers,
        "total_orders": total_orders,
        "low_stock_threshold": LOW_STOCK_THRESHOLD,
        "low_stock_products": [
            {"id": p.id, "name": p.name, "sku": p.sku, "quantity": p.quantity}
            for p in low_stock
        ],
    }
