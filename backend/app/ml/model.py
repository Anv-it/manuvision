from __future__ import annotations

import json
import time
from pathlib import Path

import joblib
import numpy as np

from app.ml.features import featurize

BASE_DIR = Path(__file__).resolve().parents[2]
MODELS_DIR = BASE_DIR / "models"
MODEL_PATH = MODELS_DIR / "model.joblib"
META_PATH = MODELS_DIR / "metadata.json"


class ModelBundle:
    def __init__(self):
        self.model = None
        self.meta = None
        self.classes = None  # authoritative label order for predict_proba
        self.last_latency_ms = None  # <-- add this

    def load(self):
        if not MODEL_PATH.exists() or not META_PATH.exists():
            raise FileNotFoundError("Model artifacts not found. Run training first.")

        self.model = joblib.load(MODEL_PATH)
        self.meta = json.loads(META_PATH.read_text(encoding="utf-8"))

        self.classes = [str(c) for c in getattr(self.model, "classes_", [])]

        if not self.classes:
            self.classes = self.meta.get("classes") or self.meta.get("labels", [])

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


bundle = ModelBundle()