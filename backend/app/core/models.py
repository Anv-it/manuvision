from sqlalchemy import Column, Integer, BigInteger, String, Float, Text, DateTime, Boolean, func
from datetime import datetime
from sqlalchemy.dialects.postgresql import JSONB
from app.core.db import Base

class Sample(Base):
    __tablename__ = "samples"

    id = Column(BigInteger, primary_key=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    label = Column(Text, nullable=False)               # e.g. "A"
    landmarks_raw = Column(JSONB, nullable=False)      # 21x3 array
    session_id = Column(Text, nullable=True)
    handedness = Column(Text, nullable=True)

    is_valid = Column(Boolean, server_default="true", nullable=False)


class Attempt(Base):
    __tablename__ = "attempts"

    id = Column(Integer, primary_key=True, index=True)

    target_label = Column(String, index=True)
    predicted_label = Column(String)

    confidence = Column(Float)

    correct = Column(Boolean)

    session_id = Column(String, index=True)

    created_at = Column(DateTime, default=datetime.utcnow)