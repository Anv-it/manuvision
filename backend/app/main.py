from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.db import Base, engine
from app.core import models

from app.api.v1.routes_samples import router as samples_router
from app.api.v1.routes_predict import router as predict_router  # if you added it

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

app.include_router(samples_router)
app.include_router(predict_router)

@app.get("/health")
def health():
    return {"status": "ok"}