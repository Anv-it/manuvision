# ManuVision

**ManuVision** is a production-style Sign Language Recognition platform
built with a modular ML + API + frontend architecture.

The system supports real-time ASL letter recognition, dataset capture,
and interactive training --- powered by a centralized hand-tracking
pipeline and a normalized feature-based classifier.

------------------------------------------------------------------------

# Current Capabilities

## Core ML

-   MediaPipe-based 21-point 3D hand landmark tracking
-   Translation & scale-invariant feature normalization
-   63-dimensional wrist-centered feature vector
-   Multiclass Logistic Regression classifier
-   Stratified train/test split
-   Confusion matrix + classification report
-   Model persistence via `joblib`

## Real-Time Inference

-   FastAPI backend serving predictions
-   Frontend polling (\~5 FPS)
-   Rolling probability smoothing
-   Confidence gating (threshold-based unlock)

## UI Modes

### Translate Mode

-   Live prediction display
-   Confidence visualization
-   Dataset capture & labeling

### Practice Mode

-   Target → Attempt → Lock-in evaluation
-   Stable prediction holding
-   Session tracking (attempts, accuracy)
-   Real-time camera reuse (no duplicate trackers)

## Architecture Improvements

-   Centralized `HandTracker` component
-   Shared camera stream across pages
-   Single MediaPipe lifecycle
-   Observability-ready UI layout

------------------------------------------------------------------------

# ML Pipeline

## Feature Engineering

Each frame produces 21 3D landmarks.

Preprocessing:

1.  **Translation invariance**
    -   Subtract wrist landmark (LM0)
2.  **Scale invariance**
    -   Normalize by wrist → middle MCP distance (LM0 → LM9)
3.  **Flatten**
    -   21 × 3 → 63-dimensional vector

This makes predictions robust to: - Camera position - Hand distance -
Minor translations

------------------------------------------------------------------------

## Model

-   Logistic Regression (multiclass)
-   Probability outputs used for smoothing
-   Rolling window averaging (frontend)
-   Confidence threshold gating

Artifacts:
```
backend/models/ 
model.joblib 
metadata.json
```

------------------------------------------------------------------------

# 🏗 Architecture

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
│ ├── src/ 
│ │ ├── components/ 
│ │ │ ├──HandTracker.jsx 
│ │ │ └── Layout.jsx 
│ │ ├── pages/ 
│ │ │ ├──Translate.jsx 
│ │ │ └── Practice.jsx 
│ │ └── App.jsx 
│ 
├── backend/
│ ├── app/
│ │ ├── api/
│ │ ├── core/
│ │ ├── ml/
│ │ │ ├── features.py
│ │ │ └── model.py
│ │ └── main.py
│ │
│ ├── scripts/
│ │ └── train.py
│ │
│ └── models/
│
├── docker-compose.yml
└── README.md
```
------------------------------------------------------------------------

# ⚙ Setup

## 1. Clone
```
git clone `<repo-url>`{=html} cd manuvision
```
## 2. Start Postgres
```
docker compose up -d
```
## 3. Backend
```
cd backend python -m venv .venv source .venv/bin/activate pip install -r
requirements.txt uvicorn app.main:app --reload
```
Runs on: http://localhost:8000

## 4. Frontend
```
cd frontend npm install npm run dev
```
Runs on: http://localhost:5173

------------------------------------------------------------------------

# Training Workflow

1.  Capture labeled samples via Translate mode

2.  Export dataset
```
mkdir -p backend/data curl
"http://localhost:8000/v1/samples/export?format=ndjson" -o
backend/data/samples.ndjson
```
3.  Train model
```
python -m backend.scripts.train
```
4.  Restart backend

------------------------------------------------------------------------

# 🔎 Health Check
```
curl http://localhost:8000/health
```
Returns:
```
{ "status": "ok" }
```
------------------------------------------------------------------------

# Roadmap

-   Full ASL alphabet coverage
-   Per-letter performance tracking
-   Confusion matrix visualization
-   Model version display in UI
-   Dynamic sequence recognition (LSTM / TCN)
-   Model retraining from UI
-   Latency monitoring