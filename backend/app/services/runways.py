"""Składowe wiatru i wybór sugerowanego pasa."""

import math
import re


def runway_heading(designator: str, heading_true: float | None) -> float:
    if heading_true is not None:
        return heading_true
    num = int(re.match(r"\d+", designator).group())
    return (num * 10) % 360 or 360


def wind_components(wind_dir: int | None, wind_speed: int | None, rwy_heading: float):
    """Zwraca (wiatr czołowy, boczny) w kt. Czołowy < 0 oznacza wiatr w plecy.
    Boczny > 0 z prawej strony, < 0 z lewej."""
    if wind_speed is None or wind_dir is None:
        return None, None
    angle = math.radians(wind_dir - rwy_heading)
    return round(wind_speed * math.cos(angle), 1), round(wind_speed * math.sin(angle), 1)


def suggest_runway(runways: list[dict], wind_dir: int | None, wind_speed: int | None,
                   calm_threshold_kt: int = 5, max_tailwind_kt: float = 5.0):
    """Wybiera pas z największą składową czołową. Przy słabym/zmiennym wietrze
    (poniżej progu) wybiera pas oznaczony jako preferowany, jeśli dopuszczalna jest składowa w plecy.

    `runways` to słowniki z kluczami designator, heading, preferred."""
    if not runways:
        return None, "Brak danych o pasach"

    scored = []
    for r in runways:
        head, cross = wind_components(wind_dir, wind_speed, r["heading"])
        scored.append({**r, "headwind": head, "crosswind": cross})

    calm = wind_speed is None or wind_speed < calm_threshold_kt or wind_dir is None
    preferred = [r for r in scored if r.get("preferred")]
    if calm and preferred:
        ok = [r for r in preferred if r["headwind"] is None or r["headwind"] >= -max_tailwind_kt]
        if ok:
            return ok[0], "Słaby/zmienny wiatr: pas preferowany"
    if wind_dir is None or wind_speed is None:
        return scored[0], "Brak kierunku wiatru: pierwszy pas z listy"

    best = max(scored, key=lambda r: (r["headwind"], -abs(r["crosswind"] or 0), r.get("preferred", 0)))
    return best, "Największa składowa czołowa"
