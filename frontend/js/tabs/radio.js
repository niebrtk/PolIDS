import { api, atcPositions, esc, h, hhmm, positionTip, subtabs, vatsimBookings, vatsimOnline } from "../api.js";
import { drawFirs, drawSectors, loadFirs, sectorOwners } from "../airspace.js";

const TYPE_ORDER = ["CTR", "FSS", "APP", "DEP", "TWR", "GND", "DEL", "ATIS"];
// Lotniska komunikacyjne z AIP IFR, wojskowe; pozostałe EP** traktujemy jak VFR
const IFR = ["EPBY", "EPGD", "EPKK", "EPKT", "EPLB", "EPLL", "EPMO", "EPPO", "EPRA", "EPRZ", "EPSC", "EPSY", "EPWA", "EPWR", "EPZG"];
const MIL = ["EPCE", "EPDA", "EPDE", "EPIR", "EPKS", "EPLK", "EPLY", "EPMB", "EPMI", "EPMM", "EPOK", "EPPR", "EPPW", "EPSN", "EPTM"];
const NEIGHBOURS = [
  { id: "edww", label: "EDWW", title: "Niemcy (Bremen, Berlin)", test: (p) => ["EDWW", "EDDB", "EDAH"].includes(p) },
  { id: "edmm", label: "EDMM", title: "Niemcy (München, Rhein, Dresden, Leipzig)", test: (p) => p.startsWith("ED") && !["EDWW", "EDDB", "EDAH"].includes(p) },
  { id: "cz", label: "LKAA", title: "Czechy (Praha)", test: (p) => p.startsWith("LK") },
  { id: "sk", label: "LZBB", title: "Słowacja (Bratislava)", test: (p) => p.startsWith("LZ") },
  { id: "ua", label: "UKLV", title: "Ukraina (Lviv)", test: (p) => p.startsWith("UK") },
  { id: "by", label: "UMMV", title: "Białoruś (Minsk)", test: (p) => p.startsWith("UM") && p !== "UMKK" },
  { id: "kal", label: "UMKK", title: "Rosja (Kaliningrad)", test: (p) => p === "UMKK" || p.startsWith("RU-") },
  { id: "lt", label: "EYVL", title: "Litwa (Vilnius)", test: (p) => p.startsWith("EY") },
  { id: "se", label: "ESAA", title: "Szwecja", test: (p) => p.startsWith("ES") },
  { id: "dk", label: "EKDK", title: "Dania", test: (p) => p.startsWith("EK") },
];
const isOther = (p) => !p.startsWith("EP") && !NEIGHBOURS.some((n) => n.test(p));

const typeOf = (cs) => cs.split("_").pop();
// częstotliwości FIS (Information) przenosimy do EPWW ACC; informacje lotniskowe (EPBC, EPML) zostają przy lotniskach
const isFis = (p) => /information/i.test(p.name) && /_(APP|CTR)$/.test(p.callsign);
const byType = (a, b) => TYPE_ORDER.indexOf(typeOf(a.callsign)) - TYPE_ORDER.indexOf(typeOf(b.callsign)) || a.callsign.localeCompare(b.callsign);

function group(list, keyFn) {
  const g = {};
  list.forEach((p) => (g[keyFn(p)] ||= []).push(p));
  return Object.entries(g).sort(([a], [b]) => a.localeCompare(b)).map(([k, ps]) => [k, ps.sort(byType)]);
}

// Stan sieci wspólny dla wszystkich podzakładek: {online: {callsign: kontroler}, bookings: {callsign: [...]}}
const st = { online: {}, bookings: {}, msg: "" };
async function refreshNetwork() {
  const [on, bk] = await Promise.allSettled([vatsimOnline(), vatsimBookings()]);
  st.online = on.status === "fulfilled" ? on.value.positions : {};
  st.onlineRaw = on.status === "fulfilled" ? on.value : null;
  st.bookings = bk.status === "fulfilled" ? bk.value : {};
  const errs = [on, bk].filter((r) => r.status === "rejected").map((r) => r.reason.message);
  st.msg = (on.status === "fulfilled" ? `VATSIM: ${Object.keys(st.online).length} stanowisk online · ${hhmm(new Date().toISOString())}` : "")
    + (errs.length ? ` <span class="error">${esc(errs.join(" · "))}</span>` : "");
}

