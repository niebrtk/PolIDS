import { api, esc, h, splitTaf, subtabs } from "../api.js";

const PL_CIV = "EPWA EPMO EPKK EPKT EPGD EPPO EPWR EPLL EPRZ EPLB EPSC EPBY EPSY EPZG EPRA";
const PL_MIL = "EPCE EPDA EPDE EPIR EPKS EPLK EPLY EPMB EPMI EPMM EPOK EPPR EPPW EPSN EPTM";
const INTL = "EDDB EDDF EDDM EKCH ESSA LKPR LZIB LOWW EVRA EYVI UKLL";

// Kolorowanie METAR/TAF tak jak w PANDORZE
export function colorize(raw) {
  if (!raw) return `<span class="nil">NIL</span>`;
  let rmk = false, station = false;
  return esc(raw).split(/\s+/).map((t) => {
    if (!station && /^[A-Z]{4}$/.test(t) && !["METAR", "TAF", "AUTO"].includes(t)) { station = true; return `<span class="st">${t}</span>`; }
    if (["METAR", "SPECI", "TAF", "AMD", "COR"].includes(t)) return `<span class="tm">${t}</span>`;
    if (t === "RMK") rmk = true;
    if (rmk) return `<span class="rmk">${t}</span>`;
    if (["NOSIG", "TEMPO", "BECMG", "PROB30", "PROB40"].includes(t) || /^(FM|TL|AT)\d{4}/.test(t)) return `<span class="trend">${t}</span>`;
    if (/^\d{6}Z$/.test(t) || /^\d{4}\/\d{4}$/.test(t)) return `<span class="tm">${t}</span>`;
    if (/^(\d{3}|VRB)\d{2,3}(G\d{2,3})?(KT|MPS)$/.test(t) || /^\d{3}V\d{3}$/.test(t)) return `<span class="wind">${t}</span>`;
    if (t === "CAVOK") return `<span class="cavok">${t}</span>`;
    if (/^(FEW|SCT|BKN|OVC|VV)/.test(t) || ["NSC", "NCD", "SKC"].includes(t)) return `<span class="cld">${t}</span>`;
    if (/^[QA]\d{4}$/.test(t)) return `<span class="q">${t}</span>`;
    if (t === "NIL") return `<span class="nil">${t}</span>`;
    if (/^(\+|-|VC)?[A-Z]{2,8}$/.test(t) && !["METAR", "TAF", "AUTO", "COR", "AMD", "SPECI"].includes(t)) return `<span class="wxph">${t}</span>`;
    return t;
  }).join(" ");
}

// TAF: każdy okres zmian w nowej linii, wcięty pod pierwszą linią
export function wxLines(kind, raw) {
  const lines = kind === "taf" ? splitTaf(raw) : [raw];
  return lines.map((l, i) => (i ? `<span class="cont">${colorize(l)}</span>` : colorize(l))).join("<br>");
}

function wxList(kind, defaults, key) {
  return (pane) => {
    pane.append(h(`<div>
      <div class="toolbar">
        <input type="text" class="ids" size="80" value="${esc(localStorage.getItem(key) || defaults)}">
        <button class="btn primary go">Pokaż</button>
        <label class="sc"><input type="checkbox" class="auto" checked> odświeżaj co 2 min</label>
        <span class="hint upd"></span>
      </div>
      <div class="wx"></div>
    </div>`));
    const $ = (s) => pane.querySelector(s);
    const load = async () => {
      const ids = $(".ids").value.trim().split(/[\s,]+/).filter(Boolean).join(",");
      localStorage.setItem(key, $(".ids").value.trim());
      try {
        const rows = await api(`/api/meteo/${kind}?ids=${ids}`);
        $(".wx").innerHTML = rows.map((r) => `<div class="row">${r.raw ? wxLines(kind, r.raw) : `<span class="st">${esc(r.icao)}</span> <span class="nil">NIL</span>`}</div>`).join("");
        $(".upd").textContent = "Aktualizacja " + new Date().toISOString().slice(11, 16) + "Z";
      } catch (e) { $(".wx").innerHTML = `<p class="error">${esc(e.message)}</p>`; }
    };
    $(".go").addEventListener("click", load);
    $(".ids").addEventListener("keydown", (e) => e.key === "Enter" && load());
    const timer = setInterval(() => $(".auto")?.checked && load(), 120000);
    load();
    return { destroy: () => clearInterval(timer) };
  };
}

