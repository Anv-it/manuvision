# ManuVision

ManuVision is a full-stack Sign Language Recognition platform built with a production-style ML architecture.

Sprint 2 upgrades the system from a dummy predictor to a real trained classifier with feature normalization, dataset capture, and real-time inference.

---

## Current Capabilities (Sprint 2)

- Webcam-based hand tracking (MediaPipe Hands)
- Real-time landmark extraction (21 × 3D keypoints)
- Feature normalization (translation + scale invariant)
- Logistic Regression classifier
- Live model inference via FastAPI
- Rolling prediction smoothing (frontend)
- Dataset capture & labeling interface
- NDJSON export for training
- Postgres-backed sample storage
- Dockerized database
- Health check endpoint

---

## ML Pipeline

### Feature Engineering

Each frame produces 21 3D landmarks from MediaPipe.

Preprocessing steps:

1. **Translation invariance**
   - Subtract wrist landmark (LM0)

2. **Scale invariance**
   - Divide by distance between wrist and middle MCP (LM0 → LM9)

3. **Flatten**
   - 21 × 3 → 63-dimensional feature vector

This makes the model robust to:
- Camera position
- Hand distance
- Small translations

---

### Model

- Logistic Regression (multiclass)
- Train/test split with stratification
- Confusion matrix + classification report
- Model persistence via joblib

Artifacts saved to:

```
backend/models/
model.joblib
metadata.json
```

---

## Architecture

### Frontend
- React (Vite)
- MediaPipe Hands
- Axios polling (~5 FPS)
- Real-time prediction smoothing

### Backend
- FastAPI
- REST endpoints:
  - `POST /v1/predict`
  - `POST /v1/samples`
  - `GET /v1/samples/export`
  - `GET /v1/samples/stats`
  - `GET /health`
- SQLAlchemy ORM
- Pydantic validation

### Database
- Dockerized Postgres 16
- `samples` table (aggregated landmarks + label)

---

## Project Structure

```
manuvision/
│
├── frontend/
│ ├── src/pages/Translate.jsx
│ ├── src/pages/Practice.jsx
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

---

## Setup Instructions

### 1. Clone

```bash
git clone <your-repo-url>
cd manuvision
```
2. Start Postgres
```
docker compose up -d
```
3. Run Backend
```
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```
Backend runs on:
```
http://localhost:8000
```
4. Run Frontend
```
cd frontend
npm install
npm run dev
```
Frontend runs on:
```
http://localhost:5173
```

---

## Training a Model

1. Collect labeled samples via the Translate page

2. Export dataset:
```
mkdir -p backend/data
curl "http://localhost:8000/v1/samples/export?format=ndjson" -o backend/data/samples.ndjson
```

3. Train:
```
python -m backend.scripts.train
```

4. Restart backend to load the new model.

---

## Health Check
```
curl http://localhost:8000/health
```
Returns:
```
{
  "status": "ok"
}
```
---

## Future Improvements

- Add probability-based smoothing

- Add left-hand canonical mirroring

- Expand dataset to full ASL alphabet

- Add model evaluation dashboard

- Improve robustness across sessions & lighting

- Upgrade to MLP or tree-based classifier


---