function row(p) {
  const on = st.online[p.callsign];
  const books = st.bookings[p.callsign] || [];
  const cls = on ? "on" : books.length ? "booked" : "";
  const tip = positionTip(on, books);
  const who = on ? `<b class="who">${esc(on.name || on.callsign)}</b>` : books.length ? `<span class="booked-txt">booking ${hhmm(books[0].start)}–${hhmm(books[0].end)}</span>` : "";
  return `<div class="radio-row ${cls}" ${tip ? `data-tip="${esc(tip)}"` : ""}><span class="freq ${cls}">${esc(p.frequency)}</span>
    <span class="cs">${esc(p.callsign)}</span><span class="nm">${esc(p.name)}</span>${who}</div>`;
}

function groupsHtml(groups, empty = "Brak stanowisk.") {
  return groups.length ? groups.map(([name, ps]) => `<div class="radio-group"><h3>${esc(name)}</h3>${ps.map(row).join("")}</div>`).join("")
    : `<p class="hint">${esc(empty)}</p>`;
}

// Widok listy, odświeżany razem ze stanem sieci
function listView(build) {
  return (pane) => {
    pane.innerHTML = `<div class="netstatus hint"></div><div class="body"><p class="hint">Ładowanie…</p></div>`;
    const draw = async () => {
      try {
        const ps = await atcPositions();
        pane.querySelector(".body").innerHTML = build(ps);
        pane.querySelector(".netstatus").innerHTML = st.msg;
      } catch (e) { pane.querySelector(".body").innerHTML = `<p class="error">${esc(e.message)}</p>`; }
    };
    draw();
    refreshNetwork().then(draw);
    const timer = setInterval(() => refreshNetwork().then(draw), 60000);
    return { destroy: () => clearInterval(timer) };
  };
}

function aerodromes(ps) {
  const ad = ps.filter((p) => p.prefix?.startsWith("EP") && p.prefix !== "EPWW" && !isFis(p));
  const section = (title, filter) => {
    const g = group(ad.filter((p) => filter(p.prefix)), (p) => p.prefix);
    return g.length ? `<h2 class="radio-section">${title}</h2>${groupsHtml(g)}` : "";
  };
  return section("Lotniska komunikacyjne (AIP IFR)", (x) => IFR.includes(x))
    + section("Lotniska VFR", (x) => !IFR.includes(x) && !MIL.includes(x))
    + section("Lotniska wojskowe", (x) => MIL.includes(x));
}

