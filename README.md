# vPANDORA

Aplikacja webowa dla kontrolerów VATSIM PL vACC wzorowana na systemie PANDORA (PAŻP).
Backend w Pythonie (FastAPI + SQLite), frontend w czystym HTML/JS, który rozmawia wyłącznie z API.
Aplikacja działa lokalnie na komputerze kontrolera pod adresem <http://127.0.0.1:8000>. Nie da się jej wystawić na
GitHub Pages, bo Pages serwuje tylko pliki statyczne i nie uruchomi backendu w Pythonie.

Wygląd wzorowany na PANDORZE: czarne tło, kolumna zielonych przycisków menu i druga kolumna podmenu.

| Menu | Co jest | Skąd dane |
|---|---|---|
| **?** | wersja, AIRAC, stan bazy, ostatnie zmiany | API |
| **RADIO** | częstotliwości stanowisk EPWW, lotnisk i sąsiadów, kto jest online | `.ese` + [VATSIM data feed](https://vatsim.dev/services/apis) |
| **METEO** | METAR PL / MIL / INTL, TAF PL / INTL (kolorowane), QNH regionalne, Windy (wiatr, radar, satelita), IMGW AWIACJA | metar.vatsim.net / aviationweather.gov, awiacja.imgw.pl |
| **AERODROME** | AWOS: róża wiatrów, QNH/QFE, widzialność, chmury, RVR, składowe wiatru, **pas sugerowany**, METAR/TAF, NOTAM, częstotliwości, checklista | METAR/TAF jw., NOTAM z cv.plvacc.pl, pasy z OurAirports, stanowiska z `.ese` |
| **AD CIV / AD MIL / AD VFR** | eAIP PAŻP | iframe + „otwórz w nowej karcie” |
| **CALLSIGN** | baza callsignów, podmenu A–Z | `ICAO_Airlines.txt` |
| **AIRCRAFT** | typy: WTC, RECAT-EU, wymiary, MTOW, zdjęcie, podmenu A–Z | aircraft-database.com + `ICAO_Aircraft.json` |
| **MAP** | sektory EPWW na wybranym FL, aktualna sektoryzacja z VATSIM, trasa z planu lotu po drogach lotniczych, VOR/NDB/FIX | `.sct`, `.ese`, `airway.txt`, `isec.txt` |
| **INOP** | om.plvacc.pl | iframe |
| **DOCS** | PDF-y otwierane w aplikacji, upload | `data/docs/` |
| **EMERGENCY** | procedury awaryjne (czerwona ramka) | `data/seed/emergency.json` |

Dokumentacja API (Swagger) po uruchomieniu: <http://127.0.0.1:8000/docs>

## Uruchomienie na Windows

1. Zainstaluj **Python 3.11 lub nowszy** z <https://www.python.org/downloads/> (zaznacz „Add python.exe to PATH”).
2. Pobierz kod z gałęzi `claude/vpandora-local-mvp-ovbih3`: na GitHubie wybierz tę gałąź i kliknij *Code → Download ZIP*
   albo `git clone -b claude/vpandora-local-mvp-ovbih3 https://github.com/niebrtk/vpandora.git`.
3. Pliki sektorowe EPWW i navdata są już w `data\import\`. Przy nowej sektorówce podmień je tam (lista w [data/import/README.md](data/import/README.md)).
4. Kliknij dwukrotnie **`run.bat`**. Za pierwszym razem utworzy środowisko `.venv`, zainstaluje biblioteki,
   zbuduje bazę `data\vpandora.db` (import navdata trwa kilkanaście sekund) i otworzy <http://127.0.0.1:8000>.

Ręcznie (PowerShell):

```powershell
py -3 -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m uvicorn backend.app.main:app --reload --reload-dir backend
```

Linux/macOS: `./run.sh`.

### Aktualizacja aplikacji

Przy `git clone`: `git pull`, potem znowu `run.bat` (nowe biblioteki doinstalują się same). Przy ZIP-ie pobierz go
ponownie i rozpakuj w miejsce starego folderu. Jeśli po aktualizacji coś wygląda staro, usuń `data\vpandora.db`
(baza zbuduje się od nowa z plików w repo) i odśwież stronę przez Ctrl+F5.

### Gdy coś nie działa

- **„Unable to connect” / „Nie można połączyć”**: serwer jeszcze startuje albo okno `run.bat` zostało zamknięte.
  `run.bat` otwiera przeglądarkę dopiero, gdy serwer odpowiada; okno konsoli musi zostać otwarte.
- **Port 8000 zajęty**: zamknij poprzednie okno `run.bat` albo inny program na tym porcie.
- **Brak METAR / NOTAM / online**: te dane pobierane są na żywo z internetu (metar.vatsim.net, cv.plvacc.pl, VATSIM),
  więc wymagają połączenia. Błąd źródła widać w odpowiedniej zakładce; ostatnie pobrane dane są używane z pamięci podręcznej.

### Ustawienia

Skopiuj `.env.example` do `.env`. Najważniejsze: domyślne lotnisko, źródło METAR, linki eAIP (zmieniają się co AIRAC),
serwer NOTAM i klucz OpenAIP do nakładki lotniczej na mapie.

### Aktualizacja danych

- Nowa sektorówka: podmień pliki w `data/import/` i uruchom aplikację ponownie (zmienione pliki wczytają się same)
  albo `python -m backend.app.importers.seed --force`.
- Lotniska/pasy/VOR z OurAirports: `python scripts/fetch_ourairports.py`, potem usuń `data/vpandora.db`.
- Baza samolotów: `python scripts/build_aircraft_seed.py ŚCIEŻKA/do/aircraft-db`.
- Konfiguracja bez kodu: `data/seed/qnh_regions.json` (regiony QNH), `data/seed/checklists.json` (checklisty),
  `data/seed/callsigns.csv`.

### Testy

```
pip install -r requirements-dev.txt
python -m pytest backend/tests
```

## Struktura projektu

```
vpandora/
├── backend/
│   ├── app/
│   │   ├── main.py            # aplikacja FastAPI, serwuje też frontend
│   │   ├── config.py          # ustawienia (zmienne VPANDORA_* / plik .env)
│   │   ├── database.py        # SQLAlchemy + SQLite
│   │   ├── models.py          # tabele: lotniska, pasy, samoloty, callsigny, punkty, drogi, sektory, dokumenty
│   │   ├── routers/           # endpointy API, jeden plik na zakładkę
│   │   ├── services/          # logika: parser METAR, pas sugerowany, NOTAM, trasy, AIRAC, cache HTTP
│   │   └── importers/         # import danych: seed z repo + pliki EuroScope z data/import
│   └── tests/
├── frontend/
│   ├── index.html
│   ├── css/style.css
│   ├── js/app.js, api.js      # przełączanie zakładek, wspólne funkcje
│   ├── js/tabs/*.js           # jeden moduł na zakładkę
│   └── vendor/leaflet/        # Leaflet lokalnie (działa bez CDN)
├── data/
│   ├── seed/                  # dane startowe w repo (CSV/JSON)
│   ├── import/                # pliki EuroScope: sektorówka EPWW, navdata
│   └── docs/                  # PDF-y dla zakładki DOCS
├── scripts/                   # odświeżanie danych startowych
├── run.bat / run.sh
└── requirements.txt
```

## Znane ograniczenia (wersja do testów)

- Strony PAŻP, om.plvacc.pl, JetPhotos mogą blokować wyświetlanie w ramce (nagłówek `X-Frame-Options`).
  Wtedy działa przycisk „Otwórz w nowej karcie”. Docelowo można je pobierać przez backend.
- Format odpowiedzi serwera NOTAM (cv.plvacc.pl) nie jest udokumentowany; parser dzieli tekst po
  nagłówkach `A1234/26 NOTAMN`, a przy innym formacie pokazuje całość.
- Regiony QNH w `data/seed/qnh_regions.json` są przybliżone, do sprawdzenia z AIP ENR 1.7.
- Pas sugerowany = największa składowa czołowa; preferencje pasów przy słabym wietrze (kolumna `preferred`)
  są w bazie, ale nie są jeszcze wypełnione dla żadnego lotniska.
- QFE liczone w przybliżeniu z QNH i elewacji lotniska.
- Brak logowania (aplikacja do użytku lokalnego / w sieci vACC).

## Licencje danych

- Typy samolotów: [aircraft-database.com](https://aircraft-database.com) (ODC-By), progi WTC/RECAT i nadpisania z
  [vatger/atciss](https://github.com/vatger/atciss) (MIT).
- Lotniska, pasy, pomoce nawigacyjne: [OurAirports](https://ourairports.com/data/) (domena publiczna).
- Leaflet (BSD-2), podkład CARTO/OpenStreetMap (ODbL).
- Pliki EuroScope (pakiet sektorowy PL vACC / GNG) są w `data/import/`, PDF-y w `data/docs/`.
