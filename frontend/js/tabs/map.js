import { BASEMAPS, api, esc, h } from "../api.js";

const PALETTE = ["#2f8fff", "#3ecf6e", "#ffb020", "#ff5c8a", "#a970ff", "#00c2c7", "#ff7a3d", "#c3d82b", "#ff4dd2", "#6f8cff"];
function colorFor(key) {
  let x = 0;
  for (const ch of String(key)) x = (x * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[x % PALETTE.length];
}

export default {
  mount(root, ctx) {
    const pane = h(`<div class="pane fill"><div class="mapwrap">
      <div class="mapside">
        <h4>TRASA</h4>
        <textarea class="field route" rows="4" style="width:100%" placeholder="np. EPKK OKENO N871 POLON L980 VAMPU EPGD"></textarea>
        <button class="btn primary show-route">Pokaż trasę</button> <button class="btn clear-route">Wyczyść</button>
        <div class="route-info hint" style="margin-top:6px"></div>
        <h4>SEKTORYZACJA</h4>
        <label>Poziom FL <input type="number" class="field fl" value="300" min="0" max="660" step="5" style="width:80px"></label>
        <label><input type="checkbox" class="sectors" checked> sektory EPWW</label>
        <label><input type="checkbox" class="online"> aktualna (VATSIM online)</label>
        <div class="sector-info hint"></div>
        <h4>WARSTWY</h4>
        <label><input type="checkbox" class="airways"> drogi lotnicze (przybliż mapę)</label>
        <label><input type="checkbox" class="navaids" checked> VOR / NDB</label>
        <label><input type="checkbox" class="fixes"> punkty (FIX, od zoom 8)</label>
        <label><input type="checkbox" class="ads" checked> lotniska PL</label>
        <h4>PODKŁAD</h4>
        <label><input type="radio" name="base" value="dark" checked> ciemny (CARTO)</label>
        <label><input type="radio" name="base" value="osm"> OpenStreetMap</label>
        <label><input type="checkbox" class="openaip"> nakładka lotnicza OpenAIP</label>
        <div class="hint openaip-note"></div>
        <p class="hint">Oficjalna mapa sektorów: <a href="${esc(ctx.config.links.sectors)}" target="_blank" rel="noopener">plvacc.pl/acc-sectors ↗</a></p>
      </div>
      <div class="map"></div>
    </div></div>`);
    root.append(pane);
    const $ = (s) => pane.querySelector(s);
    const map = L.map($(".map"), { preferCanvas: true }).setView([52.0, 19.3], 6);
    let base = BASEMAPS.dark(L).addTo(map);
    const layers = {
      sectors: L.layerGroup().addTo(map), airways: L.layerGroup(), navaids: L.layerGroup().addTo(map),
      fixes: L.layerGroup(), ads: L.layerGroup().addTo(map), route: L.layerGroup().addTo(map),
    };
    let openaip = null;

    pane.querySelectorAll("input[name=base]").forEach((r) => r.addEventListener("change", () => {
      map.removeLayer(base);
      base = BASEMAPS[r.value](L).addTo(map);
      base.bringToBack();
    }));
    $(".openaip").addEventListener("change", (e) => {
      const key = ctx.config.openaip_api_key;
      if (!key) {
        e.target.checked = false;
        $(".openaip-note").textContent = "Brak klucza: załóż darmowe konto na openaip.net i wpisz VPANDORA_OPENAIP_API_KEY w pliku .env";
        return;
      }
      if (e.target.checked) {
        openaip = L.tileLayer(`https://api.tiles.openaip.net/api/data/openaip/{z}/{x}/{y}.png?apiKey=${encodeURIComponent(key)}`,
          { attribution: "© openAIP", maxZoom: 14, opacity: 0.9 }).addTo(map);
      } else if (openaip) { map.removeLayer(openaip); }
    });

    // --- lotniska
    api("/api/aerodromes").then((ads) => ads.filter((a) => a.kind !== "small_airport" || a.icao.startsWith("EP")).forEach((a) => {
      L.circleMarker([a.lat, a.lon], { radius: a.kind === "large_airport" ? 6 : 4, color: "#fff", weight: 1, fillColor: "#2f8fff", fillOpacity: 0.9 })
        .bindTooltip(`${a.icao} ${esc(a.name)}`).on("click", () => ctx.open("aerodrome", a.icao)).addTo(layers.ads);
    }));

    // --- sektory
    let online = null;
    const loadSectors = async () => {
      layers.sectors.clearLayers();
      if (!$(".sectors").checked) return;
      const fl = parseInt($(".fl").value || "0", 10);
      const gj = await api(`/api/nav/sectors?fir=EPWW&level_ft=${fl * 100}`);
      if ($(".online").checked) {
        try {
          online = await api("/api/nav/sectors/online?fir=EPWW");
          $(".sector-info").textContent = `Online: ${online.online_positions.map((p) => p.callsign).join(", ") || "brak kontrolerów EPWW"}`;
        } catch (e) { online = null; $(".sector-info").textContent = e.message; }
      } else { online = null; $(".sector-info").textContent = `${gj.features.length} sektorów na FL${fl} (podział pełny)`; }
      gj.features.forEach((f) => {
        const pr = f.properties;
        const own = online ? online.sector_owner[pr.name] : null;
        const label = online ? (own ? `${own.callsign} ${own.frequency}` : "UNICOM 122.800") : `${pr.callsign || ""} ${pr.frequency || ""}`;
        const color = online ? (own ? colorFor(own.callsign) : "#555") : colorFor(pr.callsign || pr.name);
        const poly = L.geoJSON(f, { style: { color, weight: 1.5, fillColor: color, fillOpacity: 0.18 } })
          .bindTooltip(`<b>${esc(pr.name)}</b><br>FL${String(Math.round((pr.lower_ft || 0) / 100)).padStart(3, "0")}–FL${String(Math.round((pr.upper_ft || 0) / 100)).padStart(3, "0")}<br>${esc(label)}`, { sticky: true });
        poly.addTo(layers.sectors);
        L.tooltip({ permanent: true, direction: "center", className: "lbl" }).setLatLng(poly.getBounds().getCenter())
          .setContent(`${esc(pr.name)}<br>${esc(label)}`).addTo(layers.sectors);
      });
    };
    ["sectors", "online"].forEach((c) => $("." + c).addEventListener("change", loadSectors));
    $(".fl").addEventListener("change", loadSectors);
    setInterval(() => $(".online").checked && document.body.contains(pane) && loadSectors(), 60000);

    // --- punkty i drogi w widocznym obszarze
    const bbox = () => { const b = map.getBounds(); return [b.getSouth(), b.getWest(), b.getNorth(), b.getEast()].map((x) => x.toFixed(3)).join(","); };
    const loadVisible = async () => {
      const z = map.getZoom();
      for (const [cls, kinds, minZoom] of [["navaids", "VOR,NDB,VOR-DME,DME,VORTAC,NDB-DME,TACAN", 5], ["fixes", "FIX", 8]]) {
        layers[cls].clearLayers();
        if (!$("." + cls).checked) { map.removeLayer(layers[cls]); continue; }
        layers[cls].addTo(map);
        if (z < minZoom) continue;
        try {
          const pts = await api(`/api/nav/points?bbox=${bbox()}&kinds=${kinds}`);
          pts.forEach((p) => {
            const isNav = cls === "navaids";
            const m = isNav
              ? L.circleMarker([p.lat, p.lon], { radius: 4, color: "#3ecf6e", weight: 2, fill: false })
              : L.circleMarker([p.lat, p.lon], { radius: 2, color: "#9aa4af", weight: 1 });
            const full = `${p.ident} ${p.kind}${p.frequency ? " " + p.frequency : ""}${p.name ? " " + esc(p.name) : ""}`;
            if ((isNav && z >= 8) || z >= 9) m.bindTooltip(full, { permanent: true, direction: "right", className: "lbl" });
            else if (isNav) m.bindTooltip(p.ident, { permanent: true, direction: "right", className: "lbl" }).bindPopup(full);
            else m.bindTooltip(full);
            m.addTo(layers[cls]);
          });
        } catch { /* zbyt duży obszar */ }
      }
      layers.airways.clearLayers();
      if ($(".airways").checked) {
        layers.airways.addTo(map);
        if (z >= 7) {
          try {
            const segs = await api(`/api/nav/airways?bbox=${bbox()}`);
            segs.forEach((s) => L.polyline(s.coords, { color: "#5f6b78", weight: 1 }).bindTooltip(s.airway).addTo(layers.airways));
          } catch { /* zbyt duży obszar */ }
        }
      } else map.removeLayer(layers.airways);
    };
    map.on("moveend", loadVisible);
    ["navaids", "fixes", "airways"].forEach((c) => $("." + c).addEventListener("change", loadVisible));
    $(".ads").addEventListener("change", (e) => (e.target.checked ? layers.ads.addTo(map) : map.removeLayer(layers.ads)));

    // --- trasa
    $(".show-route").addEventListener("click", async () => {
      layers.route.clearLayers();
      const info = $(".route-info");
      try {
        const r = await api(`/api/nav/route?route=${encodeURIComponent($(".route").value)}`);
        if (!r.points.length) { info.innerHTML = `<span class="error">Nie rozpoznano żadnego punktu.</span>`; return; }
        const line = L.polyline(r.points.map((p) => [p.lat, p.lon]), { color: "#ff4dd2", weight: 3 }).addTo(layers.route);
        r.points.forEach((p) => L.circleMarker([p.lat, p.lon], { radius: 4, color: "#ff4dd2", fillOpacity: 1 })
          .bindTooltip(`${p.ident}${p.via ? " (" + p.via + ")" : ""}`, { permanent: true, direction: "top", className: "lbl" }).addTo(layers.route));
        map.fitBounds(line.getBounds(), { padding: [30, 30] });
        info.innerHTML = `${r.points.length} punktów · ${r.distance_nm} NM<br>${r.points.map((p) => p.ident).join(" ")}` +
          (r.warnings.length ? `<div class="error">${r.warnings.map(esc).join("<br>")}</div>` : "");
      } catch (e) { info.innerHTML = `<span class="error">${esc(e.message)}</span>`; }
    });
    $(".clear-route").addEventListener("click", () => { layers.route.clearLayers(); $(".route-info").textContent = ""; });

    loadSectors();
    return { activate: () => setTimeout(() => { map.invalidateSize(); loadVisible(); }, 50) };
  },
};
