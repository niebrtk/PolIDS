"""vIFF (VATSIM IFPS/ETFMS/CDM, https://api.viffsys.com, autor Roger Puig).

Używamy wyłącznie odczytu (GET):
- /ifps/depAirport?airport=ICAO: odloty z EOBT, CTOT, statusem ATFCM i danymi A-CDM (TOBT, TSAT, TTOT),
- /etfms/getCadAirport?icao=ICAO: czy lotnisko ma A-CDM,
- /etfms/trafficVolumes i /etfms/airspaces: sektory (traffic volumes) z przepustowością i godzinowym ruchem.

Odczyt działa bez klucza. Jeśli autor vIFF wyda klucz, ustaw VPANDORA_VIFF_API_KEY (idzie w nagłówku x-api-key).
Endpointów zapisujących (POST) aplikacja nigdy nie wywołuje: zmieniają wspólny stan sieci.
Schematów odpowiedzi nie ma w dokumentacji API, więc nazwy pól poniżej pochodzą z obserwacji odpowiedzi."""

import json
from datetime import datetime, timedelta, timezone

from ..config import settings
from .http_cache import UpstreamError, fetch_text

# Stan lotu jak w liście lotów NM (kody flight state z komunikatów EFD), wyliczany z pól vIFF.
# vIFF ustawia ATC_ACTIV w chwili AOBT, więc to jest "AA"; lot w powietrzu bez ATC_ACTIV = "TA".
FLIGHT_STATES = {
    "FI": "FI: plan złożony (filed), bez slotu",
    "SI": "SI: slot wydany (slot issued, CTOT)",
    "SU": "SU: lot zawieszony (suspended, FLS)",
    "AA": "AA: aktywowany przez ATC (ATC activated, AOBT)",
    "TA": "TA: aktywowany po starcie (tact activated, ATOT)",
}


def hhmm(value) -> str | None:
    """'1520' albo '152000' → '1520'; puste → None (vIFF podaje godziny UTC bez daty)."""
    s = str(value or "").strip()
    return s[:4] if len(s) >= 4 and s[:4].isdigit() else None


def _mins(t: str | None) -> int | None:
    return int(t[:2]) * 60 + int(t[2:]) if t else None


def flight_state(f: dict) -> str:
    atfcm = (f.get("atfcmStatus") or "").upper()
    cdm = (f.get("cdmSts") or "").upper()
    if atfcm.startswith("FLS") or cdm.startswith("FLS"):
        return "SU"
    if atfcm == "ATC_ACTIV":
        return "AA"
    if hhmm(f.get("atot")) or cdm in ("AIRB", "COMPLY"):
        return "TA"
    if hhmm(f.get("ctot")) and atfcm != "SLC":
        return "SI"
    return "FI"


def departure(f: dict) -> dict:
    cdm = f.get("cdmData") or {}
    atfcm = f.get("atfcmData") or {}
    suspension = next((s for s in (f.get("atfcmStatus"), f.get("cdmSts")) if (s or "").upper().startswith("FLS")), None)
    eobt, ctot = hhmm(f.get("eobt")), hhmm(f.get("ctot")) or hhmm(cdm.get("ctot"))
    taxi = f.get("taxi") if isinstance(f.get("taxi"), int) else 0
    # opóźnienie ATFM = CTOT - ETOT, ETOT = EOBT + czas kołowania (jak kolumna Delay w liście lotów NM)
    delay = ((_mins(ctot) - _mins(eobt) - taxi + 720) % 1440 - 720) if ctot and eobt else None
    return {
        "callsign": f.get("callsign"), "arrival": f.get("arrival"),
        "eobt": eobt, "ctot": ctot, "delay": delay,
        "tobt": hhmm(cdm.get("tobt")) or hhmm(f.get("tobt")), "tsat": hhmm(cdm.get("tsat")),
        "ttot": hhmm(cdm.get("ttot")), "aobt": hhmm(f.get("aobt")), "atot": hhmm(f.get("atot")),
        "state": flight_state(f), "suspension": suspension,
        "ready": (f.get("cdmSts") or "").upper() == "REA" or bool(atfcm.get("isRea")),
        "regulation": atfcm.get("mostPenalisingRegulation") or None,
        "airspace": f.get("mostPenalizingAirspace") or None,
        "dep_info": cdm.get("depInfo") or None,
        "atfcm_status": f.get("atfcmStatus") or None, "cdm_status": f.get("cdmSts") or None,
    }


async def _get(path: str, params: dict | None = None, ttl: int | None = None):
    headers = {"x-api-key": settings.viff_api_key.strip()} if settings.viff_api_key.strip() else None
    text = await fetch_text(settings.viff_url.rstrip("/") + path, ttl if ttl is not None else settings.viff_cache_seconds,
                            params=params, headers=headers)
    return json.loads(text) if text.strip() else None


async def is_cdm_airport(icao: str) -> bool:
    icao = icao.upper()
    fallback = icao in {a.strip().upper() for a in settings.viff_cdm_airports.split(",") if a.strip()}
    try:
        cad = await _get("/etfms/getCadAirport", {"icao": icao}, ttl=3600)
    except Exception:  # noqa: BLE001 - brak konfiguracji lotniska w vIFF to nie błąd
        return fallback
    return bool(cad.get("isCdm")) if isinstance(cad, dict) and "isCdm" in cad else fallback


async def departures(icao: str) -> dict:
    icao = icao.upper()
    data = await _get("/ifps/depAirport", {"airport": icao})
    flights = [departure(f) for f in (data if isinstance(data, list) else []) if f.get("callsign")]
    flights.sort(key=lambda f: (bool(f["atot"]), f["eobt"] or "9999", f["callsign"]))
    return {"icao": icao, "cdm": await is_cdm_airport(icao), "flights": flights, "states": FLIGHT_STATES}


