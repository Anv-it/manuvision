from __future__ import annotations

import json
import time
from pathlib import Path

import joblib
import numpy as np

from app.ml.features import featurize
from app.ml.temporal_features import featurize_sequence

BASE_DIR = Path(__file__).resolve().parents[2]
MODELS_DIR = BASE_DIR / "models"
MODEL_PATH = MODELS_DIR / "model.joblib"
META_PATH = MODELS_DIR / "metadata.json"
DYNAMIC_MODEL_PATH = MODELS_DIR / "dynamic_model.joblib"
DYNAMIC_META_PATH = MODELS_DIR / "dynamic_metadata.json"


class ModelBundle:
    def __init__(self):
        self.model = None
        self.meta = None
        self.classes = None  # authoritative label order for predict_proba
        self.last_latency_ms = None  # <-- add this
        self.dynamic_model = None
        self.dynamic_meta = None
        self.dynamic_classes = None
        self.last_dynamic_latency_ms = None

    def load(self):
        if not MODEL_PATH.exists() or not META_PATH.exists():
            raise FileNotFoundError("Model artifacts not found. Run training first.")

        self.model = joblib.load(MODEL_PATH)
        self.meta = json.loads(META_PATH.read_text(encoding="utf-8"))

        self.classes = [str(c) for c in getattr(self.model, "classes_", [])]

        if not self.classes:
            self.classes = self.meta.get("classes") or self.meta.get("labels", [])

        if DYNAMIC_MODEL_PATH.exists() and DYNAMIC_META_PATH.exists():
            self.dynamic_model = joblib.load(DYNAMIC_MODEL_PATH)
            self.dynamic_meta = json.loads(
                DYNAMIC_META_PATH.read_text(encoding="utf-8")
            )
            self.dynamic_classes = [
                str(c) for c in getattr(self.dynamic_model, "classes_", [])
            ]
            if not self.dynamic_classes:
                self.dynamic_classes = self.dynamic_meta.get("classes") or []
        else:
            self.dynamic_model = None
            self.dynamic_meta = None
            self.dynamic_classes = None

    def predict(self, landmarks_21x3, handedness=None):
        start = time.perf_counter() 

        x = featurize(landmarks_21x3, handedness=handedness).reshape(1, -1)  # (1,63)
        probs = self.model.predict_proba(x)[0]         # shape: (num_classes,)

        idx = int(np.argmax(probs))
        label = self.classes[idx] if self.classes else None
        conf = float(probs[idx])

        latency_ms = (time.perf_counter() - start) * 1000
        self.last_latency_ms = round(latency_ms, 2)  # store latest latency

        return {
            "label": label,
            "confidence": conf,
            "classes": self.classes,
            "probs": probs.tolist(),
            "latency_ms": self.last_latency_ms,  
        }

    def predict_sequence(self, frames_21x3, handedness=None):
        if self.dynamic_model is None:
            raise FileNotFoundError(
                "Dynamic model artifacts not found. Train dynamic model first."
            )

        start = time.perf_counter()
        x = featurize_sequence(frames_21x3, handedness=handedness).reshape(1, -1)
        probs = self.dynamic_model.predict_proba(x)[0]

        idx = int(np.argmax(probs))
        label = self.dynamic_classes[idx] if self.dynamic_classes else None
        conf = float(probs[idx])

        latency_ms = (time.perf_counter() - start) * 1000
        self.last_dynamic_latency_ms = round(latency_ms, 2)

        return {
            "label": label,
            "confidence": conf,
            "classes": self.dynamic_classes,
            "probs": probs.tolist(),
            "latency_ms": self.last_dynamic_latency_ms,
        }


bundle = ModelBundle()
