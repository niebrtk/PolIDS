import { api, esc, h } from "../api.js";

const CHANGES = [
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
        Wersja oprogramowania: 0.2.0<br>
        Cykl AIRAC: ${esc(ctx.config.airac.ident)} (od ${esc(ctx.config.airac.effective)})<br><br>
        Dane: ${c.aerodromes ?? "–"} lotnisk, ${c.aircraft_types ?? "–"} typów samolotów, ${c.callsigns ?? "–"} callsignów,<br>
        ${c.nav_points ?? "–"} punktów, ${c.airway_segments ?? "–"} odcinków dróg, ${c.sectors ?? "–"} sektorów, ${c.atc_positions ?? "–"} stanowisk ATC<br><br>
        API: <a href="/docs" target="_blank">/docs</a>`;
    };
    return { activate: load };
  },
};
