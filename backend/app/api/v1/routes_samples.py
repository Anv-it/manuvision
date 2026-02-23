from typing import List, Literal, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.models import Sample

import json
from fastapi import Response
from sqlalchemy import select

from sqlalchemy import func

router = APIRouter(prefix="/v1", tags=["samples"])

ALLOWED_LABELS = set(list("ABCDEFGHIJKLMNOPQRSTUVWXYZ") + ["NONE"])

class SampleIn(BaseModel):
    label: str = Field(..., examples=["G"])
    landmarks: List[List[float]] = Field(..., description="21 x 3 list")
    handedness: Optional[Literal["Left", "Right"]] = None
    session_id: Optional[str] = None

    @staticmethod
    def _shape_ok(landmarks: List[List[float]]) -> bool:
        return (
            isinstance(landmarks, list)
            and len(landmarks) == 21
            and all(isinstance(p, list) and len(p) == 3 for p in landmarks)
        )

    def validate_payload(self):
        if self.label not in ALLOWED_LABELS:
            raise HTTPException(status_code=400, detail=f"Invalid label: {self.label}")
        if not self._shape_ok(self.landmarks):
            raise HTTPException(status_code=400, detail="landmarks must be 21x3")

class SampleOut(BaseModel):
    id: int
    status: str = "stored"

@router.post("/samples", response_model=SampleOut)
def create_sample(payload: SampleIn, db: Session = Depends(get_db)):
    payload.validate_payload()

    row = Sample(
        label=payload.label,
        landmarks_raw=payload.landmarks,
        handedness=payload.handedness,
        session_id=payload.session_id,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return SampleOut(id=row.id)


@router.get("/samples/export")
def export_samples(format: str = "ndjson", db: Session = Depends(get_db)):
    if format.lower() != "ndjson":
        raise HTTPException(status_code=400, detail="Only format=ndjson supported for now")

    rows = db.execute(
        select(
            Sample.id,
            Sample.label,
            Sample.landmarks_raw,
            Sample.handedness,
            Sample.session_id,
            Sample.created_at,
        )
        .where(Sample.is_valid == True)  # noqa: E712
        .order_by(Sample.id.asc())
    ).all()

    lines = []
    for r in rows:
        lines.append(json.dumps({
            "id": r.id,
            "label": r.label,
            "landmarks": r.landmarks_raw,
            "handedness": r.handedness,
            "session_id": r.session_id,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }))

    body = "\n".join(lines) + ("\n" if lines else "")
    return Response(content=body, media_type="application/x-ndjson")


@router.get("/samples/stats")
def sample_stats(db: Session = Depends(get_db)):
    rows = (
        db.query(Sample.label, func.count(Sample.id))
        .filter(Sample.is_valid == True)  # noqa: E712
        .group_by(Sample.label)
        .all()
    )
    return {"counts": {label: count for label, count in rows}}

@router.get("/samples/recent")
def recent_samples(limit: int = 20, db: Session = Depends(get_db)):
    limit = max(1, min(limit, 200))
    rows = (
        db.query(Sample.id, Sample.label, Sample.created_at, Sample.session_id)
        .order_by(Sample.id.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": r.id,
            "label": r.label,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "session_id": r.session_id,
        }
        for r in rows
    ]