"""Ustawienia aplikacji. Każdą wartość można nadpisać zmienną środowiskową
z prefiksem VPANDORA_ albo wpisem w pliku .env w katalogu głównym projektu."""

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT_DIR = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT_DIR / "data"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="VPANDORA_", env_file=ROOT_DIR / ".env", extra="ignore")

    database_url: str = f"sqlite:///{(DATA_DIR / 'vpandora.db').as_posix()}"
    seed_dir: Path = DATA_DIR / "seed"
    docs_dir: Path = DATA_DIR / "docs"
    frontend_dir: Path = ROOT_DIR / "frontend"

    default_aerodrome: str = "EPWA"
    http_timeout: float = 10.0
    weather_cache_seconds: int = 120
    notam_cache_seconds: int = 600

    # METAR: "vatsim" (metar.vatsim.net, to samo co widzą piloci) albo "awc" (aviationweather.gov)
    metar_source: str = "vatsim"
    awc_api: str = "https://aviationweather.gov/api/data"
    vatsim_metar_url: str = "https://metar.vatsim.net/{icao}"

    # NOTAM z serwera PL vACC (ten sam format co w pliku konfiguracyjnym vATIS/Euroscope)
    notam_server: str = "https://cv.plvacc.pl/"
    notam_prefix: str = "notam/get-icao-format?icao="
    notam_suffix: str = "&read=true"

    # Zewnętrzne strony osadzane w zakładkach (zmieniaj przy nowym AIRAC)
    aip_ifr_url: str = "https://docs.pansa.pl/ais/eaipifr/AIRAC%20AMDT%2010-26_2026_10_01/index-v2.html"
    aip_vfr_url: str = "https://docs.pansa.pl/ais/eaipvfr/AIRAC%20AMDT%20VFR%2010-26_2026_10_01/index-v2.html"
    aip_mil_url: str = "https://docs.pansa.pl/ais/eaipmil/AIRAC%20AMDT%20MIL%2010-26_2026_10_01/index-v2.html"
    inop_url: str = "https://om.plvacc.pl/"
    sectors_url: str = "https://plvacc.pl/acc-sectors/"

    # Mapa: podkład lotniczy. OpenAIP wymaga darmowego klucza API (https://www.openaip.net)
    openaip_api_key: str = ""


settings = Settings()
