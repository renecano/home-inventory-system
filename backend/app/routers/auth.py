from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app import models, schemas

router = APIRouter(prefix="/auth", tags=["Auth"])

@router.post("/login", response_model=schemas.LoginRes)
def login(payload: schemas.LoginReq, db: Session = Depends(get_db)):
    name = payload.name.strip()
    pin = payload.pin.strip()

    u = db.query(models.User).filter(models.User.name == name, models.User.active == True).first()
    if not u:
        raise HTTPException(401, "Usuario o PIN incorrecto")

    if u.pin_hash != models.hash_pin(pin):
        raise HTTPException(401, "Usuario o PIN incorrecto")

    return {"id": u.id, "name": u.name}
