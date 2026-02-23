from typing import List
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter(prefix="/v1", tags=["predict"])

class PredictIn(BaseModel):
    landmarks: List[List[float]] = Field(..., description="21 x 3 list")

class PredictOut(BaseModel):
    label: str
    confidence: float

@router.post("/predict", response_model=PredictOut)
def predict(payload: PredictIn):
    if len(payload.landmarks) != 21 or any(len(p) != 3 for p in payload.landmarks):
        raise HTTPException(status_code=400, detail="landmarks must be 21x3")

    # Sprint 2 placeholder: always return A like before
    return PredictOut(label="A", confidence=0.85)