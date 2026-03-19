from typing import List, Literal, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from pathlib import Path

from app.core.db import get_db
from app.core.models import Sample

import json
from fastapi import Response
from sqlalchemy import select

from sqlalchemy import func

router = APIRouter(prefix="/v1", tags=["samples"])

ALLOWED_LABELS = set(list("ABCDEFGHIJKLMNOPQRSTUVWXYZ") + ["NONE"])
BASE_DIR = Path(__file__).resolve().parents[4]
SEQUENCE_DATA_PATH = BASE_DIR / "backend" / "data" / "sequences.ndjson"

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


class SequenceSampleIn(BaseModel):
    label: str = Field(..., examples=["J"])
    frames: List[List[List[float]]] = Field(..., description="N x 21 x 3 list")
    handedness: Optional[Literal["Left", "Right"]] = None
    session_id: Optional[str] = None

    def validate_payload(self):
        if self.label not in ALLOWED_LABELS:
            raise HTTPException(status_code=400, detail=f"Invalid label: {self.label}")
        if len(self.frames) < 12:
            raise HTTPException(status_code=400, detail="frames must contain at least 12 items")
        if any(
            not isinstance(frame, list)
            or len(frame) != 21
            or any(not isinstance(p, list) or len(p) != 3 for p in frame)
            for frame in self.frames
        ):
            raise HTTPException(status_code=400, detail="frames must be N x 21 x 3")


class SequenceSampleOut(BaseModel):
    status: str = "stored"
    path: str
    label: str
    frames: int

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


@router.post("/sequence-samples", response_model=SequenceSampleOut)
def create_sequence_sample(payload: SequenceSampleIn):
    payload.validate_payload()

    SEQUENCE_DATA_PATH.parent.mkdir(parents=True, exist_ok=True)

    record = {
        "label": payload.label,
        "frames": payload.frames,
        "handedness": payload.handedness,
        "session_id": payload.session_id,
    }

    with SEQUENCE_DATA_PATH.open("a", encoding="utf-8") as f:
        f.write(json.dumps(record) + "\n")

    return SequenceSampleOut(
        path=str(SEQUENCE_DATA_PATH),
        label=payload.label,
        frames=len(payload.frames),
    )


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
