from __future__ import annotations

from typing import Iterable, List, Sequence
import numpy as np

EPS = 1e-6

def to_np_landmarks(landmarks: Sequence[Sequence[float]]) -> np.ndarray:
    """
    Convert landmarks to a numpy array of shape (21, 3).
    """
    arr = np.asarray(landmarks, dtype=np.float32)
    if arr.shape != (21,3):
        raise ValueError(f"Expected landmarks shape (21,3), got {arr.shape}")
    return arr

def normalize_landmarks(landmarks_21x3: Sequence[Sequence[float]]) -> np.ndarray:
    """
    Returns normalized landmarks of shape (21,3):
    - translation invariant: subtract wrist (lm0)
    - scale invariant: divide by ||lm9 - lm0||
    """
    lm = to_np_landmarks(landmarks_21x3)

    wrist = lm[0].copy()
    lm = lm - wrist # translation invariance
    # Landmark index 0 = wrist, wrist becomes (0, 0, 0)
    

    scale = np.linalg.norm(lm[9]) # since lm0 is now 0, lm9 is vector from wrist
                                    # Landmark 9 = middle finger MCP joint.
                                    # lm[9] is vector from wrist → middle finger base
    if scale < EPS:
        scale = EPS
    lm = lm / scale # whole hand is normalized | distance(wrist → lm9) = 1

    return lm

def featurize(landmarks_21x3: Sequence[Sequence[float]]) -> np.ndarray:
    """
    Returns feature vector shpe (63,).
    """
    lm_norm = normalize_landmarks(landmarks_21x3)
    return lm_norm.reshape(-1) #(63,) model gets a flat feature vector