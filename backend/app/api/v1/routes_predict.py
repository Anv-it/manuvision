from typing import List, Literal
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.ml.model import bundle
from app.ml.temporal_features import MIN_SEQUENCE_FRAMES, sequence_motion_energy

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
    source: str = "static"


class PredictSequenceIn(BaseModel):
    frames: List[List[List[float]]] = Field(
        ...,
        description="Sequence of hand landmarks with shape N x 21 x 3",
        min_length=MIN_SEQUENCE_FRAMES,
    )
    handedness: Literal["Left", "Right"] | None = Field(
        default=None,
        description='Optional handedness label from MediaPipe ("Left" or "Right")',
    )


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


@router.post("/predict-sequence", response_model=PredictOut)
def predict_sequence(payload: PredictSequenceIn):
    if any(len(frame) != 21 or any(len(p) != 3 for p in frame) for frame in payload.frames):
        raise HTTPException(status_code=400, detail="frames must be N x 21 x 3")

    if bundle.dynamic_model is None:
        raise HTTPException(
            status_code=503,
            detail="Dynamic model not loaded. Train dynamic model first and restart the API.",
        )

    try:
        out = bundle.predict_sequence(payload.frames, handedness=payload.handedness)
        out["source"] = "dynamic"

        pairs = [
            {"label": label, "prob": float(prob)}
            for label, prob in zip(out["classes"], out["probs"])
        ]
        pairs.sort(key=lambda x: x["prob"], reverse=True)
        out["top_predictions"] = pairs[:3]

        motion_energy = sequence_motion_energy(
            payload.frames,
            handedness=payload.handedness,
        )

        if motion_energy < 0.015:
            out["label"] = "…"
            out["confidence"] = max(0.0, float(out["confidence"]) * 0.5)

        return PredictOut(**out)
    except FileNotFoundError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Sequence prediction failed: {e}")
