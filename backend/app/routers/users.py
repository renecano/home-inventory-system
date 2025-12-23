from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app import models, schemas

router = APIRouter(prefix="/users", tags=["Users"])

@router.post("", response_model=schemas.UserOut)
def create_user(payload: schemas.UserCreate, db: Session = Depends(get_db)):
    name = payload.name.strip()
    pin = payload.pin.strip()

    if not name:
        raise HTTPException(400, "Falta el nombre")
    if not pin.isdigit() or len(pin) < 4 or len(pin) > 6:
        raise HTTPException(400, "PIN inválido (4 a 6 dígitos)")

    exists = db.query(models.User).filter(models.User.name == name).first()
    if exists:
        raise HTTPException(400, "Ese usuario ya existe")

    u = models.User(name=name, pin_hash=models.hash_pin(pin))
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


@router.get("", response_model=list[schemas.UserOut])
def list_users(db: Session = Depends(get_db)):
    return db.query(models.User).filter(models.User.active == True).order_by(models.User.name).all()
