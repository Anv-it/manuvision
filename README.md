# ManuVision

**ManuVision** is a full-stack sign language recognition system that demonstrates
a production-style machine learning workflow:

data collection → feature engineering → model training → real-time inference.

------------------------------------------------------------------------

# Current Capabilities

## Core ML

- MediaPipe-based 21-point 3D hand landmark tracking
- Translation & scale-invariant feature normalization
- Handedness-aware canonicalization (left hands mirrored to right-hand space)
- 63-dimensional wrist-centered feature vector
- Multiclass Logistic Regression classifier
- Stratified train/test split
- Confusion matrix + classification report
- Model persistence via `joblib`

Current trained classes:
```
A–F
```
## Real-Time Inference

- FastAPI backend serving predictions
- Frontend prediction polling (~5 FPS)
- Rolling probability smoothing
- Confidence gating (threshold-based unlock)
- Top-3 prediction probability visualization
- Live inference telemetry (latency + polling rate)

## Observability

The system exposes runtime model information for debugging and monitoring.

Backend endpoint:

GET /health

Returns:

- model version
- loaded classifier type
- supported classes
- dataset sample count
- backend inference latency

Frontend displays:

- live prediction confidence
- inference latency
- polling rate
- model metadata
- tracker status
- handedness detection

## UI Modes

### Translate Mode

- Live prediction display
- Confidence visualization
- Top-3 prediction probabilities
- Confidence gating (prevents unstable predictions)
- Dataset capture & labeling
- Handedness-aware inference

### Practice Mode

- Target → Attempt → Lock-in evaluation
- Stable prediction detection
- One-attempt-per-round evaluation
- Session tracking (attempts, accuracy)
- Real-time camera reuse (shared MediaPipe pipeline)

Note:
Practice mode only samples from letters currently supported by the trained model.

## Architecture Improvements

- Centralized `HandTracker` component
- Shared camera stream across pages
- Single MediaPipe lifecycle
- Handedness-aware feature canonicalization
- Observability-ready UI layout

## Current Dataset

- ~600 labeled samples
- Balanced across A–F classes
- Stored in Postgres and exported to NDJSON for training

------------------------------------------------------------------------

# ML Pipeline

## Feature Engineering

Each frame produces 21 3D landmarks.

Preprocessing pipeline:

1. **Translation invariance**
   - Subtract wrist landmark (LM0)

2. **Scale invariance**
   - Normalize by wrist → middle MCP distance (LM0 → LM9)

3. **Handedness canonicalization**
   - Left hands are mirrored to match right-hand coordinate space

4. **Flatten**
   - 21 × 3 → 63-dimensional feature vector

This makes predictions robust to:

- Camera position
- Hand distance
- Minor translations
- Left vs right hand usage

------------------------------------------------------------------------

## Model

- Logistic Regression (multiclass)
- Probability outputs used for smoothing
- Rolling window averaging (frontend)
- Confidence threshold gating
- Top-k probability exposure for UI debugging

Artifacts:
```
backend/models/

model.joblib  
metadata.json
```

------------------------------------------------------------------------

# Architecture

## Frontend

-   React (Vite)
-   TailwindCSS
-   Centralized HandTracker
-   Axios polling
-   Prediction smoothing + gating
-   Two-mode UI (Translate / Practice)

## Backend

-   FastAPI
-   SQLAlchemy ORM
-   Pydantic validation

Endpoints:

-   POST /v1/predict
-   POST /v1/samples
-   GET /v1/samples/export
-   GET /v1/samples/stats
-   GET /health

## Database

-   Dockerized Postgres 16
-   `samples` table storing:
    -   Aggregated landmarks
    -   Label
    -   Session ID

------------------------------------------------------------------------

# Project Structure
```
manuvision/
│
├── frontend/
│   └── src/
│       ├── components/
│       │   ├── HandTracker.jsx
│       │   └── Layout.jsx
│       ├── pages/
│       │   ├── Translate.jsx
│       │   └── Practice.jsx
│       └── App.jsx
│
├── backend/
│   ├── app/
│   │   ├── api/
│   │   ├── core/
│   │   ├── ml/
│   │   │   ├── features.py
│   │   │   └── model.py
│   │   └── main.py
│   │
│   ├── scripts/
│   │   └── train.py
│   │
│   └── models/
│
├── docker-compose.yml
└── README.md
```
------------------------------------------------------------------------

# Setup

## 1. Clone
```
git clone `https://github.com/Anv-it/manuvision`{=html} 
cd manuvision
```
## 2. Start Postgres
```
docker compose up -d
```
## 3. Backend
```
cd backend 
python -m venv .venv 
source .venv/bin/activate 
pip install -r requirements.txt 
uvicorn app.main:app --reload
```
Runs on: http://localhost:8000

## 4. Frontend
```
cd frontend 
npm install 
npm run dev
```
Runs on: http://localhost:5173

------------------------------------------------------------------------

# Training Workflow

1. Capture labeled samples via **Translate Mode**

2. Train model
```
python -m backend.scripts.train
```
The training script automatically:

- Fetches the latest dataset from the API  
- Saves a fresh NDJSON snapshot to `backend/data/samples.ndjson`  
- Trains the classifier  
- Writes updated artifacts to `backend/models/`

3. Restart backend

------------------------------------------------------------------------

# 🔎 Health Check
```
curl http://localhost:8000/health
```
Returns:
```
{
"status": "ok",
"model_name": "LogisticRegression",
"model_version": "0.1",
"classes": ["A","B","C","D","E","F"],
"samples": 599
}
```
------------------------------------------------------------------------

# Roadmap

- Full ASL alphabet coverage (A–Z)
- Per-letter performance tracking
- Confusion matrix visualization dashboard
- Dark mode + UI polish
- Model retraining from UI
- Alternative models (Random Forest / XGBoost)
- Dynamic sign recognition (sequence models: LSTM / TCN)