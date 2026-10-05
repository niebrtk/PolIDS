import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..models import Aerodrome, AtcPosition
from ..services.http_cache import UpstreamError
from ..services.lvp import evaluate as evaluate_lvp
from ..services.metar import parse_metar, qfe_from_qnh
from ..services.runways import runway_heading, suggest_runway, wind_components
from ..services.weather import get_metars, get_tafs

router = APIRouter(prefix="/api/aerodromes", tags=["aerodrome"])


def _ad(db: Session, icao: str) -> Aerodrome:
    ad = db.get(Aerodrome, icao.upper())
    if not ad:
        raise HTTPException(404, f"Nie znam lotniska {icao}")
    return ad


@router.get("")
def list_aerodromes(q: str = "", db: Session = Depends(get_db)):
    stmt = select(Aerodrome).order_by(Aerodrome.icao)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(or_(Aerodrome.icao.ilike(like), Aerodrome.name.ilike(like), Aerodrome.city.ilike(like)))
    return [{"icao": a.icao, "name": a.name, "city": a.city, "kind": a.kind, "lat": a.lat, "lon": a.lon,
             "elevation_ft": a.elevation_ft} for a in db.scalars(stmt)]


@router.get("/{icao}")
def aerodrome(icao: str, db: Session = Depends(get_db)):
    ad = _ad(db, icao)
    positions = db.scalars(select(AtcPosition).where(AtcPosition.prefix == ad.icao)
                           .order_by(AtcPosition.callsign)).all()
    return {
        "icao": ad.icao, "name": ad.name, "city": ad.city, "lat": ad.lat, "lon": ad.lon,
        "elevation_ft": ad.elevation_ft, "iata": ad.iata,
        "runways": [{"designator": r.designator, "opposite": r.opposite, "heading_true": r.heading_true,
                     "length_m": r.length_m, "width_m": r.width_m, "surface": r.surface} for r in ad.runways],
        "frequencies": [{"kind": f.kind, "description": f.description, "mhz": f.mhz} for f in ad.frequencies],
        "atc_positions": [{"callsign": p.callsign, "name": p.name, "frequency": p.frequency} for p in positions],
    }


@router.get("/{icao}/status")
async def status(icao: str, db: Session = Depends(get_db)):
    """Wszystko do widoku AERODROME: METAR (zdekodowany), TAF, składowe wiatru, pas sugerowany, QFE."""
    ad = _ad(db, icao)
    errors = []
    metar = taf = None
    try:
        metar = (await get_metars([ad.icao])).get(ad.icao)
    except UpstreamError as exc:
        errors.append(f"METAR: {exc}")
    try:
        taf = (await get_tafs([ad.icao])).get(ad.icao)
    except UpstreamError as exc:
        errors.append(f"TAF: {exc}")
    parsed = parse_metar(metar) if metar else None

    wd = parsed.wind_dir if parsed else None
    ws = parsed.wind_speed if parsed else None
    rwys = [{"designator": r.designator, "heading": runway_heading(r.designator, r.heading_true),
             "preferred": r.preferred, "length_m": r.length_m} for r in ad.runways]
    for r in rwys:
        r["headwind"], r["crosswind"] = wind_components(wd, ws, r["heading"])
    best, reason = suggest_runway(rwys, wd, ws)

    qfe = qfe_from_qnh(parsed.qnh, ad.elevation_ft or 0) if parsed and parsed.qnh else None
    return {
        "icao": ad.icao, "name": ad.name, "elevation_ft": ad.elevation_ft,
        "metar": metar, "parsed": parsed.to_dict() if parsed else None, "taf": taf,
        "qfe": qfe, "runways": rwys, "lvp": evaluate_lvp(parsed, ad.icao),
        "suggested_runway": best["designator"] if best else None, "suggestion_reason": reason,
        "errors": errors,
    }


@router.get("/{icao}/checklist")
def checklist(icao: str):
    data = json.loads((settings.seed_dir / "checklists.json").read_text("utf-8"))
    return {"icao": icao.upper(), "items": data.get("DEFAULT", []) + data.get(icao.upper(), [])}
