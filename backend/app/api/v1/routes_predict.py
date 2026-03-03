from typing import List
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.ml.model import bundle

router = APIRouter(prefix="/v1", tags=["predict"])

class PredictIn(BaseModel):
    landmarks: List[List[float]] = Field(..., description="21 x 3 list")

class PredictOut(BaseModel):
    label: str
    confidence: float
    classes: List[str]
    probs: List[float]

@router.post("/predict", response_model=PredictOut)
def predict(payload: PredictIn):
    if len(payload.landmarks) != 21 or any(len(p) != 3 for p in payload.landmarks):
        raise HTTPException(status_code=400, detail="landmarks must be 21x3")

    if bundle.model is None:
        raise HTTPException(
            status_code=503,
            detail="Model not loaded. Train first and restart the API.",
        )

    try:
        out = bundle.predict(payload.landmarks)  # now returns dict
        return PredictOut(**out)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {e}")