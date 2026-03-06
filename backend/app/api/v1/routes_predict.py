from typing import List, Literal
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.ml.model import bundle

router = APIRouter(prefix="/v1", tags=["predict"])


class PredictIn(BaseModel):
    landmarks: List[List[float]] = Field(..., description="21 x 3 list")
    handedness: Literal["Left", "Right"] | None = Field(
        default=None,
        description='Optional handedness label from MediaPipe ("Left" or "Right")',
    )


class TopPrediction(BaseModel):
    label: str
    prob: float


class PredictOut(BaseModel):
    label: str
    confidence: float
    classes: List[str]
    probs: List[float]
    top_predictions: List[TopPrediction]
    latency_ms: float | None = None


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
        out = bundle.predict(payload.landmarks, handedness=payload.handedness)

        pairs = [
            {"label": label, "prob": float(prob)}
            for label, prob in zip(out["classes"], out["probs"])
        ]
        pairs.sort(key=lambda x: x["prob"], reverse=True)

        out["top_predictions"] = pairs[:3]

        return PredictOut(**out)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {e}")