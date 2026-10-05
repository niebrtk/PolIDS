import { api, esc, h } from "../api.js";

const CHANGES = [
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

export default {
  mount(root, ctx) {
    const pane = h(`<div class="pane about">
      <div style="display:flex;justify-content:space-between;gap:20px;flex-wrap:wrap">
        <div class="info"></div>
        <div class="logo">vPANDORA<small>Integrated Air Traffic Management Display System · VATSIM PL vACC</small></div>
      </div>
      <p style="margin-top:24px">Ostatnie zmiany:</p>
      <ul>${CHANGES.map(([d, t]) => `<li>[${d}] ${esc(t)}</li>`).join("")}</ul>
    </div>`);
    root.append(pane);
    const load = async () => {
      const st = await api("/api/status").catch(() => ({ counts: {} }));
      const c = st.counts;
      pane.querySelector(".info").innerHTML = `
        Wersja oprogramowania: 0.5.0<br>
        Cykl AIRAC: ${esc(ctx.config.airac.ident)} (od ${esc(ctx.config.airac.effective)})<br><br>
        Dane: ${c.aerodromes ?? "–"} lotnisk, ${c.aircraft_types ?? "–"} typów samolotów, ${c.callsigns ?? "–"} callsignów,<br>
        ${c.nav_points ?? "–"} punktów, ${c.airway_segments ?? "–"} odcinków dróg, ${c.sectors ?? "–"} sektorów, ${c.atc_positions ?? "–"} stanowisk ATC<br><br>
        Klucz CARTO: ${ctx.config.carto_api_key ? "wczytany" : "brak (mapa używa zastępczego podkładu Esri)"}<br>
        Klucz OpenAIP: ${ctx.config.openaip_api_key ? "wczytany" : "brak"}<br><br>
        API: <a href="/docs" target="_blank">/docs</a>`;
    };
    return { activate: load };
  },
};
