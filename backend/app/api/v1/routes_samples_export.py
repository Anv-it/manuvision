import json
from fastapi import Response
from sqlalchemy import select

@router.get("/samples/export")
def export_samples(format: str = "ndjson", db: Session = Depends(get_db)):
    rows = db.execute(
        select(Sample.id, Sample.label, Sample.landmarks_raw, Sample.handedness, Sample.session_id, Sample.created_at)
        .where(Sample.is_valid == True)  # noqa: E712
        .order_by(Sample.id.asc())
    ).all()

    if format.lower() != "ndjson":
        raise HTTPException(status_code=400, detail="Only format=ndjson supported for now")

    # NDJSON: one JSON object per line
    lines = []
    for r in rows:
        obj = {
            "id": r.id,
            "label": r.label,
            "landmarks": r.landmarks_raw,
            "handedness": r.handedness,
            "session_id": r.session_id,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        lines.append(json.dumps(obj))

    body = "\n".join(lines) + ("\n" if lines else "")
    return Response(content=body, media_type="application/x-ndjson")

from sqlalchemy import func

@router.get("/samples/stats")
def sample_stats(db: Session = Depends(get_db)):
    rows = db.query(Sample.label, func.count(Sample.id)).filter(Sample.is_valid == True).group_by(Sample.label).all()  # noqa: E712
    return {"counts": {label: count for label, count in rows}}

@router.get("/samples/recent")
def recent_samples(limit: int = 20, db: Session = Depends(get_db)):
    limit = max(1, min(limit, 200))
    rows = (
        db.query(Sample.id, Sample.label, Sample.created_at, Sample.session_id)
        .order_by(Sample.id.desc())
        .limit(limit)
        .all()
    )
    return [
        {"id": r.id, "label": r.label, "created_at": r.created_at.isoformat(), "session_id": r.session_id}
        for r in rows
    ]