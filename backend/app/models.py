from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship
from app.db import Base
import hashlib

class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    category = Column(String, nullable=False)
    unit = Column(String, nullable=False)
    location = Column(String, nullable=False)
    min_stock = Column(Integer, nullable=False, default=0)
    current_stock = Column(Integer, nullable=False, default=0)
    active = Column(Boolean, nullable=False, default=True)

    movements = relationship("Movement", back_populates="product")


class Movement(Base):
    __tablename__ = "movements"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)

    # "consume" o "restock"
    type = Column(String, nullable=False)
    qty = Column(Integer, nullable=False)

    note = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    product = relationship("Product", back_populates="movements")
    user = relationship("User", back_populates="movements")



class ShoppingCheck(Base):
    __tablename__ = "shopping_checks"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False, unique=True)

    checked = Column(Boolean, nullable=False, default=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    product = relationship("Product")

# --- User ---
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, unique=True)
    pin_hash = Column(String, nullable=False)
    active = Column(Boolean, nullable=False, default=True)

    movements = relationship("Movement", back_populates="user")

def hash_pin(pin: str) -> str:
    # simple para demo/familia (mejorable a bcrypt después)
    return hashlib.sha256(pin.encode("utf-8")).hexdigest()