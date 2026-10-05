"""Dane z sieci VATSIM: kto jest online (data feed v3), rezerwacje stanowisk (ATC bookings),
samoloty w powietrzu i granice FIR z projektu VATSpy.

Dokumentacja API: https://vatsim.dev/services/apis"""

import json
from datetime import datetime, timezone
from functools import lru_cache

from ..config import settings
from .http_cache import fetch_text

DATA_FEED = "https://data.vatsim.net/v3/vatsim-data.json"
BOOKINGS = "https://atc-bookings.vatsim.net/api/booking"


_parsed: dict[str, tuple[str, object]] = {}


async def _json(url: str, ttl: int):
    """JSON z cache; ten sam tekst (trafienie w cache) nie jest parsowany ponownie (data feed ma kilka MB)."""
    text = await fetch_text(url, ttl)
    hit = _parsed.get(url)
    if hit and hit[0] is text:
        return hit[1]
    data = json.loads(text)
    _parsed[url] = (text, data)
    return data


async def get_feed() -> dict:
    return await _json(DATA_FEED, 30)


async def get_bookings() -> list[dict]:
    data = await _json(BOOKINGS, 300)
    return data if isinstance(data, list) else data.get("data", [])


def parse_time(v: str | None) -> datetime | None:
    if not v:
        return None
    try:
        dt = datetime.fromisoformat(v.replace("Z", "+00:00").replace(" ", "T"))
    except ValueError:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def controller_info(c: dict) -> dict:
    return {"callsign": c.get("callsign", ""), "frequency": c.get("frequency", ""), "name": c.get("name"),
            "cid": c.get("cid"), "rating": c.get("rating"), "logon_time": c.get("logon_time"),
            "text_atis": c.get("text_atis")}


def match_positions(controllers: list[dict], positions: list) -> dict[str, dict]:
    """Dopasowanie zalogowanych kontrolerów do stanowisk z pliku .ese (klucz: callsign stanowiska).

    Najpierw dokładny callsign, potem jak w EuroScope: prefiks, typ (końcówka) i częstotliwość."""
    by_cs = {p.callsign: p for p in positions}
    online: dict[str, dict] = {}
    for c in controllers:
        cs, freq = c.get("callsign", ""), c.get("frequency", "")
        if cs in by_cs:
            online[cs] = controller_info(c)
            continue
        for p in positions:
            if (p.prefix and cs.startswith(p.prefix + "_") and cs.split("_")[-1] == p.callsign.split("_")[-1]
                    and freq[:7] == p.frequency[:7]):
                online.setdefault(p.callsign, controller_info(c))
                break
    return online


def bookings_by_callsign(bookings: list[dict], prefix: str = "", now: datetime | None = None,
                         hours_ahead: int = 24) -> dict[str, list[dict]]:
    """Rezerwacje trwające teraz albo zaczynające się w ciągu `hours_ahead` godzin, wg callsigna."""
    now = now or datetime.now(timezone.utc)
    out: dict[str, list[dict]] = {}
    for b in bookings:
        cs = (b.get("callsign") or "").upper()
        start, end = parse_time(b.get("start")), parse_time(b.get("end"))
        if not cs.startswith(prefix.upper()) or not start or not end or end < now \
                or (start - now).total_seconds() > hours_ahead * 3600:
            continue
        out.setdefault(cs, []).append({"callsign": cs, "cid": b.get("cid"), "type": b.get("type"),
                                        "start": start.isoformat(), "end": end.isoformat(),
                                        "active": start <= now <= end})
    for lst in out.values():
        lst.sort(key=lambda x: x["start"])
    return out


@lru_cache(maxsize=1)
def fir_boundaries() -> dict:
    return json.loads((settings.seed_dir / "vatspy_firs.geojson").read_text("utf-8"))


def online_firs(controllers: list[dict]) -> dict[str, list[dict]]:
    """Które granice FIR (id z VATSpy) mają zalogowanego kontrolera CTR/FSS. Najdłuższy pasujący prefiks wygrywa."""
    data = fir_boundaries()
    prefixes = []
    for f in data["features"]:
        for pre in f["properties"]["prefixes"]:
            prefixes.append((pre, [f["properties"]["id"]]))
    for u in data.get("uirs", []):
        prefixes.append((u["id"], [f["properties"]["id"] for f in data["features"]
                                   if any(f["properties"]["id"].split("-")[0] == x for x in u["firs"])]))
    prefixes.sort(key=lambda x: -len(x[0]))
    out: dict[str, list[dict]] = {}
    for c in controllers:
        cs = c.get("callsign", "")
        if cs.split("_")[-1] not in ("CTR", "FSS"):
            continue
        for pre, ids in prefixes:
            if cs == pre or cs.startswith(pre + "_"):
                for i in ids:
                    out.setdefault(i, []).append(controller_info(c))
                break
    return out


def pilot_info(p: dict) -> dict:
    fp = p.get("flight_plan") or {}
    return {"callsign": p.get("callsign"), "cid": p.get("cid"), "name": p.get("name"),
            "lat": p.get("latitude"), "lon": p.get("longitude"), "altitude": p.get("altitude"),
            "groundspeed": p.get("groundspeed"), "heading": p.get("heading"), "squawk": p.get("transponder"),
            "aircraft": fp.get("aircraft_short"), "departure": fp.get("departure"), "arrival": fp.get("arrival"),
            "route": fp.get("route"), "rfl": fp.get("altitude"), "rules": fp.get("flight_rules")}
