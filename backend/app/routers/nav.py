import json

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..models import AirwaySegment, AtcPosition, NavPoint, Sector
from ..services.http_cache import UpstreamError
from ..services.route import RouteResolver
from ..services.vatsim import get_feed, match_positions

router = APIRouter(prefix="/api/nav", tags=["map"])

@router.get("/route")
def route(route: str = Query(..., min_length=3), db: Session = Depends(get_db)):
    return RouteResolver(db).resolve(route)


def _bbox(bbox: str):
    try:
        s, w, n, e = (float(x) for x in bbox.split(","))
    except ValueError as exc:
        raise HTTPException(400, "bbox = poludnie,zachod,polnoc,wschod") from exc
    if (n - s) * (e - w) > 400:
        raise HTTPException(400, "Za duży obszar, przybliż mapę")
    return s, w, n, e


@router.get("/points")
def points(bbox: str, kinds: str = "VOR,NDB,VOR-DME,DME,VORTAC,NDB-DME,FIX", limit: int = 3000,
           db: Session = Depends(get_db)):
    s, w, n, e = _bbox(bbox)
    stmt = (select(NavPoint)
            .where(NavPoint.lat.between(s, n), NavPoint.lon.between(w, e), NavPoint.kind.in_(kinds.split(",")))
            .limit(limit))
    seen, out = set(), []
    for p in db.scalars(stmt):
        key = (p.ident, round(p.lat, 1), round(p.lon, 1))  # ten sam punkt z kilku źródeł
        if key in seen:
            continue
        seen.add(key)
        out.append({"ident": p.ident, "kind": p.kind, "name": p.name, "frequency": p.frequency,
                    "lat": p.lat, "lon": p.lon})
    return out


@router.get("/airways")
def airways(bbox: str, limit: int = 5000, db: Session = Depends(get_db)):
    s, w, n, e = _bbox(bbox)
    stmt = (select(AirwaySegment)
            .where(AirwaySegment.from_lat.between(s, n), AirwaySegment.from_lon.between(w, e))
            .limit(limit))
    return [{"airway": a.airway, "level": a.level, "from": a.from_ident, "to": a.to_ident,
             "coords": [[a.from_lat, a.from_lon], [a.to_lat, a.to_lon]]} for a in db.scalars(stmt)]


def _positions(db: Session) -> dict[str, AtcPosition]:
    return {p.position_id: p for p in db.scalars(select(AtcPosition))}


@router.get("/positions")
def positions(db: Session = Depends(get_db)):
    """Stanowiska ATC z pliku .ese (zakładka RADIO)."""
    return [{"callsign": p.callsign, "name": p.name, "frequency": p.frequency, "position_id": p.position_id,
             "prefix": p.prefix} for p in db.scalars(select(AtcPosition).order_by(AtcPosition.callsign))]


@router.get("/sectors")
def sectors(fir: str = "EPWW", level_ft: int | None = None, db: Session = Depends(get_db)):
    """Sektory z pliku .ese jako GeoJSON. Bez zaimportowanego .ese zwraca plik data/seed/sectors.geojson."""
    stmt = select(Sector).where(Sector.fir == fir.upper())
    if level_ft is not None:
        stmt = stmt.where(Sector.lower_ft <= level_ft, Sector.upper_ft > level_ft)
    rows = db.scalars(stmt).all()
    if not rows:
        return json.loads((settings.seed_dir / "sectors.geojson").read_text("utf-8"))
    pos = _positions(db)
    feats = []
    for s in rows:
        owners = [o for o in s.owners.split(":") if o]
        first = pos.get(owners[0]) if owners else None
        feats.append({"type": "Feature", "geometry": json.loads(s.geometry), "properties": {
            "name": s.name, "lower_ft": s.lower_ft, "upper_ft": s.upper_ft, "owners": owners,
            "callsign": first.callsign if first else None, "frequency": first.frequency if first else None,
        }})
    return {"type": "FeatureCollection", "features": feats}


@router.get("/sectors/online")
async def sectors_online(fir: str = "EPWW", db: Session = Depends(get_db)):
    """Aktualna sektoryzacja: dla każdego sektora pierwsze zalogowane stanowisko z listy OWNER."""
    try:
        data = await get_feed()
    except (UpstreamError, ValueError) as exc:
        raise HTTPException(502, f"VATSIM data feed niedostępny: {exc}") from exc
    positions = db.scalars(select(AtcPosition)).all()
    online = match_positions(data.get("controllers", []), positions)
    by_id = {p.position_id: online[p.callsign] | {"position": p.callsign}
             for p in positions if p.callsign in online}
    result = {}
    for s in db.scalars(select(Sector).where(Sector.fir == fir.upper())):
        for o in s.owners.split(":"):
            if o in by_id:
                result[s.name] = {"position_id": o, **by_id[o]}
                break
    return {"online_positions": list(by_id.values()), "sector_owner": result,
            "updated": data.get("general", {}).get("update_timestamp")}
