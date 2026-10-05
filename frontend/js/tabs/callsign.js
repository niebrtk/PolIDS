import { api, debounce, esc, h } from "../api.js";

export default {
  mount(root) {
    const pane = h(`<div class="pane">
      <div class="toolbar">
        <input type="search" class="q" placeholder="Szukaj: kod ICAO, nazwa, telefonia, kraj…" size="40" autofocus>
        <span class="hint count"></span>
      </div>
      <table class="data"><thead><tr><th>ICAO</th><th>Telefonia (callsign)</th><th>Operator</th><th>Kraj</th><th>Źródło</th></tr></thead><tbody></tbody></table>
    </div>`);
    root.append(pane);
    const q = pane.querySelector(".q");
    const body = pane.querySelector("tbody");
    const load = async () => {
      try {
        const rows = await api(`/api/callsigns?q=${encodeURIComponent(q.value.trim())}&limit=500`);
        pane.querySelector(".count").textContent = `${rows.length} wyników`;
        body.innerHTML = rows.map((r) => `<tr><td class="mono"><b>${esc(r.icao)}</b></td><td class="mono">${esc(r.telephony)}</td>
          <td>${esc(r.name)}</td><td>${esc(r.country)}</td><td class="hint">${esc(r.source)}</td></tr>`).join("");
      } catch (e) {
        body.innerHTML = `<tr><td colspan="5" class="error">${esc(e.message)}</td></tr>`;
      }
    };
    q.addEventListener("input", debounce(load));
    load();
    return { activate: () => q.focus() };
  },
};
