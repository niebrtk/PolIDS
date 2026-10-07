import { api, esc, h } from "../api.js";

const CHANGES = [
  ["07.10.2026", "Wersja 0.9.1. MAP: poprawiony kształt sektora UKLV (Lwów) – bez fałszywego trójkąta w środku; szare nazwy FIR-ów nie zasłaniają już częstotliwości sąsiada."],
  ["06.10.2026", "Wersja 0.9.0. RADIO › GEO: kafelki stanowisk jak strony GEO w VACS (bez FMP), z częstotliwościami i tym, kto jest online; obok mapa zasięgu: kliknij jedną lub kilka pozycji (także dowolne stanowiska FIR-ów sąsiednich), żeby zobaczyć, co obsługują. Sąsiedzi: wszystkie stanowiska z pliku .ese i vacs-data, zasięgi z VATSpy."],
  ["06.10.2026", "RADIO › SEKTORYZACJA (przeniesiona z MAP): kolejność przejmowania sektorów ACC z om.plvacc.pl › ownerships zamiast VACS, lista stanowisk w jednej kolumnie, krótkie nazwy pozycji (PO N APP, EPWW DBF, EDMM MEI, WA TWR)."],
  ["06.10.2026", "TMA i CTR z pełną kolejnością przejmowania: najpierw APP i TWR z pliku .ese, potem ACC wg om.plvacc.pl. RADIO › SEKTORYZACJA: karta TMA i CTR, stanowiska APP/TWR w symulacji. MAP: dymek TMA, CTA i CTR pokazuje wszystkie stanowiska po kolei z częstotliwością i tym, kto jest online; warstwa CTA (np. CTA 02 nad TMA Warszawa) domyślnie włączona. RADIO › GEO: kafelki sąsiadów w kolorach FIR-ów jak w VACS. Komunikaty po polsku, gdy serwer vPANDORA nie odpowiada."],
  ["06.10.2026", "MAP: przestrzeń rysowana dla wybranego poziomu (FL) albo dla wszystkich poziomów, listy do wyboru pojedynczych sektorów ACC, TMA, CTR i FIR-ów sąsiednich, opis TMA/CTR po najechaniu, samoloty w kolorach odlot / przylot / tranzyt, ATIS z nazwiskiem kontrolera, bez UNICOM i bez hierarchii dziedziczenia. Naprawione podświetlanie TMA Warszawa przy EPWA APP online."],
  ["06.10.2026", "METEO: WIND (dawniej WINDY) z przełącznikiem 0 ft / 3000 ft na podejściu (punkt FAF/IAF każdego pasa), METAR i TAF alfabetycznie. AERODROME: wiatr 0 ft i 3000 ft w punktach podejścia (Open-Meteo), pasy ARR/DEP w kolorach listy lotów."],
  ["06.10.2026", "AIRCRAFT: przyciski AIRBUS, BOEING, EMBRAER, MCDONNELL, ATR, CESSNA. Cała aplikacja w czcionce Consolas."],
  ["06.10.2026", "MAP › SEKTORYZACJA: trzy mapy LOW / MID / HIGH z dziedziczeniem sektorów EPWW przez konkretne stanowiska (łańcuchy z vacs-data), tryb VATSIM teraz i symulacja, tabela kto co obsługuje, różnice względem pliku .ese. Sektoryzacja na głównej mapie i w RADIO liczona tak samo."],
  ["06.10.2026", "RADIO: stanowiska w FIR-ach sąsiednich nazwane jak w profilu VACS ACC_EPWW, z dopiskiem wysokości (np. ESMM 6 +365) i podpowiedzią, kto przejmuje sektor, gdy główne stanowisko jest offline."],
  ["06.10.2026", "AERODROME › RUCH: loty jako paski postępu lotu w stylu EFES (odloty niebieskie, przyloty żółte, loty lokalne różowe), SID/STAR z pliku .ese, czasy vIFF/CDM. PRZEGLĄD bez tabeli lotów."],
  ["06.10.2026", "Nowy wygląd w stylu EUROCONTROL NM UI (panele z paskiem tytułu, gęste tabele, płaskie przyciski), zakładki i kolory bez zmian. Bez poświaty w napisach. Po uruchomieniu zawsze strona startowa „?”."],
  ["06.10.2026", "AERODROME: widok AWOS (wiatr DEP/ARR lub TDZ/MID/END, QNH/QFE, LVP, ATIS), godziny wschodu i zachodu słońca, wyśrodkowane tabele."],
  ["06.10.2026", "METEO: mapa QNH regionalnego jak w vAWOS (sektory, TMA, ramki z QNH)."],
  ["06.10.2026", "MAP: przepustowość sektorów najpierw jako aktywne scenariusze vIFF, pod nimi lista TV; status lotu jak w NM UI z wejściami w sektory; legenda w zakładkach."],
  ["06.10.2026", "RADIO: przyciski szybkiego skoku do lotnisk. PHRASEOLOGY: znów ramka z linkiem do Learning Zone."],
  ["05.10.2026", "AERODROME: odloty z vIFF (EOBT, CTOT, status lotu, na EPWA TOBT/TSAT/AOBT/TTOT) zamiast RFL/GS/poziomu, bez checklisty, kt w tabeli pasów, róża wiatrów z ARR/DEP i pasem sugerowanym (kreskowanie)."],
  ["05.10.2026", "MAP: TMA i CTR, ruch vs przepustowość sektorów z vIFF na godzinę naprzód, sylwetki samolotów, karta lotniska z METAR, kontrolerami i ATIS, plakietki tylko w FIR EPWW, VOR/NDB domyślnie ukryte."],
  ["05.10.2026", "MAP: plakietki kontrolerów online jak w VATSIM Radar (D/G/T/A/APP przy lotnisku, CTR przy FIR) z dymkiem, częstotliwości bez poświaty."],
  ["05.10.2026", "AERODROME: wszystko na jednym ekranie. EMERGENCY w jednej kolumnie. PHRASEOLOGY otwiera się w nowej karcie."],
  ["05.10.2026", "EMERGENCY: 16 checklist EUROCONTROL + ASSIST. Nowe zakładki CHECKLIST (vatiris) i PHRASEOLOGY."],
  ["05.10.2026", "AERODROME: pas preferowany (wiatr, ILS, LVP) albo pas z ATIS, róża z kierunkiem pasa, ruch VATSIM, NOTAM-y z czasem ważności i sortowaniem."],
  ["05.10.2026", "RADIO: rezerwacje tylko na dziś, FIS sąsiadów w ich FIR-ach, LOTNISKA w jednej kolumnie. MAP: symbole EuroScope, czytelna trasa, podkład jasny/biały, nowy panel."],
  ["05.10.2026", "RADIO: kto jest online i rezerwacje (VATSIM), mapa EPWW ACC, FIR-y sąsiednie jako podzakładki, FIS w EPWW ACC."],
  ["05.10.2026", "METEO: TAF w liniach, mapa QNH jak w PANDORZE. AERODROME: LVP, rezerwacje, NOTAM tylko dla lotniska."],
  ["05.10.2026", "MAP: samoloty z VATSIM i ich trasy, granice FIR. CALLSIGN: CARGO / MIL. AIRCRAFT: zdjęcia lokalne."],
  ["05.10.2026", "Wygląd wzorowany na PANDORZE: zielone menu, podmenu, kolorowane METAR-y."],
  ["05.10.2026", "Import sektorówki EPWW, navdata EuroScope, bazy callsignów i typów samolotów."],
  ["05.10.2026", "Pierwsza wersja vPANDORA do testów lokalnych."],
];

