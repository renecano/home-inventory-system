from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app import models, schemas

router = APIRouter(prefix="/movements", tags=["Movements"])


@router.get("", response_model=list[schemas.MovementOut])
def list_movements(limit: int = 50, db: Session = Depends(get_db)):
    return (
        db.query(models.Movement)
        .order_by(models.Movement.created_at.desc())
        .limit(limit)
        .all()
    )


@router.get("/product/{product_id}", response_model=list[schemas.MovementOut])
def list_product_movements(product_id: int, limit: int = 50, db: Session = Depends(get_db)):
    return (
        db.query(models.Movement)
        .filter(models.Movement.product_id == product_id)
        .order_by(models.Movement.created_at.desc())
        .limit(limit)
        .all()
    )
