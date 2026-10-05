import json

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..importers.seed import init_db
from ..models import (AircraftType, Aerodrome, AirwaySegment, AtcPosition, Callsign, Document, ImportLog,
                      NavPoint, Sector)
from ..services.airac import current_airac

router = APIRouter(prefix="/api", tags=["system"])


@router.get("/config")
def config():
    return {
        "airac": current_airac(),
        "default_aerodrome": settings.default_aerodrome,
        "links": {
            "aip_ifr": settings.aip_ifr_url, "aip_vfr": settings.aip_vfr_url, "aip_mil": settings.aip_mil_url,
            "inop": settings.inop_url, "sectors": settings.sectors_url,
        },
        "openaip_api_key": settings.openaip_api_key,
        "metar_source": settings.metar_source,
    }


@router.get("/emergency")
def emergency():
    return json.loads((settings.seed_dir / "emergency.json").read_text("utf-8"))


@router.get("/status")
def status(db: Session = Depends(get_db)):
    count = lambda m: db.scalar(select(func.count()).select_from(m))  # noqa: E731
    return {
        "counts": {"aerodromes": count(Aerodrome), "aircraft_types": count(AircraftType),
                   "callsigns": count(Callsign), "nav_points": count(NavPoint), "airway_segments": count(AirwaySegment),
                   "atc_positions": count(AtcPosition), "sectors": count(Sector), "documents": count(Document)},
        "imports": [{"file": i.filename, "result": i.result} for i in db.scalars(select(ImportLog))],
    }


@router.post("/import")
def run_import(force: bool = False):
    """Ponownie wczytuje pliki z data/import/ i rejestruje PDF-y z data/docs/."""
    return {"results": init_db(force=force)}
