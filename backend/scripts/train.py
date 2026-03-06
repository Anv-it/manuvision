from __future__ import annotations

import json
from pathlib import Path
import numpy as np

from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.model_selection import StratifiedKFold, cross_val_score
from sklearn.metrics import accuracy_score, confusion_matrix, classification_report
import joblib

from backend.app.ml.features import featurize

import os, urllib.request

EXPORT_URL = os.getenv("EXPORT_URL", "http://localhost:8000/v1/samples/export?format=ndjson")

DATA_PATH = Path("backend/data/samples.ndjson")
OUT_DIR = Path("backend/models")
OUT_DIR.mkdir(parents=True, exist_ok=True)

def load_ndjson(path: Path):
    rows = []
    with path.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            rows.append(json.loads(line))
    return rows

def build_xy(rows):
    X = []
    y = []
    for r in rows:
        label = r.get("label")
        landmarks = r.get("landmarks")
        handedness = r.get("handedness")
        if label is None or landmarks is None:
            continue
        X.append(featurize(landmarks, handedness=handedness))
        y.append(label)
    X = np.stack(X).astype(np.float32)
    y = np.array(y)
    return X, y

def main():
    if not DATA_PATH.exists():
        print(f"Missing {DATA_PATH}. Fetching from API: {EXPORT_URL}")
        DATA_PATH.parent.mkdir(parents=True, exist_ok=True)
        with urllib.request.urlopen(EXPORT_URL) as resp:
            DATA_PATH.write_bytes(resp.read())

    rows = load_ndjson(DATA_PATH)
    X, y = build_xy(rows)

    if len(y) < 10:
        raise SystemExit(f"Not enough samples ({len(y)}). Collect more first.")
    
    labels = sorted(set(y.tolist()))
    print("Samples:", len(y))
    print("Labels:", labels)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y if len(labels) > 1 else None
    )

    model = LogisticRegression(
        max_iter=2000,
    )

    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)

    acc = accuracy_score(y_test, y_pred)
    print("\nAccuracy:", round(float(acc), 4))
    print("\nConfusion matrix:\n", confusion_matrix(y_test, y_pred, labels=labels))
    print("\nReport:\n", classification_report(y_test, y_pred))

    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    scores = cross_val_score(model, X, y, cv=cv)
    print("CV accuracy:", scores, "mean:", scores.mean())

    joblib.dump(model, OUT_DIR / "model.joblib")

    metadata = {
        "model_version": "0.1",
        "classes": labels,
        "samples": int(len(y)),
        "feature_version": "v1_wrist_centered_scaled_by_0_to_9_flat63",
        "model_type": "LogisticRegression",
    }
    (OUT_DIR / "metadata.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")

    print(f"\nSaved: {OUT_DIR / 'model.joblib'}")
    print(f"Saved: {OUT_DIR / 'metadata.json'}")

if __name__ == "__main__":
    main()