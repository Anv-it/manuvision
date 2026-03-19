from __future__ import annotations

from typing import Sequence

import numpy as np

from app.ml.features import EPS, featurize, normalize_landmarks

SEQUENCE_LEN = 24
MIN_SEQUENCE_FRAMES = 12
TRAJECTORY_POINTS = (0, 8, 20)


def _to_sequence_array(frames: Sequence[Sequence[Sequence[float]]]) -> np.ndarray:
    arr = np.asarray(frames, dtype=np.float32)
    if arr.ndim != 3 or arr.shape[1:] != (21, 3):
        raise ValueError(f"Expected frames shape (N,21,3), got {arr.shape}")
    if arr.shape[0] < MIN_SEQUENCE_FRAMES:
        raise ValueError(
            f"Expected at least {MIN_SEQUENCE_FRAMES} frames, got {arr.shape[0]}"
        )
    return arr


def _resample_sequence(sequence: np.ndarray, target_len: int = SEQUENCE_LEN) -> np.ndarray:
    if sequence.shape[0] == target_len:
        return sequence.astype(np.float32, copy=False)

    src_idx = np.linspace(0.0, 1.0, num=sequence.shape[0], dtype=np.float32)
    dst_idx = np.linspace(0.0, 1.0, num=target_len, dtype=np.float32)
    out = np.empty((target_len, sequence.shape[1], sequence.shape[2]), dtype=np.float32)

    for point_idx in range(sequence.shape[1]):
        for axis_idx in range(sequence.shape[2]):
            out[:, point_idx, axis_idx] = np.interp(
                dst_idx,
                src_idx,
                sequence[:, point_idx, axis_idx],
            )
    return out


def normalize_sequence(
    frames: Sequence[Sequence[Sequence[float]]],
    handedness: str | None = None,
) -> np.ndarray:
    arr = _to_sequence_array(frames)
    normalized = np.stack(
        [normalize_landmarks(frame, handedness=handedness) for frame in arr],
        axis=0,
    ).astype(np.float32)
    return _resample_sequence(normalized, target_len=SEQUENCE_LEN)


def sequence_motion_energy(
    frames: Sequence[Sequence[Sequence[float]]],
    handedness: str | None = None,
) -> float:
    seq = normalize_sequence(frames, handedness=handedness)
    velocity = np.diff(seq[:, :, :2], axis=0)
    return float(np.linalg.norm(velocity, axis=2).mean())


def featurize_sequence(
    frames: Sequence[Sequence[Sequence[float]]],
    handedness: str | None = None,
) -> np.ndarray:
    seq = normalize_sequence(frames, handedness=handedness)

    key_seq = seq[:, TRAJECTORY_POINTS, :]
    key_velocity = np.diff(key_seq, axis=0)

    path_lengths = np.linalg.norm(key_velocity[:, :, :2], axis=2).sum(axis=0)
    net_displacement = key_seq[-1] - key_seq[0]
    bbox = key_seq.max(axis=0) - key_seq.min(axis=0)

    direction = key_velocity[:, :, :2]
    direction_norm = np.linalg.norm(direction, axis=2, keepdims=True)
    direction_unit = direction / np.maximum(direction_norm, EPS)
    curvature = np.sum(direction_unit[1:] * direction_unit[:-1], axis=2)
    curvature = np.nan_to_num(curvature, nan=0.0, posinf=0.0, neginf=0.0)

    all_velocity = np.diff(seq, axis=0)
    speed_summary = np.array(
        [
            np.linalg.norm(all_velocity[:, :, :2], axis=2).mean(),
            np.linalg.norm(all_velocity[:, :, :2], axis=2).max(),
            np.linalg.norm(all_velocity[:, :, 2], axis=1).mean(),
        ],
        dtype=np.float32,
    )

    final_handshape = featurize(seq[-1], handedness=None)

    feature_parts = [
        key_seq.reshape(-1),
        key_velocity.reshape(-1),
        path_lengths.astype(np.float32),
        net_displacement.reshape(-1).astype(np.float32),
        bbox.reshape(-1).astype(np.float32),
        curvature.reshape(-1).astype(np.float32),
        speed_summary,
        final_handshape.astype(np.float32),
    ]
    return np.concatenate(feature_parts).astype(np.float32)
