import { BASEMAPS, api, esc, h, subtabs } from "../api.js";

const DEFAULT_IDS = "EPWA EPMO EPKK EPKT EPGD EPPO EPWR EPLL EPRZ EPLB EPSC EPBY EPSY EPZG EPRA";

function metarTaf(pane) {
  pane.append(h(`<div>
    <div class="toolbar">
      <input type="text" class="ids field" size="70" value="${localStorage.getItem("meteo.ids") || DEFAULT_IDS}">
      <button class="btn primary go">Pobierz</button>
      <label><input type="checkbox" class="auto" checked> odświeżaj co 2 min</label>
      <span class="hint upd"></span>
    </div>
    <table class="data"><thead><tr><th style="width:60px">ICAO</th><th style="width:60px">Kat.</th><th>METAR</th><th>TAF</th></tr></thead><tbody></tbody></table>
  </div>`));
  const $ = (s) => pane.querySelector(s);
  const load = async () => {
    const ids = $(".ids").value.trim().split(/[\s,]+/).filter(Boolean).join(",");
    localStorage.setItem("meteo.ids", $(".ids").value.trim());
    try {
      const [m, t] = await Promise.all([api(`/api/meteo/metar?ids=${ids}`), api(`/api/meteo/taf?ids=${ids}`).catch(() => [])]);
      const taf = Object.fromEntries(t.map((x) => [x.icao, x.raw]));
      $("tbody").innerHTML = m.map((x) => `<tr><td class="mono"><b>${esc(x.icao)}</b></td>
        <td><span class="badge cat-${esc(x.parsed?.flight_category)}">${esc(x.parsed?.flight_category || "–")}</span></td>
        <td class="mono">${esc(x.raw || "brak")}</td><td class="mono hint"><pre>${esc(taf[x.icao] || "")}</pre></td></tr>`).join("");
      $(".upd").textContent = "Aktualizacja " + new Date().toISOString().slice(11, 16) + "Z";
    } catch (e) {
      $("tbody").innerHTML = `<tr><td colspan="4" class="error">${esc(e.message)}</td></tr>`;
    }
  };
  $(".go").addEventListener("click", load);
  $(".ids").addEventListener("keydown", (e) => e.key === "Enter" && load());
  const timer = setInterval(() => $(".auto")?.checked && load(), 120000);
  load();
  return { destroy: () => clearInterval(timer) };
}

function qnhMap(pane) {
  pane.append(h(`<div class="mapwrap"><div class="mapside"><h4>QNH REGIONALNE</h4><div class="regions">Ładowanie…</div>
    <p class="hint note"></p></div><div class="map"></div></div>`));
  const map = L.map(pane.querySelector(".map")).setView([52.0, 19.3], 6);
  BASEMAPS.dark(L).addTo(map);
  api("/api/aerodromes").then(async (ads) => {
    const pos = Object.fromEntries(ads.map((a) => [a.icao, a]));
    try {
      const data = await api("/api/meteo/qnh-regions");
      pane.querySelector(".note").textContent = data.note || "";
      pane.querySelector(".regions").innerHTML = `<table class="data">${data.regions.map((r) =>
        `<tr><td><span style="color:${r.color}">■</span> ${esc(r.name)}</td><td class="num big" style="font-size:20px">${r.qnh ?? "–"}</td></tr>`).join("")}</table>`;
      data.regions.forEach((r) => r.stations.forEach((s) => {
        const a = pos[s.icao];
        if (!a) return;
        L.circleMarker([a.lat, a.lon], { radius: 6, color: r.color, fillOpacity: 0.8 }).addTo(map)
          .bindTooltip(`${s.icao} ${s.qnh ?? "–"}`, { permanent: true, direction: "right", className: "lbl" });
      }));
    } catch (e) {
      pane.querySelector(".regions").innerHTML = `<span class="error">${esc(e.message)}</span>`;
    }
  });
  setTimeout(() => map.invalidateSize(), 50);
}

function windy(pane) {
  const url = "https://embed.windy.com/embed2.html?lat=52.0&lon=19.3&detailLat=52.17&detailLon=20.97&zoom=6&level=surface&overlay=wind&product=ecmwf&menu=&message=true&marker=&calendar=now&pressure=true&type=map&location=coordinates&detail=&metricWind=kt&metricTemp=%C2%B0C&radarRange=-1";
  pane.append(h(`<iframe class="embed" src="${url}" allowfullscreen></iframe>`));
}

export default {
  mount(root) {
    subtabs(root, [
      { id: "metar", label: "METAR / TAF", render: metarTaf },
      { id: "qnh", label: "QNH REGIONALNE", fill: true, render: qnhMap },
      { id: "windy", label: "WINDY", fill: true, render: windy },
    ]);
  },
};
