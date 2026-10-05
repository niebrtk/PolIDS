"""Import callsignów z pliku ICAO_Airlines.txt dołączanego do pakietów sektorowych EuroScope
(format: ICAO<TAB>NAZWA<TAB>TELEFONIA<TAB>KRAJ). Plik trzymaj lokalnie w data/import/."""

from pathlib import Path

from sqlalchemy.orm import Session

from ..models import Callsign
from .sct import read_text


def parse_icao_airlines(text: str) -> list[dict]:
    out = []
    for line in text.splitlines():
        if not line.strip() or line.lstrip().startswith(";"):
            continue
        parts = [p.strip() for p in line.split("\t")]
        if len(parts) < 3 or not (2 <= len(parts[0]) <= 4):
            continue
        out.append({"icao": parts[0].upper(), "name": parts[1], "telephony": parts[2] or None,
                    "country": parts[3] if len(parts) > 3 else None})
    return out


def import_icao_airlines(db: Session, path: Path) -> int:
    rows = parse_icao_airlines(read_text(path))
    for r in rows:
        db.merge(Callsign(source="sector-file", **r))
    db.commit()
    return len(rows)
