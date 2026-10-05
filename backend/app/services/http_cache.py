"""Pobieranie z zewnętrznych API z krótkim cache w pamięci, żeby nie zasypywać źródeł zapytaniami."""

import time

import httpx

from ..config import settings

_cache: dict[str, tuple[float, str]] = {}


class UpstreamError(Exception):
    pass


async def fetch_text(url: str, ttl: int, params: dict | None = None) -> str:
    key = url + "?" + "&".join(f"{k}={v}" for k, v in sorted((params or {}).items()))
    hit = _cache.get(key)
    if hit and time.monotonic() - hit[0] < ttl:
        return hit[1]
    try:
        async with httpx.AsyncClient(timeout=settings.http_timeout, follow_redirects=True,
                                     headers={"User-Agent": "vPANDORA/0.1 (VATSIM PL vACC)"}) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
    except httpx.HTTPError as exc:
        if hit:  # lepiej pokazać starsze dane niż nic
            return hit[1]
        raise UpstreamError(f"{url}: {exc}") from exc
    _cache[key] = (time.monotonic(), resp.text)
    return resp.text


def clear_cache():
    _cache.clear()
