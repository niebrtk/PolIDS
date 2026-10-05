import { BASEMAPS, api, atcPositions, esc, h, hhmm, vatsimOnline } from "../api.js";
import { aircraftMarker, drawFirs, drawSectors, fl, loadFirs, sectorOwners } from "../airspace.js";

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
        <label><input type="checkbox" class="online" checked> aktualna (kto jest online)</label>
        <label><input type="checkbox" class="firs" checked> FIR-y sąsiednie (VATSpy)</label>
        <div class="sector-info hint"></div>
        <h4>RUCH (VATSIM)</h4>
        <label><input type="checkbox" class="traffic" checked> samoloty</label>
        <label><input type="checkbox" class="traffic-detail"> etykiety z FL, typem i prędkością</label>
        <div class="traffic-info hint"></div>
        <div class="flight card" style="display:none;margin-top:6px"></div>
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
      firs: L.layerGroup().addTo(map), traffic: L.layerGroup().addTo(map), flight: L.layerGroup().addTo(map),
    };
    layers.firs.setZIndex?.(0);
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

    // --- sektory EPWW i FIR-y sąsiednie, podświetlone wg zalogowanych kontrolerów
    const loadSectors = async () => {
      const level = parseInt($(".fl").value || "0", 10);
      const wantOnline = $(".online").checked;
      const [gj, firs, net, positions] = await Promise.all([
        $(".sectors").checked ? api(`/api/nav/sectors?fir=EPWW&level_ft=${level * 100}`) : null,
        $(".firs").checked ? loadFirs().catch(() => null) : null,
        wantOnline || $(".firs").checked ? vatsimOnline().catch((e) => ({ error: e.message })) : null,
        atcPositions(),
      ]);
      layers.sectors.clearLayers();
      layers.firs.clearLayers();
      if (firs) drawFirs(layers.firs, firs, net?.firs || {});
      if (!gj) { $(".sector-info").textContent = ""; return; }
      const online = wantOnline && net && !net.error ? sectorOwners(gj, positions, net.positions) : null;
      drawSectors(layers.sectors, gj, online);
      $(".sector-info").innerHTML = net?.error ? `<span class="error">${esc(net.error)}</span>`
        : online ? `Online: ${Object.values(net.positions).filter((c) => c.callsign.startsWith("EPWW")).map((c) => esc(c.callsign)).join(", ") || "brak kontrolerów EPWW"}`
          : `${gj.features.length} sektorów na ${fl(level * 100)} (podział pełny)`;
    };
    ["sectors", "online", "firs"].forEach((c) => $("." + c).addEventListener("change", loadSectors));
    $(".fl").addEventListener("change", loadSectors);
    setInterval(() => document.body.contains(pane) && loadSectors(), 60000);

    // --- samoloty z VATSIM; kliknięcie pokazuje plan lotu i trasę
    let selected = null;
    const showFlight = async (cs) => {
      selected = cs;
      layers.flight.clearLayers();
      const box = $(".flight");
      box.style.display = "";
      box.innerHTML = `<span class="hint">Ładowanie planu lotu ${esc(cs)}…</span>`;
      try {
        const f = await api(`/api/vatsim/pilots/${encodeURIComponent(cs)}/route`);
        if (selected !== cs) return;
        if (f.points.length) {
          const line = L.polyline(f.points.map((p) => [p.lat, p.lon]), { color: "#ffb020", weight: 2, dashArray: "6 4" }).addTo(layers.flight);
          f.points.forEach((p) => L.circleMarker([p.lat, p.lon], { radius: 3, color: "#ffb020", fillOpacity: 1 })
            .bindTooltip(p.ident, { permanent: map.getZoom() >= 7, direction: "top", className: "lbl" }).addTo(layers.flight));
          map.fitBounds(line.getBounds(), { padding: [40, 40], maxZoom: 9 });
        }
        box.innerHTML = `<b class="mono" style="font-size:16px">${esc(f.callsign)}</b> <span class="hint">${esc(f.name || "")} (${esc(f.cid)})</span>
          <button class="btn close-flight" style="float:right;padding:0 6px">✕</button><br>
          <span class="mono">${esc(f.aircraft || "–")} · ${esc(f.departure || "?")} → ${esc(f.arrival || "?")} · RFL ${esc(f.rfl || "–")}</span><br>
          <span class="mono">${fl(f.altitude)} · GS ${esc(f.groundspeed)} kt · SQ ${esc(f.squawk || "–")} · ${f.rules === "V" ? "VFR" : "IFR"}</span>
          <div class="mono hint" style="margin-top:4px">${esc(f.route || "brak trasy")}</div>
          ${f.points.length ? `<div class="hint">${f.points.length} punktów · ${f.distance_nm} NM</div>` : ""}
          ${f.warnings.length ? `<div class="hint" style="color:var(--warn)">${f.warnings.map(esc).join("<br>")}</div>` : ""}`;
      } catch (e) { box.innerHTML = `<span class="error">${esc(e.message)}</span> <button class="btn close-flight">✕</button>`; }
    };
    $(".flight").addEventListener("click", (e) => {
      if (!e.target.closest(".close-flight")) return;
      selected = null; layers.flight.clearLayers(); $(".flight").style.display = "none";
    });
    let pilots = [];
    const drawTraffic = () => {
      layers.traffic.clearLayers();
      if (!$(".traffic").checked) return;
      const z = map.getZoom(), b = map.getBounds().pad(0.2);
      pilots.filter((p) => b.contains([p.lat, p.lon])).forEach((p) => {
        aircraftMarker(p, { label: z >= 6, detail: $(".traffic-detail").checked || z >= 9 })
          .bindTooltip(`${esc(p.callsign)} ${esc(p.aircraft || "")} ${esc(p.departure || "")}→${esc(p.arrival || "")} ${fl(p.altitude)}`)
          .on("click", () => showFlight(p.callsign)).addTo(layers.traffic);
      });
    };
    const loadTraffic = async () => {
      if (!$(".traffic").checked) { layers.traffic.clearLayers(); $(".traffic-info").textContent = ""; return; }
      try {
        pilots = await api("/api/vatsim/pilots?bbox=44,5,60,35");
        $(".traffic-info").textContent = `${pilots.length} samolotów w Europie Środkowej · ${hhmm(new Date().toISOString())}. Kliknij samolot, żeby zobaczyć trasę.`;
      } catch (e) { pilots = []; $(".traffic-info").innerHTML = `<span class="error">${esc(e.message)}</span>`; }
      drawTraffic();
    };
    $(".traffic").addEventListener("change", loadTraffic);
    $(".traffic-detail").addEventListener("change", drawTraffic);
    map.on("moveend", drawTraffic);
    setInterval(() => document.body.contains(pane) && $(".traffic").checked && loadTraffic(), 30000);

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
    loadTraffic();
    return { activate: () => setTimeout(() => { map.invalidateSize(); loadVisible(); }, 50) };
  },
};
