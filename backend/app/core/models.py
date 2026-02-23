from sqlalchemy import Column, BigInteger, Text, DateTime, Boolean, func
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