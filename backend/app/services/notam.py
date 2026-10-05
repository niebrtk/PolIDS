"""NOTAM-y z serwera PL vACC (cv.plvacc.pl) w formacie ICAO."""

import re

from ..config import settings
from .http_cache import fetch_text

NOTAM_START = re.compile(r"\n+(?=\s*\(?[A-Z]\d{4}/\d{2}\s+NOTAM[NRC]\b)")
FIELD = re.compile(r"\b([QABCDEFG])\)\s*")


def notam_url(icao: str) -> str:
    return f"{settings.notam_server.rstrip('/')}/{settings.notam_prefix}{icao.upper()}{settings.notam_suffix}"


def split_notams(text: str) -> list[dict]:
    """Dzieli tekst na pojedyncze NOTAM-y i wyciąga pola Q)…G). Format odpowiedzi serwera
    nie jest udokumentowany, więc przy nieznanym formacie zwracamy całość jako jeden wpis."""
    text = re.sub(r"<br\s*/?>", "\n", text, flags=re.I)
    text = re.sub(r"<[^>]+>", "", text).strip()
    if not text:
        return []
    parts = [p.strip() for p in NOTAM_START.split(text) if p.strip()]
    if len(parts) <= 1:
        parts = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
    out = []
    for p in parts:
        ident = re.match(r"\(?([A-Z]\d{4}/\d{2})", p)
        fields = {}
        pieces = FIELD.split(p)
        for key, val in zip(pieces[1::2], pieces[2::2]):
            fields[key] = val.strip().rstrip(")").strip()
        out.append({"id": ident.group(1) if ident else None, "raw": p, "fields": fields})
    return out


def for_aerodrome(notams: list[dict], icao: str) -> list[dict]:
    """Tylko NOTAM-y, których pole A) wymienia dane lotnisko (serwer zwraca też NOTAM-y innych lotnisk i FIR).
    NOTAM bez pola A) zostaje tylko wtedy, gdy w jego treści pada kod lotniska."""
    icao = icao.upper()
    out = []
    for n in notams:
        a = n["fields"].get("A")
        if a is not None:
            if icao in re.findall(r"[A-Z]{4}", a):
                out.append(n)
        elif re.search(rf"\b{icao}\b", n["raw"]):
            out.append(n)
    return out


async def get_notams(icao: str) -> dict:
    url = notam_url(icao)
    text = await fetch_text(url, settings.notam_cache_seconds)
    allnotams = split_notams(text)
    notams = for_aerodrome(allnotams, icao)
    return {"icao": icao.upper(), "source": url, "notams": notams, "other": len(allnotams) - len(notams)}
