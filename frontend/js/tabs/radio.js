import { api, esc, h, subtabs } from "../api.js";

const TYPE_ORDER = ["CTR", "FSS", "APP", "DEP", "TWR", "GND", "DEL", "ATIS"];

function groups(list, keyFn) {
  const g = {};
  list.forEach((p) => (g[keyFn(p)] ||= []).push(p));
  Object.values(g).forEach((arr) => arr.sort((a, b) =>
    TYPE_ORDER.indexOf(a.callsign.split("_").pop()) - TYPE_ORDER.indexOf(b.callsign.split("_").pop()) || a.callsign.localeCompare(b.callsign)));
  return Object.entries(g).sort(([a], [b]) => a.localeCompare(b));
}

function renderGroups(pane, entries, online = {}) {
  pane.innerHTML = entries.length ? entries.map(([name, ps]) => `<div class="radio-group"><h3>${esc(name)}</h3>${ps.map((p) => `
      <div class="radio-row"><span class="freq" style="${online[p.position_id] ? "border-color:#5fd23a;box-shadow:0 0 8px #5fd23a" : ""}">${esc(p.frequency)}</span>
      <span class="cs">${esc(p.callsign)}</span><span class="nm">${esc(p.name)}${online[p.position_id] ? ` · <b style="color:#5fd23a">ONLINE ${esc(online[p.position_id].callsign)}</b>` : ""}</span></div>`).join("")}</div>`).join("")
    : `<p class="hint">Brak stanowisk. Zaimportuj plik .ese do data/import/.</p>`;
}

export default {
  mount(root) {
    let all = null;
    const load = async () => (all ||= await api("/api/nav/positions"));
    const view = (filter, keyFn) => (pane) => {
      load().then((ps) => renderGroups(pane, groups(ps.filter(filter), keyFn))).catch((e) => { pane.innerHTML = `<p class="error">${esc(e.message)}</p>`; });
    };
    subtabs(root, [
      { id: "fir", label: "EPWW ACC", render: view((p) => p.prefix === "EPWW", (p) => p.name) },
      { id: "ad", label: "LOTNISKA", render: view((p) => p.prefix?.startsWith("EP") && p.prefix !== "EPWW", (p) => p.prefix) },
      { id: "nb", label: "SĄSIEDZI", render: view((p) => !p.prefix?.startsWith("EP"), (p) => p.prefix || "?") },
      { sep: true },
      { id: "online", label: "ONLINE", render: (pane) => {
        pane.innerHTML = `<p class="hint">Pobieranie danych VATSIM…</p>`;
        Promise.all([load(), api("/api/nav/sectors/online")]).then(([ps, on]) => {
          const byId = {};
          ps.forEach((p) => { if (on.online_positions.some((o) => o.position === p.callsign)) byId[p.position_id] = on.online_positions.find((o) => o.position === p.callsign); });
          const list = ps.filter((p) => byId[p.position_id]);
          renderGroups(pane, groups(list, (p) => p.prefix), byId);
          if (!list.length) pane.innerHTML = `<p class="hint">Nikt z EPWW nie jest teraz online.</p>`;
        }).catch((e) => { pane.innerHTML = `<p class="error">${esc(e.message)}</p>`; });
      } },
    ]);
  },
};
