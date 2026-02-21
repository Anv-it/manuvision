# ManuVision

ManuVision is a full-stack Sign Language Recognition platform built with a production-style ML architecture.

Sprint 1 establishes the complete end-to-end system using a dummy model to validate infrastructure and data flow.

---

## Features (Sprint 1)

- Webcam-based hand tracking (MediaPipe Hands)
- Real-time landmark extraction (21 3D keypoints)
- Frontend → Backend inference API (5 FPS polling)
- Live prediction display
- Practice mode with real-time correctness feedback
- Postgres logging of prediction attempts
- Dockerized database
- Health check endpoint with DB status monitoring

---

## Architecture

Frontend:
- React (Vite)
- MediaPipe Hands
- Axios API polling

Backend:
- Node.js (Express)
- REST API endpoints:
  - POST /v1/predict
  - POST /v1/attempts
  - GET /health
- Postgres (via pg)

Database:
- Dockerized Postgres 16
- attempts table for telemetry logging

---

## Project Structure
```
manuvision/
│
├── frontend/
│   ├── src/pages/Translate.jsx
│   ├── src/pages/Practice.jsx
│
├── backend/
│   ├── src/server.js
│
├── docker-compose.yml
└── README.md
```
---

## Setup Instructions

### 1. Clone

git clone <your-repo-url>
cd manuvision

### 2. Start Postgres (Docker required)

docker compose up -d

### 3. Run Backend

cd backend
npm install
npm run dev

### 4. Run Frontend

cd ../frontend
npm install
npm run dev

Visit:

http://localhost:5173

---

## Health Check

curl http://localhost:8080/health

Returns:

{
  "ok": true,
  "dbOk": true
}

---

## Database Schema

CREATE TABLE attempts (
  id SERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now(),
  target_letter TEXT NOT NULL,
  predicted_letter TEXT NOT NULL,
  confidence REAL NOT NULL,
  is_correct BOOLEAN NOT NULL
);

---

## Sprint 2 Roadmap

- Replace dummy model with trained classifier
- Landmark normalization
- Dataset capture endpoint
- Evaluation metrics
- Model versioning