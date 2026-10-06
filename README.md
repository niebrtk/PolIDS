# vPANDORA

Aplikacja webowa dla kontrolerów VATSIM PL vACC wzorowana na systemie PANDORA (PAŻP).
Backend w Pythonie (FastAPI + SQLite), frontend w czystym HTML/JS, który rozmawia wyłącznie z API.
Aplikacja działa lokalnie na komputerze kontrolera pod adresem <http://127.0.0.1:8000>. Nie da się jej wystawić na
GitHub Pages, bo Pages serwuje tylko pliki statyczne i nie uruchomi backendu w Pythonie.

Zakładki jak w PANDORZE: czarne tło, kolumna zielonych przycisków menu i druga kolumna podmenu. Treść zakładek w stylu
aplikacji EUROCONTROL NM UI (panele z paskiem tytułu, gęste tabele, płaskie przyciski), w czarno-zielonej kolorystyce
i bez poświaty pod napisami. Po uruchomieniu aplikacja zawsze otwiera stronę startową „?”.

| Menu | Co jest | Skąd dane |
|---|---|---|
| **?** | strona startowa: wersja, AIRAC, stan bazy, kafelki skrótów do zakładek, ostatnie zmiany | API |
| **RADIO** | EPWW ACC (lista CTR i polskich FIS + mapa sektorów z obsadą), lotniska (IFR, VFR, MIL) w jednej kolumnie z paskiem przycisków do szybkiego skoku na lotnisko, każdy FIR sąsiedni osobno (najpierw ACC/CTR); podświetlenie kto jest online i rezerwacji na bieżącą dobę UTC | `.ese`, [VATSIM data feed i ATC bookings](https://vatsim.dev/services/apis), granice FIR z VATSpy |
| **METEO** | METAR PL / MIL / INTL, TAF PL / INTL (kolorowane, okresy zmian w osobnych liniach), mapa QNH regionalnego jak w vAWOS (rejony 1–17, TMA/MTMA z opisami „BELOW TMA QNH FROM …”, ramki z QNH, tabele rejonów i TMA), Windy (wiatr, radar, satelita) | metar.vatsim.net / aviationweather.gov |
| **AERODROME** | dwa widoki: **PRZEGLĄD** i **AWOS**. PRZEGLĄD: jeden ekran bez przewijania, trzy kolumny (długie listy przewijają się w swoich okienkach), tabele wyśrodkowane, **wschód i zachód słońca oraz zmierzch cywilny (UTC)**, róża wiatrów (kolor = ARR/DEP, pełne wypełnienie = pas z ATIS, kreskowane = pas sugerowany przez vPANDORA), QNH/QFE, widzialność, chmury, RVR, tabela pasów ze składowymi wiatru w kt, **pas w użyciu z ATIS** albo **pas preferowany** (wiatr, ILS, LVP), **wskaźnik LVP z powodem**, wiek METAR, TAF, ATIS, ruch VATSIM: przyloty, prefile i **odloty z danymi vIFF** (EOBT, CTOT, status lotu jak w liście lotów NM: FI / SI / FLS / OB / TA, a na EPWA z A-CDM także TOBT, TSAT, AOBT, TTOT), NOTAM-y lotniska z czasem ważności i sortowaniem, częstotliwości z obsadą i rezerwacjami. AWOS (pomysł z vAWOS, własna implementacja): górny pasek (UTC, QNH/QFE, LVP, VMC/IMC, wiek METAR, słońce), kolumny DEP/ARR (EPWA) albo TDZ/MID/END z tarczą wiatru, średnią 2 min, min/maks., HW/TW, XW, RVR, VIS, chmury, T/TD, ATIS, na dole METAR/TAF/NOTAM. **Wiatr chwilowy jest symulowany z METAR** (oznaczenie SYM) | METAR/TAF jw., NOTAM z cv.plvacc.pl, VATSIM, [vIFF](https://api.viffsys.com/docs), pasy z OurAirports, podejścia (ILS) z procedur w `.ese`, `data/seed/runway_config.json`, progi LVP w `data/seed/lvp.json` |
| **AD CIV / AD MIL / AD VFR** | eAIP PAŻP | iframe + „otwórz w nowej karcie” |
| **CALLSIGN** | baza callsignów, podmenu A–Z, oznaczenie CARGO / MILITARY | `ICAO_Airlines.txt`, `GRpluginOperatorInfo.txt` |
| **AIRCRAFT** | typy: WTC, RECAT-EU, wymiary, MTOW, zdjęcie, link do EUROCONTROL Aircraft Performance Database, podmenu A–Z | aircraft-database.com + `ICAO_Aircraft.json`, zdjęcia w `data/photos/` (brakujące pobierane raz z Wikipedii) |
| **MAP** | sektory EPWW na wybranym FL z aktualną obsadą, **TMA i CTR** (kontury z `.sct`, wypełnione, gdy APP / TWR jest online), FIR-y sąsiednie jako kontury, samoloty z VATSIM jako sylwetki samolotów (kliknięcie = plan lotu i trasa), trasa z planu lotu po drogach lotniczych, lotniska / VOR / NDB / FIX / punkty VFR symbolami EuroScope (VOR i NDB domyślnie wyłączone), **plakietki kontrolerów online jak w VATSIM Radar** (w FIR EPWW wszystkie: D = Delivery, G = Ground, T = Tower, A = ATIS, APP; u sąsiadów tylko APP; CTR przy FIR EPWW), **karta lotniska po najechaniu** (ICAO, nazwa, METAR, kto jest online, ATIS), **przepustowość sektorów z vIFF**: najpierw aktywne scenariusze (z ich traffic volumes i obciążeniem), niżej rozwijane nieaktywne, pod spodem lista wszystkich TV (aktywne / nieaktywne); wykres wejść na godzinę i liczby samolotów w sektorze minuta po minucie, tabela lotów jak w NM UI, obrys sektora na mapie. **Szczegóły lotu jak w NM UI** po kliknięciu samolotu: pozycja z VATSIM, czasy vIFF (EOBT, TOBT, TSAT, CTOT, ATOT, ETA), regulacja, trasa, rozwijane **wejścia w kolejne sektory** i historia vIFF. Panel boczny ze zwijanymi sekcjami, legenda w zakładkach. Podkład ciemny, jasny, biały albo OSM | `.sct`, `.ese`, `airway.txt`, `isec.txt`, VATSIM, VATSpy, vIFF |
| **INOP** | om.plvacc.pl | iframe |
| **DOCS** | PDF-y z folderu `data/docs/` otwierane w aplikacji | `data/docs/` |
| **PHRASEOLOGY** | „Say Again? The Phraseology Database” z EUROCONTROL Learning Zone (link pełnoekranowy) w ramce; nad nią przycisk „otwórz w nowej karcie” i uwaga, gdy serwis blokuje ramki (X-Frame-Options SAMEORIGIN) | `VPANDORA_PHRASEOLOGY_URL` |
| **CHECKLIST** | Open position, Close position, Handover/takeover, Runway change (zaznaczenia zostają w przeglądarce) | `data/seed/checklists.json` (z vatiris) |
| **EMERGENCY** | procedury awaryjne do wyboru: ASSIST, A06 i 16 checklist EUROCONTROL, każda w jednej kolumnie (czerwona ramka) | `data/seed/emergency.json` |

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
serwer NOTAM, klucz OpenAIP do nakładki lotniczej na mapie i klucz CARTO do podkładów mapy (darmowy z <https://carto.com/basemaps/apikey>;
bez niego CARTO dodaje na kafelkach znak wodny „API KEY REQUIRED”, więc mapa używa wtedy szarego podkładu Esri).

Klucze API wpisuj tylko w lokalnym pliku `.env` (jest w `.gitignore`), np. `VPANDORA_CARTO_API_KEY=...`.
Jeśli za każdym razem pobierasz nowy ZIP do nowego folderu, plik `.env` zostaje w starym folderze. Wtedy wygodniej
ustawić klucz raz jako zmienną środowiskową Windows (w oknie `cmd`): `setx VPANDORA_CARTO_API_KEY twoj_klucz`,
a potem zamknąć okno serwera i uruchomić `run.bat` od nowa podwójnym kliknięciem (`setx` działa tylko w oknach
otwartych po nim). Zakładka **?** pokazuje, czy klucz został wczytany.
Plik `.venv\pyvenv.cfg` to konfiguracja środowiska Pythona, aplikacja go nie czyta.
Repozytorium jest publiczne, więc klucze nie powinny trafiać do żadnego pliku w repo.

### Aktualizacja danych

- Nowa sektorówka: podmień pliki w `data/import/` i uruchom aplikację ponownie (zmienione pliki wczytają się same)
  albo `python -m backend.app.importers.seed --force`.
- Lotniska/pasy/VOR z OurAirports: `python scripts/fetch_ourairports.py`, potem usuń `data/vpandora.db`.
- Baza samolotów: `python scripts/build_aircraft_seed.py ŚCIEŻKA/do/aircraft-db`.
- Konfiguracja bez kodu: `data/seed/qnh_regions.json` (regiony QNH), `data/seed/lvp.json` (progi LVP),
  `data/seed/runway_config.json` (pasy preferowane), `data/seed/checklists.json` (checklisty),
  `data/seed/emergency.json` (procedury awaryjne), `data/seed/callsigns.csv`.

### Pas preferowany (AERODROME)

Gdy na lotnisku nadaje ATIS w sieci VATSIM, pas w użyciu i litera ATIS są czytane z jego tekstu
(np. „RWY 29 IN USE”, „33 FOR LANDING, 29 FOR TAKEOFF”). Bez ATIS-u vPANDORA wskazuje pas preferowany
według zasady z [vatiris](https://github.com/minsulander/vatiris) (`stores/wind.ts`):

1. przy LVP, przygotowaniu LVP albo IMC: kierunek z ILS, jeśli wiatr w plecy nie przekracza 5 kt;
2. przy wietrze słabszym niż limit (domyślnie 5 kt): konfiguracja z `data/seed/runway_config.json` (`arr`/`dep`),
   a bez niej kierunek wyposażony w ILS;
3. w pozostałych przypadkach: największa składowa czołowa.

Wyposażenie pasów (ILS, RNP, VOR, NDB) jest odczytywane z nazw procedur podejścia w pliku `.ese`. Konfiguracje
w `runway_config.json` (na razie tylko EPWA: lądowanie 33, start 29) warto sprawdzić z LoA / AIP.

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
│   ├── css/style.css, awos.css, qnh.css, viff.css
│   ├── js/app.js, api.js      # przełączanie zakładek, wspólne funkcje
│   ├── js/awos.js, viffchart.js # widok AWOS (AERODROME), wykres przepustowości i tabela lotów vIFF (MAP)
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
- Pas preferowany przy słabym wietrze jest skonfigurowany tylko dla EPWA; kategorie ILS (CAT I/II/III) nie są
  jeszcze brane pod uwagę.
- Parser ATIS rozpoznaje typowe formaty vATIS; przy nietypowym tekście pokazuje pas preferowany i informację, że ATIS jest online.
- EUROCONTROL Learning Zone odrzuca wyświetlanie w ramce (X-Frame-Options SAMEORIGIN). PHRASEOLOGY i tak próbuje ramki;
  jeśli przeglądarka pokaże w niej blokadę, działa przycisk „Otwórz w nowej karcie”. Baza osiągów zawsze otwiera się w nowej karcie
  (link: `.../ATCPFDB/details.aspx?ICAO=<kod>`).
- vIFF (api.viffsys.com) nie publikuje schematów odpowiedzi; pola odczytujemy tak, jak je zwraca API (stan z 05.10.2026).
  Odczyt działa bez klucza. TOBT/TSAT/TTOT pojawiają się tylko wtedy, gdy kontroler na EPWA prowadzi CDM we wtyczce EuroScope.
  Godziny w vIFF nie mają daty, więc przejście przez północ liczymy względem bieżącej godziny UTC. Obrys sektora na mapie
  pokazuje zasięg poziomy sektora EPWW (wszystkie warstwy), bez podziału na poziomy H/M/L. Wejścia lotu w sektory liczymy
  z godzinowych danych traffic volumes vIFF (tylko TV z prefiksem EP), nie z pełnego profilu lotu.
- AWOS w AERODROME nie ma czujników: wiatr chwilowy, średnia 2 min i min/maks. są symulowane z METAR (oznaczenie SYM),
  RVR, widzialność, chmury i temperatura pochodzą z METAR, więc są takie same w kolumnach TDZ/MID/END.
- Plakietki ATC na mapie stawiamy tylko przy lotniskach, które są w bazie punktów (navdata EuroScope); stanowiska
  z prefiksem innym niż kod ICAO lotniska (np. 3-literowe z USA) są pomijane.
- QFE liczone w przybliżeniu z QNH i elewacji lotniska.
- Brak logowania (aplikacja do użytku lokalnego / w sieci vACC).
- API rezerwacji VATSIM podaje tylko CID. Imię i nazwisko przy rezerwacji widać, gdy ta osoba jest akurat zalogowana w sieci.
- Rejony QNH i TMA (`data/seed/qnh_regions.json`) są odrysowane w przybliżeniu ze zrzutów ekranu PANDORY i vAWOS
  (repozytorium vAWOS nie zawiera mapy QNH). Pomarańczowe linie z mapy vAWOS i znaczenie rejonów 15–17 nie są jeszcze
  potwierdzone; rejony 15–17 to pasy przy granicy wschodniej jak w PANDORZE.
- Progi LVP w `data/seed/lvp.json` to wartości domyślne do sprawdzenia z INOP EPWW (om.plvacc.pl).

## Licencje danych

- Typy samolotów: [aircraft-database.com](https://aircraft-database.com) (ODC-By), progi WTC/RECAT i nadpisania z
  [vatger/atciss](https://github.com/vatger/atciss) (MIT).
- Lotniska, pasy, pomoce nawigacyjne: [OurAirports](https://ourairports.com/data/) (domena publiczna).
- Leaflet (BSD-2), podkład CARTO/OpenStreetMap (ODbL), zastępczy podkład Esri World Gray Canvas (Esri, HERE, Garmin, OSM).
- Dane ATFCM/CDM (CTOT, status lotu, A-CDM, przepustowość sektorów): [vIFF](https://viffsys.com) (Roger Puig), tylko odczyt.
- Granice FIR: [vatsimnetwork/vatspy-data-project](https://github.com/vatsimnetwork/vatspy-data-project) (CC BY-SA 4.0), plik `data/seed/vatspy_firs.geojson`.
- Zdjęcia samolotów pobierane z Wikipedii; autor i licencja są na stronie artykułu podlinkowanej pod zdjęciem.
- Pliki EuroScope (pakiet sektorowy PL vACC / GNG) są w `data/import/`, PDF-y w `data/docs/`.
- Układ widoku AWOS i mapy QNH regionalnego wzorowany na [vAWOS](https://github.com/aleksandermarcingadomski-commits/vAWOS);
  repozytorium nie ma licencji, więc nie kopiujemy kodu, a widok jest napisany od nowa.
- Checklisty stanowiska i zasada wyboru pasa: [minsulander/vatiris](https://github.com/minsulander/vatiris) (GPL-3.0).
- Checklisty EMERGENCY: EUROCONTROL, *Guidelines for Controller Training in the Handling of Unusual/Emergency Situations*
  (HRS/TSP-004-GUI-05, wyd. 2.0), Annex A i B.
