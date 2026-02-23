from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.db import Base, engine
from app.core import models

from app.api.v1.routes_samples import router as samples_router
from app.api.v1.routes_predict import router as predict_router

from app.ml.model import bundle


app = FastAPI(title="ManuVision API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)

    # ✅ load model once
    try:
        bundle.load()
        print("✅ ML model loaded")
    except Exception as e:
        print(f"⚠️ ML model not loaded: {e}")

app.include_router(samples_router)
app.include_router(predict_router)

@app.get("/health")
def health():
    return {"status": "ok"}