"""Import punktów (VOR, NDB, FIX) z pliku sektorowego EuroScope (.sct / .sct2).

Pliki sektorowe PL vACC trzymaj lokalnie w data/import/ (nie wrzucaj ich do repozytorium:
licencja GNG/AeroNav zabrania redystrybucji)."""

import re
from pathlib import Path

from sqlalchemy import delete, insert
from sqlalchemy.orm import Session

from ..models import NavPoint

COORD_RE = re.compile(r"^([NSEW])(\d{3})\.(\d{1,2})\.(\d{1,2})\.(\d{1,3})$")


def parse_coord(tok: str) -> float | None:
    """N052.10.17.000 -> 52.171389"""
    m = COORD_RE.match(tok.strip().upper())
    if not m:
        return None
    val = int(m[2]) + int(m[3]) / 60 + (int(m[4]) + int(m[5]) / 1000) / 3600
    return round(-val if m[1] in "SW" else val, 6)


def read_text(path: Path) -> str:
    raw = path.read_bytes()
    for enc in ("utf-8-sig", "cp1250"):
        try:
            return raw.decode(enc)
        except UnicodeDecodeError:
            continue
    return raw.decode("latin-1", errors="replace")


def sections(text: str) -> dict[str, list[str]]:
    out: dict[str, list[str]] = {}
    current = None
    for line in text.splitlines():
        line = line.split(";", 1)[0].rstrip()
        if not line.strip():
            continue
        if line.startswith("["):
            current = line.strip().upper()
            out.setdefault(current, [])
        elif current:
            out[current].append(line)
    return out


def parse_sct(text: str) -> list[dict]:
    secs = sections(text)
    points = {}

    def add(ident, kind, freq, lat_s, lon_s):
        lat, lon = parse_coord(lat_s), parse_coord(lon_s)
        if lat is not None and lon is not None:
            points.setdefault((ident, kind), {"ident": ident, "kind": kind, "frequency": freq,
                                              "lat": lat, "lon": lon})

    for kind in ("VOR", "NDB"):
        for line in secs.get(f"[{kind}]", []):
            p = line.split()
            if len(p) >= 4:
                add(p[0], kind, p[1], p[2], p[3])
    for line in secs.get("[FIXES]", []):
        p = line.split()
        if len(p) >= 3:
            add(p[0], "FIX", None, p[1], p[2])
    return list(points.values())


def import_sct(db: Session, path: Path) -> dict:
    pts = parse_sct(read_text(path))
    db.execute(delete(NavPoint).where(NavPoint.source == "sct"))
    if pts:
        db.execute(insert(NavPoint), [{**p, "source": "sct"} for p in pts])
    db.commit()
    return {"points": len(pts)}
