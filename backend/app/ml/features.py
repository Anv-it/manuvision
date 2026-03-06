from __future__ import annotations

from typing import Sequence
import numpy as np

EPS = 1e-6

def to_np_landmarks(landmarks: Sequence[Sequence[float]]) -> np.ndarray:
    """
    Convert landmarks to a numpy array of shape (21, 3).
    """
    arr = np.asarray(landmarks, dtype=np.float32)
    if arr.shape != (21, 3):
        raise ValueError(f"Expected landmarks shape (21,3), got {arr.shape}")
    return arr


def normalize_landmarks(
    landmarks_21x3: Sequence[Sequence[float]],
    handedness: str | None = None,
) -> np.ndarray:
    """
    Returns normalized landmarks of shape (21,3):
    - translation invariant: subtract wrist (lm0)
    - handedness canonicalization: mirror left hand across x-axis
    - scale invariant: divide by ||lm9 - lm0||
    """
    lm = to_np_landmarks(landmarks_21x3)

    wrist = lm[0].copy()
    lm = lm - wrist

    # Canonicalize left hand to match right-hand orientation
    if handedness == "Left":
        lm[:, 0] = -lm[:, 0]

    scale = np.linalg.norm(lm[9])
    if scale < EPS:
        scale = EPS
    lm = lm / scale

    return lm


def featurize(
    landmarks_21x3: Sequence[Sequence[float]],
    handedness: str | None = None,
) -> np.ndarray:
    """
    Returns feature vector shape (63,).
    """
    lm_norm = normalize_landmarks(landmarks_21x3, handedness=handedness)
    return lm_norm.reshape(-1)