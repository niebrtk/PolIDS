import { BASEMAPS, LIGHT_BASEMAPS, api, atcPositions, esc, h, hhmm, vatsimAtc, vatsimOnline } from "../api.js";
import { FACILITIES, SymbolMarker, aircraftMarker, airportBadge, atcPanes, drawFirs, drawSectors, fl, loadFirs, sectorOwners, symbolFor, symbolSvg } from "../airspace.js";

// Kolory zależne od podkładu (ciemny / jasny)
const THEME = {
  dark: { ad: "#c8ced4", vor: "#3ecf6e", ndb: "#c58cff", fix: "#8c969e", vfr: "#ffb020", route: "#ff4dd2", flight: "#ff9f1a", halo: "#000", airway: "#5f6b78" },
  light: { ad: "#33393f", vor: "#0a7a36", ndb: "#7b2cbf", fix: "#5c656c", vfr: "#c26a00", route: "#b0007c", flight: "#d4380d", halo: "#fff", airway: "#8b96a0" },
};
const KIND_COLOR = { aerodrome: "ad", vor: "vor", ndb: "ndb", fix: "fix", vfr: "vfr" };
const sw = (cls, label, checked = false, sym = "") => `<label class="sw"><input type="checkbox" class="${cls}" ${checked ? "checked" : ""}>
  <span class="sw-sym">${sym}</span><span>${label}</span></label>`;

