import { BASEMAPS, api, esc, h, iframeWithFallback, subtabs } from "../api.js";

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
        $(".wx").innerHTML = rows.map((r) => `<div class="row">${r.raw ? r.raw.split("\n").map((l) => colorize(l.trim())).join("<br>&nbsp;&nbsp;&nbsp;&nbsp;") : `<span class="st">${esc(r.icao)}</span> <span class="nil">NIL</span>`}</div>`).join("");
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

function qnhMap(pane) {
  pane.append(h(`<div class="mapwrap"><div class="mapside"><h4>QNH REGIONALNE</h4><div class="regions">Ładowanie…</div>
    <p class="hint note"></p></div><div class="map"></div></div>`));
  const map = L.map(pane.querySelector(".map"), { zoomSnap: 0.25 }).setView([52.0, 19.3], 6.25);
  BASEMAPS.dark(L).addTo(map);
  const mmhg = (q) => Math.round(q * 0.750062);
  const inhg = (q) => (q * 0.0295300).toFixed(2);
  // kontury sektorów ACC jako tło, jak na mapie QNH w PANDORZE
  api("/api/nav/sectors?fir=EPWW&level_ft=30000").then((gj) => L.geoJSON(gj, { style: { color: "#3f8f2f", weight: 1, fill: false }, interactive: false }).addTo(map)).catch(() => {});
  api("/api/aerodromes").then(async (ads) => {
    const pos = Object.fromEntries(ads.map((a) => [a.icao, a]));
    try {
      const data = await api("/api/meteo/qnh-regions");
      pane.querySelector(".note").textContent = data.note || "";
      pane.querySelector(".regions").innerHTML = `<table class="data">${data.regions.map((r) =>
        `<tr><td class="sc">${esc(r.name)}</td><td class="num" style="color:var(--yellow);font-size:18px">${r.qnh ?? "–"}</td></tr>`).join("")}</table>`;
      data.regions.forEach((r) => {
        const pts = r.stations.map((s) => pos[s.icao]).filter(Boolean);
        if (!pts.length) return;
        r.stations.forEach((s) => {
          const a = pos[s.icao];
          if (!a) return;
          L.circleMarker([a.lat, a.lon], { radius: 3, color: "#fff", weight: 1, fillOpacity: 1 }).addTo(map)
            .bindTooltip(`${s.icao} ${s.qnh ?? "–"}`, { permanent: true, direction: "right", className: "lbl" });
        });
        const lat = pts.reduce((s, a) => s + a.lat, 0) / pts.length, lon = pts.reduce((s, a) => s + a.lon, 0) / pts.length;
        if (r.qnh) L.tooltip({ permanent: true, direction: "center", className: "qnh" }).setLatLng([lat, lon])
          .setContent(`${r.qnh}<br><span style="font-size:13px">${mmhg(r.qnh)} ${inhg(r.qnh)}</span>`).addTo(map);
      });
    } catch (e) {
      pane.querySelector(".regions").innerHTML = `<span class="error">${esc(e.message)}</span>`;
    }
  });
  setTimeout(() => map.invalidateSize(), 50);
}

const windy = (overlay) => (pane) => {
  const url = `https://embed.windy.com/embed2.html?lat=52.0&lon=19.3&detailLat=52.17&detailLon=20.97&zoom=${overlay === "satellite" ? 4 : 6}&level=surface&overlay=${overlay}&product=ecmwf&menu=&message=true&marker=&calendar=now&pressure=true&type=map&location=coordinates&detail=&metricWind=kt&metricTemp=%C2%B0C&radarRange=-1`;
  pane.append(h(`<iframe class="embed" src="${url}" allowfullscreen></iframe>`));
};

export default {
  mount(root, ctx) {
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
      { sep: true },
      { id: "imgw", label: "IMGW AWIACJA", fill: true,
        render: (pane) => iframeWithFallback(pane, ctx.config.links.imgw, "GAMET, SIGMET, mapy IMGW") },
    ]);
  },
};