// EPWW ACC: lista stanowisk (najpierw CTR, niżej FIS) i mapa sektorów z aktualnie zalogowanymi
function accView(pane) {
  pane.innerHTML = `<div class="radio-acc">
    <div class="acc-list"><div class="netstatus hint"></div><div class="body"><p class="hint">Ładowanie…</p></div></div>
    <div class="acc-map"><div class="toolbar">
        <label>Poziom FL <input type="number" class="fl" value="300" min="0" max="660" step="5" style="width:80px"></label>
        <label><input type="checkbox" class="split"> podział pełny (wszystkie sektory)</label>
        <span class="hint info"></span></div>
      <div class="map"></div></div>
  </div>`;
  const $ = (s) => pane.querySelector(s);
  const map = L.map($(".map"), { zoomSnap: 0.25, attributionControl: false }).setView([52.0, 19.3], 6.25);
  const firLayer = L.layerGroup().addTo(map);
  const secLayer = L.layerGroup().addTo(map);
  let positions = [];
  let fitted = false;

  const drawList = () => {
    const acc = positions.filter((p) => p.prefix === "EPWW" && !isFis(p));
    const fis = positions.filter(isFis).sort((a, b) => a.callsign.localeCompare(b.callsign));
    $(".body").innerHTML = groupsHtml([["EPWW ACC · Warszawa Radar", acc.sort(byType)]]) + groupsHtml([["FIS · Warszawa Information", fis]]);
    $(".netstatus").innerHTML = st.msg;
  };
  const drawMap = async () => {
    const level = parseInt($(".fl").value || "0", 10);
    const [gj, firs] = await Promise.all([api(`/api/nav/sectors?fir=EPWW&level_ft=${level * 100}`), loadFirs().catch(() => null)]);
    firLayer.clearLayers();
    secLayer.clearLayers();
    if (firs) {
      drawFirs(firLayer, firs, st.onlineRaw?.firs || {});
      const epww = firs.features.find((f) => f.properties.id === "EPWW");
      if (epww) {
        const outline = L.geoJSON(epww, { interactive: false, style: { color: "#9cdc84", weight: 2, fill: false } }).addTo(firLayer);
        if (!fitted) { map.fitBounds(outline.getBounds(), { padding: [10, 10] }); fitted = true; }
      }
    }
    const online = !$(".split").checked && st.onlineRaw ? sectorOwners(gj, positions, st.online) : null;
    drawSectors(secLayer, gj, online);
    $(".info").textContent = online ? `${Object.keys(online.sector_owner).length}/${gj.features.length} sektorów obsadzonych` : `${gj.features.length} sektorów na FL${level}`;
  };
  const draw = () => { drawList(); drawMap().catch((e) => { $(".info").textContent = e.message; }); };
  atcPositions().then((ps) => { positions = ps; draw(); refreshNetwork().then(draw); });
  $(".fl").addEventListener("change", draw);
  $(".split").addEventListener("change", draw);
  const timer = setInterval(() => refreshNetwork().then(draw), 60000);
  setTimeout(() => map.invalidateSize(), 50);
  return { destroy: () => { clearInterval(timer); map.remove(); } };
}

export default {
  mount(root) {
    subtabs(root, [
      { id: "acc", label: "EPWW ACC", fill: true, render: accView },
      { id: "ad", label: "LOTNISKA", render: listView(aerodromes) },
      { sep: true },
      ...NEIGHBOURS.map((n) => ({ id: n.id, label: n.label, render: listView((ps) =>
        `<h2 class="radio-section">${esc(n.title)}</h2>` + groupsHtml(group(ps.filter((p) => p.prefix && n.test(p.prefix)), (p) => p.prefix))) })),
      { id: "other", label: "INNE", render: listView((ps) =>
        `<h2 class="radio-section">Pozostałe (UIR, Eurocontrol)</h2>` + groupsHtml(group(ps.filter((p) => p.prefix && isOther(p.prefix)), (p) => p.prefix))) },
      { sep: true },
      { id: "online", label: "ONLINE", render: listView((ps) => {
        const list = ps.filter((p) => st.online[p.callsign] || st.bookings[p.callsign]);
        const known = new Set(list.map((p) => st.online[p.callsign]?.callsign));
        // kontrolerzy EP** spoza pliku .ese (np. nowe stanowiska) też są na liście
        const extra = (st.onlineRaw?.controllers || []).filter((c) => !known.has(c.callsign) && !c.callsign.endsWith("_OBS"))
          .map((c) => ({ callsign: c.callsign, name: "(spoza pliku .ese)", frequency: c.frequency, prefix: c.callsign.split("_")[0], _on: c }));
        extra.forEach((p) => { st.online[p.callsign] ||= p._on; });
        return groupsHtml(group([...list, ...extra], (p) => p.prefix), "Nikt z EPWW ani sąsiadów nie jest teraz online i nie ma rezerwacji na najbliższe 24 h.");
      }) },
    ]);
  },
};