# --- sektory: ruch i przepustowość na najbliższą godzinę

def _minutes(value: str | None, now_min: int) -> int | None:
    """Godzina 'HHMM' jako minuty względem teraz, w zakresie -720..719 (przejście przez północ)."""
    t = hhmm(value)
    if t is None:
        return None
    return (int(t[:2]) * 60 + int(t[2:]) - now_min + 720) % 1440 - 720


def _cap(value) -> int | None:
    """999 / -1 / brak = bez limitu."""
    return value if isinstance(value, int) and 0 < value < 999 else None


def sector_load(tv: str, buckets: list[dict], now: datetime, horizon: int = 60) -> dict:
    """Ruch w sektorze od teraz do +horizon minut: wejścia w oknach 20-minutowych, zajętość minuta po minucie
    i godzinowe liczniki vIFF (bieżąca i następna godzina) z przepustowością.

    Krotka lotu w vIFF: [callsign, wejście plan., wyjście plan., wejście wylicz., wyjście wylicz., flaga];
    znaczenie nie jest udokumentowane, bierzemy czasy wyliczone, a gdy ich brak, planowane."""
    now_min = now.hour * 60 + now.minute
    flights: dict[str, dict] = {}
    for b in buckets:
        for t in b.get("flights") or []:
            if not isinstance(t, list) or len(t) < 3:
                continue
            entry = _minutes(t[3] if len(t) > 3 and hhmm(t[3]) else t[1], now_min)
            exit_ = _minutes(t[4] if len(t) > 4 and hhmm(t[4]) else t[2], now_min)
            if entry is None:
                continue
            if exit_ is None or exit_ < entry:
                exit_ = entry + 1
            flights[t[0]] = {"callsign": t[0], "entry": entry, "exit": exit_, "airborne": bool(t[5]) if len(t) > 5 else None}
    ahead = sorted((f for f in flights.values() if f["exit"] > 0 and f["entry"] < horizon), key=lambda f: f["entry"])
    occupancy = [sum(1 for f in ahead if f["entry"] <= m < f["exit"]) for m in range(horizon + 1)]
    windows = [{"from": m, "to": m + 20, "entries": sum(1 for f in ahead if m <= f["entry"] < m + 20)}
               for m in range(0, horizon, 20)]
    hours = [{"hour": b.get("hour"), "entries": b.get("entriesCount"), "entries_cap": _cap(b.get("entriesCapacity")),
              "peak": b.get("peakCount"), "peak_cap": _cap(b.get("peakCapacity")), "active": b.get("active")}
             for b in buckets]
    clock = lambda m: (now.replace(second=0, microsecond=0) + timedelta(minutes=m)).strftime("%H%M")  # noqa: E731
    return {"id": tv, "hours": hours, "windows": windows, "occupancy": occupancy,
            "entries_60": sum(1 for f in ahead if 0 <= f["entry"] < horizon), "peak_60": max(occupancy),
            "flights": [{"callsign": f["callsign"], "entry": clock(f["entry"]), "exit": clock(f["exit"]),
                         "airborne": f["airborne"]} for f in ahead]}


async def sectors(prefix: str | None = None, now: datetime | None = None) -> dict:
    prefix = (prefix or settings.viff_sector_prefix).upper()
    now = now or datetime.now(timezone.utc)
    today, tomorrow = now.date().isoformat(), (now + timedelta(days=1)).date().isoformat()
    try:  # definicje (obszar, status) są dodatkiem; bez nich wykres nadal działa
        defs = await _get("/etfms/trafficVolumes", {"filter": prefix, "active": "false", "activeAndDisabled": "true"}, ttl=600)
    except (UpstreamError, ValueError):
        defs = []
    load = await _get("/etfms/airspaces", {"filter": prefix, "fromNow": "true", "date": today}) or {}
    # następna godzina po 23Z jest już jutro
    nxt = await _get("/etfms/airspaces", {"filter": prefix, "date": tomorrow}) if now.hour == 23 else {}
    cur_h, next_h = f"{now.hour:02d}", f"{(now.hour + 1) % 24:02d}"
    info = {d["id"]: d for d in (defs if isinstance(defs, list) else []) if isinstance(d, dict) and d.get("id")}
    ids = sorted({i for i in [*info, *(load or {})] if i.startswith(prefix + "-")})
    out = []
    for tv in ids:
        buckets = [b for b in (load or {}).get(tv, []) if b.get("hour") == cur_h]
        buckets += [b for b in ((nxt or {}) if now.hour == 23 else (load or {})).get(tv, []) if b.get("hour") == next_h]
        d = info.get(tv, {})
        item = sector_load(tv, buckets, now)
        item.update({"volumes": [v for v in (d.get("volumes") or "").split(",") if v], "status": d.get("status"),
                     "entries_cap": _cap(d.get("entries")), "occupancy_cap": _cap(d.get("occupancy")),
                     "restrictions": d.get("restrictions") or []})
        if item["entries_cap"] is None and item["hours"]:
            item["entries_cap"] = item["hours"][0]["entries_cap"]
        if item["occupancy_cap"] is None and item["hours"]:
            item["occupancy_cap"] = item["hours"][0]["peak_cap"]
        out.append(item)
    out.sort(key=lambda s: (s["status"] != 1, s["id"]))
    return {"prefix": prefix, "now": now.strftime("%H%M"), "sectors": out}
