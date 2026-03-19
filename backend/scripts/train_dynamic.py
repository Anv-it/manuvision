from __future__ import annotations

import json
import os
from pathlib import Path

import joblib
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
from sklearn.model_selection import StratifiedKFold, cross_val_score, train_test_split

from backend.app.ml.dynamic_classifier import DynamicSequenceClassifier
from backend.app.ml.temporal_features import featurize_sequence

REPO_ROOT = Path(__file__).resolve().parents[2]
DATA_PATH = Path(
    os.getenv("DYNAMIC_DATA_PATH", str(REPO_ROOT / "backend" / "data" / "sequences.ndjson"))
)
OUT_DIR = REPO_ROOT / "backend" / "models"
OUT_DIR.mkdir(parents=True, exist_ok=True)
MODEL_PATH = OUT_DIR / "dynamic_model.joblib"
META_PATH = OUT_DIR / "dynamic_metadata.json"
MODEL_TYPE = os.getenv("DYNAMIC_MODEL_TYPE", "auto").lower()
RNG_SEED = int(os.getenv("TRAIN_SEED", "42"))


def load_ndjson(path: Path):
    if not path.exists():
        raise FileNotFoundError(
            f"Dynamic sequence dataset not found at {path}. "
            "Create backend/data/sequences.ndjson first."
        )

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

    for row in rows:
        label = row.get("label")
        frames = row.get("frames")
        handedness = row.get("handedness")

        if label is None or frames is None:
            continue

        X.append(featurize_sequence(frames, handedness=handedness))
        y.append(label)

    if not X:
        raise ValueError("No valid dynamic sequence samples found.")

    return np.stack(X).astype(np.float32), np.array(y)


def build_model():
    if MODEL_TYPE in {"xgboost", "auto"}:
        try:
            from xgboost import XGBClassifier

            return XGBClassifier(
                n_estimators=300,
                max_depth=5,
                learning_rate=0.05,
                subsample=0.9,
                colsample_bytree=0.9,
                objective="multi:softprob",
                eval_metric="mlogloss",
                random_state=RNG_SEED,
            )
        except ImportError:
            if MODEL_TYPE == "xgboost":
                raise

    return RandomForestClassifier(
        n_estimators=300,
        max_depth=18,
        min_samples_leaf=2,
        random_state=RNG_SEED,
    )


def main():
    rows = load_ndjson(DATA_PATH)
    X, y = build_xy(rows)

    if len(y) < 20:
        raise SystemExit(
            f"Not enough dynamic sequences ({len(y)}). Collect more first."
        )

    labels = sorted(set(y.tolist()))
    print("Dynamic samples:", len(y))
    print("Dynamic labels:", labels)

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.2,
        random_state=RNG_SEED,
        stratify=y if len(labels) > 1 else None,
    )

    base_model = build_model()
    model = DynamicSequenceClassifier(base_model)
    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)
    acc = accuracy_score(y_test, y_pred)
    print("\nDynamic accuracy:", round(float(acc), 4))
    print("\nDynamic confusion matrix:\n", confusion_matrix(y_test, y_pred, labels=labels))
    print("\nDynamic report:\n", classification_report(y_test, y_pred))

    unique_labels, label_counts = np.unique(y, return_counts=True)
    min_class_count = int(label_counts.min()) if len(unique_labels) > 0 else 0
    if min_class_count >= 2:
        folds = min(5, min_class_count)
        scores = cross_val_score(
            DynamicSequenceClassifier(build_model()),
            X,
            y,
            cv=StratifiedKFold(n_splits=folds, shuffle=True, random_state=RNG_SEED),
        )
        print("Dynamic CV accuracy:", scores, "mean:", scores.mean())
    else:
        print("Dynamic CV accuracy: skipped (need at least 2 samples per class).")

    joblib.dump(model, MODEL_PATH)

    metadata = {
        "model_version": "0.1",
        "classes": labels,
        "samples": int(len(y)),
        "feature_version": "v1_temporal_resampled24_keypoints_0_8_20_plus_final_handshape",
        "model_type": type(base_model).__name__,
        "sequence_length": 24,
        "dataset_path": str(DATA_PATH),
    }
    META_PATH.write_text(json.dumps(metadata, indent=2), encoding="utf-8")

    print(f"\nSaved dynamic model to {MODEL_PATH}")
    print(f"Saved dynamic metadata to {META_PATH}")


if __name__ == "__main__":
    main()