// Mapa QNH jak w PANDORZE: czarne tło, ponumerowane rejony, duże QNH w hPa, pod nim mmHg i inHg,
// małe liczby nad nim: najniższe i najwyższe QNH z lotnisk rejonu.
function qnhMap(pane) {
  pane.append(h(`<div class="mapwrap"><div class="map qnhmap"></div><div class="qnhside">
    <div class="stamp"></div><table class="data regions"></table><p class="hint note"></p></div></div>`));
  const map = L.map(pane.querySelector(".map"), { zoomSnap: 0.25, attributionControl: false });
  const mmhg = (q) => Math.round(q * 0.750062);
  const inhg = (q) => (q * 0.0295300).toFixed(2);
  const layer = L.layerGroup().addTo(map);
  const load = async () => {
    let data;
    try { data = await api("/api/meteo/qnh-regions"); } catch (e) { pane.querySelector(".stamp").innerHTML = `<span class="error">${esc(e.message)}</span>`; return; }
    layer.clearLayers();
    const all = L.featureGroup();
    data.regions.forEach((r) => {
      const poly = L.geoJSON(r.geometry, { interactive: false, style: { color: "#5f9f5f", weight: 1.2, fill: false } }).addTo(layer);
      all.addLayer(poly);
      L.marker([r.num[1], r.num[0]], { interactive: false, icon: L.divIcon({ className: "qnhnum", html: `<div>${r.id}</div>`, iconSize: null }) }).addTo(layer);
      const html = r.qnh ? `<div class="mm"><span>${r.qnh}</span><span>${r.max}</span></div><div class="big">${r.qnh}</div><div class="sub">${mmhg(r.qnh)} ${inhg(r.qnh)}</div>`
        : `<div class="big nil">----</div>`;
      L.marker([r.label[1], r.label[0]], { interactive: false, icon: L.divIcon({ className: "qnhlabel", html: `<div>${html}</div>`, iconSize: null }) }).addTo(layer);
      r.stations.filter((s) => s.lat !== null).forEach((s) => L.circleMarker([s.lat, s.lon], { radius: 3, color: "#cfe0ff", weight: 1, fillOpacity: 1 })
        .bindTooltip(`${s.icao} ${s.qnh ?? "–"}`, { direction: "right", className: "lbl" }).addTo(layer));
    });
    if (!map._loaded) map.fitBounds(all.getBounds(), { padding: [10, 10] });
    pane.querySelector(".stamp").innerHTML = `Dane z ${new Date().toISOString().slice(0, 16).replace("T", " ")}Z` + (data.error ? `<br><span class="error">${esc(data.error)}</span>` : "");
    pane.querySelector(".regions").innerHTML = `<thead><tr><th>Rejon</th><th>QNH</th><th>Lotniska</th></tr></thead><tbody>${data.regions.map((r) =>
      `<tr><td class="num">${r.id}</td><td class="num" style="color:var(--yellow)">${r.qnh ?? "–"}</td><td class="mono" style="font-size:11px">${r.stations.map((s) => `${s.icao} ${s.qnh ?? "–"}`).join("<br>")}</td></tr>`).join("")}</tbody>`;
    pane.querySelector(".note").textContent = data.note || "";
  };
  load();
  const timer = setInterval(load, 300000);
  setTimeout(() => map.invalidateSize(), 50);
  return { destroy: () => { clearInterval(timer); map.remove(); } };
}

const windy = (overlay) => (pane) => {
  const url = `https://embed.windy.com/embed2.html?lat=52.0&lon=19.3&detailLat=52.17&detailLon=20.97&zoom=${overlay === "satellite" ? 4 : 6}&level=surface&overlay=${overlay}&product=ecmwf&menu=&message=true&marker=&calendar=now&pressure=true&type=map&location=coordinates&detail=&metricWind=kt&metricTemp=%C2%B0C&radarRange=-1`;
  pane.append(h(`<iframe class="embed" src="${url}" allowfullscreen></iframe>`));
};

export default {
  mount(root) {
    subtabs(root, [
      { id: "metar-pl", label: "METAR PL", render: wxList("metar", PL_CIV, "meteo.metar.pl") },
      { id: "metar-mil", label: "METAR MIL", render: wxList("metar", PL_MIL, "meteo.metar.mil") },
      { id: "metar-intl", label: "METAR INTL", render: wxList("metar", INTL, "meteo.metar.intl") },
      { id: "taf-pl", label: "TAF PL", render: wxList("taf", PL_CIV, "meteo.taf.pl") },
      { id: "taf-intl", label: "TAF INTL", render: wxList("taf", INTL, "meteo.taf.intl") },
      { sep: true },
      { id: "qnh", label: "QNH", fill: true, render: qnhMap },
      { id: "wind", label: "WINDY", fill: true, render: windy("wind") },
      { id: "radar", label: "RADAR", fill: true, render: windy("radar") },
      { id: "sat", label: "SAT EUR", fill: true, render: windy("satellite") },
    ]);
  },
};
