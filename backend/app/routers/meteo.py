import json

from fastapi import APIRouter, HTTPException, Query

from ..config import settings
from ..services.http_cache import UpstreamError
from ..services.metar import parse_metar
from ..services.weather import get_metars, get_tafs

router = APIRouter(prefix="/api/meteo", tags=["meteo"])


def _ids(ids: str) -> list[str]:
    out = [i.strip().upper() for i in ids.replace(" ", ",").split(",") if i.strip()]
    if not out or len(out) > 50:
        raise HTTPException(400, "Podaj od 1 do 50 kodów ICAO")
    return out


@router.get("/metar")
async def metar(ids: str = Query(..., description="Kody ICAO rozdzielone przecinkami")):
    icaos = _ids(ids)
    try:
        raw = await get_metars(icaos)
    except UpstreamError as exc:
        raise HTTPException(502, f"Źródło METAR niedostępne: {exc}") from exc
    return [{"icao": i, "raw": raw.get(i), "parsed": parse_metar(raw[i]).to_dict() if raw.get(i) else None}
            for i in icaos]


@router.get("/taf")
async def taf(ids: str = Query(...)):
    icaos = _ids(ids)
    try:
        raw = await get_tafs(icaos)
    except UpstreamError as exc:
        raise HTTPException(502, f"Źródło TAF niedostępne: {exc}") from exc
    return [{"icao": i, "raw": raw.get(i)} for i in icaos]


@router.get("/qnh-regions")
async def qnh_regions():
    cfg = json.loads((settings.seed_dir / "qnh_regions.json").read_text("utf-8"))
    icaos = sorted({a for r in cfg["regions"] for a in r["airports"]})
    try:
        raw = await get_metars(icaos)
    except UpstreamError as exc:
        raise HTTPException(502, f"Źródło METAR niedostępne: {exc}") from exc
    qnh = {i: parse_metar(m).qnh for i, m in raw.items()}
    regions = []
    for r in cfg["regions"]:
        vals = [qnh[a] for a in r["airports"] if qnh.get(a)]
        regions.append({**r, "qnh": min(vals) if vals else None,
                        "stations": [{"icao": a, "qnh": qnh.get(a)} for a in r["airports"]]})
    return {"note": cfg.get("_uwaga"), "regions": regions}
