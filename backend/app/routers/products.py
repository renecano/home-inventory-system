from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app import models, schemas

router = APIRouter(prefix="/products", tags=["Products"])


@router.post("", response_model=schemas.ProductOut)
def create_product(payload: schemas.ProductCreate, db: Session = Depends(get_db)):
    product = models.Product(**payload.model_dump())
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


@router.get("", response_model=list[schemas.ProductOut])
def list_products(db: Session = Depends(get_db)):
    return (
        db.query(models.Product)
        .filter(models.Product.active == True)
        .order_by(models.Product.name)
        .all()
    )


@router.get("/low", response_model=list[schemas.ProductOut])
def low_stock(db: Session = Depends(get_db)):
    return (
        db.query(models.Product)
        .filter(models.Product.active == True)
        .filter(models.Product.current_stock <= models.Product.min_stock)
        .order_by(models.Product.name)
        .all()
    )



@router.post("/{product_id}/consume", response_model=schemas.ProductOut)
def consume(product_id: int, qty: int = 1, user_id: int | None = None, db: Session = Depends(get_db)):
    p = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not p:
        raise HTTPException(404, "Producto no existe")
    if qty < 1:
        raise HTTPException(400, "qty inválido")

    p.current_stock = max(0, p.current_stock - qty)

    m = models.Movement(product_id=p.id, type="consume", qty=qty, user_id=user_id)
    db.add(m)

    db.commit()
    db.refresh(p)
    return p


@router.post("/{product_id}/restock", response_model=schemas.ProductOut)
def restock(
    product_id: int,
    qty: int = 1,
    user_id: int | None = None,
    db: Session = Depends(get_db),
):
    p = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not p:
        raise HTTPException(404, "Producto no existe")
    if qty < 1:
        raise HTTPException(400, "qty inválido")

    p.current_stock += qty

    m = models.Movement(product_id=p.id, type="restock", qty=qty, user_id=user_id)
    db.add(m)

    db.commit()
    db.refresh(p)
    return p


@router.put("/{product_id}", response_model=schemas.ProductOut)
def update_product(product_id: int, payload: schemas.ProductCreate, db: Session = Depends(get_db)):
    p = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not p:
        raise HTTPException(404, "Producto no existe")

    for key, value in payload.model_dump().items():
        setattr(p, key, value)

    db.commit()
    db.refresh(p)
    return p

@router.delete("/{product_id}")
def delete_product(product_id: int, db: Session = Depends(get_db)):
    p = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not p:
        raise HTTPException(404, "Producto no existe")

    p.active = False
    db.commit()
    return {"ok": True}

