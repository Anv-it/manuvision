from __future__ import annotations

import json
from pathlib import Path
import numpy as np
import joblib

from app.ml.features import featurize

BASE_DIR = Path(__file__).resolve().parents[2]
MODELS_DIR = BASE_DIR / "models"
MODEL_PATH = MODELS_DIR / "model.joblib"
META_PATH = MODELS_DIR / "metadata.json"

class ModelBundle:
    def __init__(self):
        self.model = None
        self.labels = None

    def load(self):
        if not MODEL_PATH.exists() or not META_PATH.exists():
            raise FileNotFoundError("Model artifacts not found. Run training first.")
        self.model = joblib.load(MODEL_PATH)
        meta = json.loads(META_PATH.read_text(encoding="utf-8"))
        self.labels = meta["labels"]

    def predict(self, landmarks_21x3):
        x = featurize(landmarks_21x3).reshape(1, -1)  # (1,63)
        probs = self.model.predict_proba(x)[0]
        idx = int(np.argmax(probs))
        return self.labels[idx], float(probs[idx]), probs.tolist()

bundle = ModelBundle()