export default {
  mount(root, ctx) {
    const pane = h(`<div class="pane fill"><div class="mapwrap">
      <div class="mapside">
        <div class="ms-head"><b>MAPA</b><span class="hint">AIRAC ${esc(ctx.config.airac?.ident || "")}</span>
          <button class="btn ms-hide" title="Schowaj panel">«</button></div>
        <section class="ms-card">
          <h4>Ruch VATSIM</h4>
          ${sw("traffic", "samoloty", true, `<svg class="sym" width="18" height="18" viewBox="-10 -10 20 20"><path d="M0,-9 L6,8 L0,4 L-6,8 Z" class="acsym"/></svg>`)}
          ${sw("traffic-detail", "etykiety z FL, typem i GS")}
          ${sw("atc", "kontrolerzy online: plakietki D / G / T / A / APP", true, `<span class="ab ab-twr">T</span>`)}
          <div class="atc-info hint"></div>
          <div class="traffic-info hint"></div>
          <div class="flight" style="display:none"></div>
        </section>
        <section class="ms-card">
          <h4>Trasa</h4>
          <textarea class="field route" rows="3" placeholder="np. EPKK OKENO N871 POLON L980 VAMPU EPGD"></textarea>
          <div class="ms-row"><button class="btn primary show-route">Pokaż trasę</button><button class="btn clear-route">Wyczyść</button></div>
          <div class="route-info hint"></div>
        </section>
        <section class="ms-card">
          <h4>Przestrzeń</h4>
          <div class="ms-row"><label class="hint">Poziom</label><span class="flbox">FL<input type="number" class="field fl" value="300" min="0" max="660" step="5"></span></div>
          ${sw("sectors", "sektory EPWW", true, `<span class="swatch sec"></span>`)}
          ${sw("online", "aktualna sektoryzacja (kto jest online)", true, `<span class="swatch on"></span>`)}
          ${sw("firs", "FIR-y sąsiednie (VATSpy)", true, `<span class="swatch fir"></span>`)}
          <div class="sector-info hint"></div>
        </section>
        <section class="ms-card">
          <h4>Punkty i drogi</h4>
          ${sw("ads", "lotniska", true, `<i data-sym="aerodrome"></i>`)}
          ${sw("navaids", "VOR / DME", true, `<i data-sym="vor"></i>`)}
          ${sw("ndbs", "NDB", true, `<i data-sym="ndb"></i>`)}
          ${sw("vfrs", "punkty VFR <small>(zoom ≥ 8)</small>", false, `<i data-sym="vfr"></i>`)}
          ${sw("fixes", "punkty FIX <small>(zoom ≥ 8)</small>", false, `<i data-sym="fix"></i>`)}
          ${sw("airways", "drogi lotnicze <small>(zoom ≥ 7)</small>", false, `<span class="swatch awy"></span>`)}
          ${sw("labels", "nazwy punktów", true)}
        </section>
        <section class="ms-card">
          <h4>Podkład</h4>
          <div class="seg">${[["dark", "ciemny"], ["light", "jasny"], ["white", "biały"], ["osm", "OSM"]]
            .map(([v, l]) => `<button data-base="${v}" class="${v === "dark" ? "on" : ""}">${l}</button>`).join("")}</div>
          ${sw("openaip", "nakładka lotnicza OpenAIP")}
          <div class="hint openaip-note"></div>
        </section>
        <section class="ms-card legend">
          <h4>Legenda</h4>
          <div class="lg"><span class="lg-line lg-flight"></span>trasa wybranego samolotu</div>
          <div class="lg"><span class="lg-line lg-route"></span>trasa wpisana ręcznie</div>
          <div class="lg"><span class="swatch on"></span>sektor / FIR obsadzony (online)</div>
          <div class="lg"><span class="swatch unicom"></span>sektor bez kontrolera (UNICOM 122.800)</div>
          <div class="lg"><span class="lg-freq">133.475</span>częstotliwość obsadzonego sektora</div>
          <div class="lg lg-atc">${FACILITIES.map(([k, l, n]) => `<span><span class="ab ab-${k.toLowerCase()}">${l}</span>${n}</span>`).join("")}
            <span><span class="ab ab-ctr">CTR</span>Control (FIR)</span></div>
          <p class="hint">Najedź na plakietkę, żeby zobaczyć, kto jest online.</p>
          <p class="hint">Oficjalna mapa sektorów: <a href="${esc(ctx.config.links.sectors)}" target="_blank" rel="noopener">plvacc.pl/acc-sectors ↗</a></p>
        </section>
      </div>
      <button class="btn ms-show" title="Pokaż panel">»</button>
      <div class="map"></div>
    </div></div>`);
    root.append(pane);
    const $ = (s) => pane.querySelector(s);
    const mapEl = $(".map");
    const map = L.map(mapEl, { preferCanvas: true, zoomSnap: 0.5 }).setView([52.0, 19.3], 6);
    const key = ctx.config.carto_api_key;
    let baseName = localStorage.getItem("map.base") || "dark";
    let base = null;
    let theme = THEME.dark;
    const layers = {
      firs: L.layerGroup().addTo(map), sectors: L.layerGroup().addTo(map), airways: L.layerGroup(),
      ads: L.layerGroup().addTo(map), points: L.layerGroup().addTo(map), route: L.layerGroup().addTo(map), atc: L.layerGroup().addTo(map),
      traffic: L.layerGroup().addTo(map), flight: L.layerGroup().addTo(map),
    };
    let openaip = null;
    const panes = atcPanes(map);

    const paintLegend = () => pane.querySelectorAll("i[data-sym]").forEach((i) => {
      i.outerHTML = `<i data-sym="${i.dataset.sym}">${symbolSvg(i.dataset.sym, THEME.dark[KIND_COLOR[i.dataset.sym]])}</i>`;
    });
    paintLegend();

    const setBase = (name) => {
      baseName = BASEMAPS[name] ? name : "dark";
      try { localStorage.setItem("map.base", baseName); } catch { /* tryb prywatny */ }
      if (base) map.removeLayer(base);
      base = BASEMAPS[baseName](L, key).addTo(map);
      base.bringToBack?.();
      const light = LIGHT_BASEMAPS.includes(baseName);
      theme = light ? THEME.light : THEME.dark;
      mapEl.classList.toggle("light", light);
      mapEl.classList.toggle("white", baseName === "white");
      pane.querySelectorAll(".seg button").forEach((b) => b.classList.toggle("on", b.dataset.base === baseName));
      drawAds(); loadVisible(); redrawFlight(); redrawRoute();
    };
    $(".seg").addEventListener("click", (e) => { const b = e.target.closest("button[data-base]"); if (b) setBase(b.dataset.base); });
    $(".openaip").addEventListener("change", (e) => {
      const k = ctx.config.openaip_api_key;
      if (!k) {
        e.target.checked = false;
        $(".openaip-note").textContent = "Brak klucza: załóż darmowe konto na openaip.net i wpisz VPANDORA_OPENAIP_API_KEY w pliku .env";
        return;
      }
      if (e.target.checked) {
        openaip = L.tileLayer(`https://api.tiles.openaip.net/api/data/openaip/{z}/{x}/{y}.png?apiKey=${encodeURIComponent(k)}`,
          { attribution: "© openAIP", maxZoom: 14, opacity: 0.9 }).addTo(map);
      } else if (openaip) { map.removeLayer(openaip); }
    });
    $(".ms-hide").addEventListener("click", () => { pane.querySelector(".mapwrap").classList.add("collapsed"); setTimeout(() => map.invalidateSize(), 50); });
    $(".ms-show").addEventListener("click", () => { pane.querySelector(".mapwrap").classList.remove("collapsed"); setTimeout(() => map.invalidateSize(), 50); });

    // Punkt jako symbol EuroScope z nazwą obok
    const pointMarker = (p, { color, label = true, scale = 1.6, weight = 1.6, permanent = true, cls = "lbl", popup = true } = {}) => {
      const sym = symbolFor(p.kind);
      const m = new SymbolMarker([p.lat, p.lon], { symbol: sym, color: color || theme[KIND_COLOR[sym]], scale, weight, radius: 7 * scale / 1.6 });
      const full = `${esc(p.ident)} ${esc(p.kind)}${p.frequency ? " " + esc(p.frequency) : ""}${p.name ? " " + esc(p.name) : ""}`;
      if (label) m.bindTooltip(esc(p.ident), { permanent, direction: "right", offset: [6 * scale / 1.6, 0], className: cls });
      else m.bindTooltip(full);
      if (label && popup) m.bindPopup(full);
      return m;
    };

    // --- lotniska (lotnisko z plakietką ATC nie dostaje osobnej nazwy: ICAO jest na plakietce)
    let ads = [];
    let atcAds = new Set();
    const drawAds = () => {
      layers.ads.clearLayers();
      const z = map.getZoom();
      ads.forEach((a) => {
        const big = a.kind === "large_airport" || a.kind === "medium_airport";
        if (!big && z < 8 && !atcAds.has(a.icao)) return;
        pointMarker({ ident: a.icao, kind: "AD", lat: a.lat, lon: a.lon, name: a.name },
          { label: !atcAds.has(a.icao) && (z >= 7 || (big && z >= 6)), permanent: true, scale: big ? 1.8 : 1.4, popup: false })
          .on("click", () => ctx.open("aerodrome", a.icao)).addTo(layers.ads);
      });
    };
    api("/api/aerodromes").then((list) => {
      ads = list.filter((a) => a.kind !== "small_airport" || a.icao.startsWith("EP"));
      loadAtc();
    });
    $(".ads").addEventListener("change", (e) => (e.target.checked ? layers.ads.addTo(map) : map.removeLayer(layers.ads)));

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
      if (firs) drawFirs(layers.firs, firs, net?.firs || {}, { panes });
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

    // --- kontrolerzy online: plakietki lotnisk (D/G/T/A/APP) jak w VATSIM Radar; CTR rysuje drawFirs
    const loadAtc = async () => {
      layers.atc.clearLayers();
      if (!$(".atc").checked) { atcAds = new Set(); $(".atc-info").textContent = ""; drawAds(); return; }
      try {
        const data = await vatsimAtc();
        const known = new Set(ads.map((a) => a.icao));
        atcAds = new Set(data.airports.map((a) => a.icao));
        data.airports.forEach((ap) => {
          // lotniska spoza listy (zagraniczne) dostają sam symbol pod plakietką
          if (!known.has(ap.icao)) pointMarker({ ident: ap.icao, kind: "AD", lat: ap.lat, lon: ap.lon, name: ap.name }, { label: false, scale: 1.6 }).addTo(layers.atc);
          const m = airportBadge(ap, panes).addTo(layers.atc);
          if (ap.icao.startsWith("EP")) m.on("click", () => ctx.open("aerodrome", ap.icao));
        });
        $(".atc-info").textContent = `${data.airports.length} lotnisk z kontrolerem · ${hhmm(new Date().toISOString())}`;
      } catch (e) { atcAds = new Set(); $(".atc-info").innerHTML = `<span class="error">${esc(e.message)}</span>`; }
      drawAds();
    };
    $(".atc").addEventListener("change", loadAtc);
    setInterval(() => document.body.contains(pane) && $(".atc").checked && loadAtc(), 30000);

    // --- trasa: gruba linia z obwódką (czytelna na każdym podkładzie), punkty jako symbole z nazwą w ramce
    const drawRoute = (layer, pts, color) => {
      const ll = pts.map((p) => [p.lat, p.lon]);
      L.polyline(ll, { color: theme.halo, weight: 9, opacity: 0.85, lineJoin: "round", interactive: false }).addTo(layer);
      const line = L.polyline(ll, { color, weight: 4, opacity: 1, lineJoin: "round" }).addTo(layer);
      pts.forEach((p, i) => {
        const first = i === 0 || i === pts.length - 1;
        pointMarker(p, { color, scale: first ? 2.2 : 1.9, weight: 2.4, cls: "rtlbl" }).addTo(layer);
      });
      return line;
    };
    let route = null;
    const redrawRoute = () => {
      layers.route.clearLayers();
      if (route) drawRoute(layers.route, route.points, theme.route);
    };

    // --- samoloty z VATSIM; kliknięcie pokazuje plan lotu i trasę
    let selected = null, flight = null;
    const redrawFlight = () => {
      layers.flight.clearLayers();
      if (!flight) return;
      if (flight.points.length) drawRoute(layers.flight, flight.points, theme.flight);
    };
    const showFlight = async (cs) => {
      selected = cs;
      flight = null;
      layers.flight.clearLayers();
      const box = $(".flight");
      box.style.display = "";
      box.innerHTML = `<span class="hint">Ładowanie planu lotu ${esc(cs)}…</span>`;
      try {
        const f = await api(`/api/vatsim/pilots/${encodeURIComponent(cs)}/route`);
        if (selected !== cs) return;
        flight = f;
        redrawFlight();
        if (f.points.length) map.fitBounds(L.latLngBounds(f.points.map((p) => [p.lat, p.lon])), { padding: [50, 50], maxZoom: 9 });
        else if (f.lat !== null && f.lat !== undefined) map.setView([f.lat, f.lon], Math.max(map.getZoom(), 8));
        box.innerHTML = `<div class="fl-head"><b>${esc(f.callsign)}</b><span class="hint">${esc(f.name || "")} · ${esc(f.cid)}</span>
            <button class="btn close-flight" title="Zamknij">✕</button></div>
          <div class="fl-grid">
            <span>Typ</span><b>${esc(f.aircraft || "–")}</b><span>Reguły</span><b>${f.rules === "V" ? "VFR" : "IFR"}</b>
            <span>Z</span><b>${esc(f.departure || "?")}</b><span>Do</span><b>${esc(f.arrival || "?")}</b>
            <span>Poziom</span><b>${fl(f.altitude)}</b><span>RFL</span><b>${esc(f.rfl || "–")}</b>
            <span>GS</span><b>${esc(f.groundspeed ?? "–")} kt</b><span>SQ</span><b>${esc(f.squawk || "–")}</b>
          </div>
          <div class="fl-route mono">${esc(f.route || "brak trasy")}</div>
          ${f.points.length ? `<div class="hint">${f.points.length} punktów · ${f.distance_nm} NM</div>` : ""}
          ${f.warnings.length ? `<div class="hint" style="color:var(--warn)">${f.warnings.map(esc).join("<br>")}</div>` : ""}`;
      } catch (e) { box.innerHTML = `<span class="error">${esc(e.message)}</span> <button class="btn close-flight">✕</button>`; }
    };
    $(".flight").addEventListener("click", (e) => {
      if (!e.target.closest(".close-flight")) return;
      selected = null; flight = null; layers.flight.clearLayers(); $(".flight").style.display = "none";
    });
    let pilots = [];
    const drawTraffic = () => {
      layers.traffic.clearLayers();
      if (!$(".traffic").checked) return;
      const z = map.getZoom(), b = map.getBounds().pad(0.2);
      pilots.filter((p) => b.contains([p.lat, p.lon])).forEach((p) => {
        const m = aircraftMarker(p, { label: z >= 6, detail: $(".traffic-detail").checked || z >= 9 })
          .bindTooltip(`${esc(p.callsign)} ${esc(p.aircraft || "")} ${esc(p.departure || "")}→${esc(p.arrival || "")} ${fl(p.altitude)}`)
          .on("click", () => showFlight(p.callsign)).addTo(layers.traffic);
        if (p.callsign === selected) m.getElement()?.classList.add("sel");
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
    let seq = 0;
    const loadVisible = async () => {
      const z = map.getZoom(), my = ++seq;
      const kinds = [];
      if ($(".navaids").checked && z >= 5) kinds.push("VOR", "VOR-DME", "DME", "VORTAC");
      if ($(".ndbs").checked && z >= 5) kinds.push("NDB", "NDB-DME");
      if ($(".vfrs").checked && z >= 8) kinds.push("VFR");
      if ($(".fixes").checked && z >= 8) kinds.push("FIX");
      let pts = [], segs = [];
      try { if (kinds.length) pts = await api(`/api/nav/points?bbox=${bbox()}&kinds=${kinds.join(",")}`); } catch { /* zbyt duży obszar */ }
      try { if ($(".airways").checked && z >= 7) segs = await api(`/api/nav/airways?bbox=${bbox()}`); } catch { /* zbyt duży obszar */ }
      if (my !== seq) return;
      layers.points.clearLayers();
      layers.airways.clearLayers();
      if ($(".airways").checked) layers.airways.addTo(map); else map.removeLayer(layers.airways);
      segs.forEach((s) => L.polyline(s.coords, { color: theme.airway, weight: 1 }).bindTooltip(esc(s.airway)).addTo(layers.airways));
      const labels = $(".labels").checked;
      pts.forEach((p) => {
        const nav = p.kind !== "FIX" && p.kind !== "VFR";
        const vor = symbolFor(p.kind) === "vor";
        pointMarker(p, { label: labels && (vor ? z >= 6 : nav ? z >= 7 : z >= 9), scale: nav ? 1.7 : 1.4 }).addTo(layers.points);
      });
    };
    map.on("moveend", loadVisible);
    map.on("zoomend", drawAds);
    ["navaids", "ndbs", "vfrs", "fixes", "airways", "labels"].forEach((c) => $("." + c).addEventListener("change", loadVisible));

    // --- trasa wpisana ręcznie
    $(".show-route").addEventListener("click", async () => {
      const info = $(".route-info");
      try {
        const r = await api(`/api/nav/route?route=${encodeURIComponent($(".route").value)}`);
        if (!r.points.length) { info.innerHTML = `<span class="error">Nie rozpoznano żadnego punktu.</span>`; return; }
        route = r;
        redrawRoute();
        map.fitBounds(L.latLngBounds(r.points.map((p) => [p.lat, p.lon])), { padding: [40, 40] });
        info.innerHTML = `${r.points.length} punktów · ${r.distance_nm} NM<br><span class="mono">${r.points.map((p) => esc(p.ident)).join(" ")}</span>` +
          (r.warnings.length ? `<div class="error">${r.warnings.map(esc).join("<br>")}</div>` : "");
      } catch (e) { info.innerHTML = `<span class="error">${esc(e.message)}</span>`; }
    });
    $(".clear-route").addEventListener("click", () => { route = null; layers.route.clearLayers(); $(".route-info").textContent = ""; });

    setBase(baseName);
    loadSectors();
    loadTraffic();
    return {
      activate: (arg) => setTimeout(() => {
        map.invalidateSize();
        loadVisible();
        if (arg && arg !== selected) showFlight(decodeURIComponent(arg));
      }, 50),
    };
  },
};
