from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app import models, schemas

router = APIRouter(prefix="/shopping", tags=["Shopping"])

@router.get("/checks", response_model=list[schemas.ShoppingCheckOut])
def get_checks(db: Session = Depends(get_db)):
    return db.query(models.ShoppingCheck).all()

@router.put("/checks/{product_id}", response_model=schemas.ShoppingCheckOut)
def set_check(product_id: int, payload: schemas.ShoppingCheckSet, db: Session = Depends(get_db)):
    # valida que el producto exista
    p = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not p:
        raise HTTPException(404, "Producto no existe")

    row = db.query(models.ShoppingCheck).filter(models.ShoppingCheck.product_id == product_id).first()
    if not row:
        row = models.ShoppingCheck(product_id=product_id, checked=payload.checked)
        db.add(row)
    else:
        row.checked = payload.checked

    db.commit()
    db.refresh(row)
    return row