// kafelki na stronie startowej: skróty do zakładek (jak strona domowa NM UI)
const TILES = [
  ["aerodrome", "AERODROME", "Lotnisko na jednym ekranie: METAR, wiatr, pasy, ATIS, ruch z vIFF, NOTAM, widok AWOS."],
  ["meteo", "METEO", "METAR i TAF lotnisk, mapa QNH regionalnego, wiatr przy ziemi i na podejściu."],
  ["map", "MAP", "Ruch VATSIM, przestrzeń na wybranym poziomie, TMA/CTR, przepustowość sektorów i status lotu z vIFF."],
  ["radio", "RADIO", "Kafelki GEO z częstotliwościami, zasięg stanowisk na mapie, sektoryzacja, kto jest online i rezerwacje na dziś."],
  ["callsign", "CALLSIGN", "Znaki wywoławcze linii lotniczych."],
  ["aircraft", "AIRCRAFT", "Typy samolotów wg producenta, kategorie turbulencji, zdjęcia."],
  ["checklist", "CHECKLIST", "Otwarcie i zamknięcie stanowiska, przekazanie, zmiana pasa."],
  ["emergency", "EMERGENCY", "ASSIST i checklisty sytuacji awaryjnych."],
];

export default {
  mount(root, ctx) {
    const pane = h(`<div class="pane about">
      <div class="about-head">
        <div class="logo">vPANDORA<small>Integrated Air Traffic Management Display System · VATSIM PL vACC</small></div>
        <div class="card about-info"><h3>System</h3><dl class="props info"></dl></div>
      </div>
      <div class="about-tiles">${TILES.map(([tab, name, txt]) => `<button class="about-tile${tab === "emergency" ? " red" : ""}" data-open="${tab}"><b>${name}</b><span>${esc(txt)}</span></button>`).join("")}</div>
      <div class="card about-changes"><h3>Ostatnie zmiany</h3>
        <table class="data"><tbody>${CHANGES.map(([d, t]) => `<tr><td class="mono">${esc(d)}</td><td>${esc(t)}</td></tr>`).join("")}</tbody></table></div>
    </div>`);
    root.append(pane);
    pane.querySelector(".about-tiles").addEventListener("click", (e) => {
      const b = e.target.closest("[data-open]");
      if (b) location.hash = b.dataset.open;
    });
    const load = async () => {
      const st = await api("/api/status").catch(() => ({ counts: {} }));
      const c = st.counts;
      const row = (k, v) => `<dt>${k}</dt><dd>${v}</dd>`;
      pane.querySelector(".info").innerHTML = row("Wersja", "0.9.1")
        + row("Cykl AIRAC", `${esc(ctx.config.airac.ident)} (od ${esc(ctx.config.airac.effective)})`)
        + row("Dane", `${c.aerodromes ?? "–"} lotnisk, ${c.aircraft_types ?? "–"} typów samolotów, ${c.callsigns ?? "–"} callsignów`)
        + row("Nawigacja", `${c.nav_points ?? "–"} punktów, ${c.airway_segments ?? "–"} odcinków dróg, ${c.sectors ?? "–"} sektorów, ${c.atc_positions ?? "–"} stanowisk ATC`)
        + row("Klucz CARTO", ctx.config.carto_api_key ? "wczytany" : "brak (mapa używa zastępczego podkładu Esri)")
        + row("Klucz OpenAIP", ctx.config.openaip_api_key ? "wczytany" : "brak")
        + row("API", `<a href="/docs" target="_blank">/docs</a>`);
    };
    return { activate: load };
  },
};
