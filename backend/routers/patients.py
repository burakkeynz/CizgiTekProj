from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models import Patients
from pydantic import BaseModel

router = APIRouter(
    prefix='/patients',
    tags=['patients']
)


class Patient(BaseModel):
    id: int
    first_name: str
    last_name: str
    tc_no: str
    age: int | None = None
    gender: str | None = None
    diagnosis: str | None = None
    doctor_id: int | None = None

    class Config:
        from_attributes = True

@router.get("/", response_model=list[Patient])
def get_patients(db: Session = Depends(get_db)):
    return db.query(Patients).all()

@router.get("/{id}", response_model=Patient)
def get_patient_detail(id: int, db: Session = Depends(get_db)):
    patient = db.query(Patients).filter_by(id=id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Hasta bulunamadı")
    return patient