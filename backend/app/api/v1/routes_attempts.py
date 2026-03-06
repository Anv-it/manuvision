from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.models import Attempt

router = APIRouter(prefix="/v1/attempts", tags=["attempts"])


@router.post("")
def log_attempt(payload: dict, db: Session = Depends(get_db)):

    attempt = Attempt(
        target_label=payload.get("target_label"),
        predicted_label=payload.get("predicted_label"),
        confidence=payload.get("confidence"),
        correct=payload.get("correct"),
        session_id=payload.get("session_id"),
    )

    db.add(attempt)
    db.commit()
    db.refresh(attempt)

    return {"id": attempt.id}