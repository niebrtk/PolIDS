// Wspólne warstwy mapy przestrzeni (RADIO i MAP): sektory EPWW z pliku .ese, granice FIR z VATSpy,
// podświetlenie stanowisk zalogowanych w sieci VATSIM.
import { api, esc } from "./api.js";

const PALETTE = ["#2f8fff", "#3ecf6e", "#ffb020", "#ff5c8a", "#a970ff", "#00c2c7", "#ff7a3d", "#c3d82b", "#ff4dd2", "#6f8cff"];
export function colorFor(key) {
  let x = 0;
  for (const ch of String(key)) x = (x * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[x % PALETTE.length];
}

let firsPromise = null;
export const loadFirs = () => (firsPromise ||= api("/api/vatsim/firs").catch((e) => { firsPromise = null; throw e; }));

export const fl = (ft) => "FL" + String(Math.round((ft || 0) / 100)).padStart(3, "0");

// --- Plakietki stanowisk online jak w VATSIM Radar: lotnisko = ICAO + D/G/T/A/APP, FIR = CTR + id.
// Po najechaniu dymek z listą: znak, częstotliwość, imię i nazwisko, CID, rating, od kiedy online, ATIS.
export const FACILITIES = [["DEL", "D", "Delivery"], ["GND", "G", "Ground"], ["TWR", "T", "Tower"], ["ATIS", "A", "ATIS"],
  ["APP", "APP", "Approach / Departure"]];
const RATINGS = { 1: "OBS", 2: "S1", 3: "S2", 4: "S3", 5: "C1", 6: "C2", 7: "C3", 8: "I1", 9: "I2", 10: "I3", 11: "SUP", 12: "ADM" };
const since = (iso) => {
  if (!iso) return "";
  const min = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  return `od ${new Date(iso).toISOString().slice(11, 16)}Z (${min < 60 ? min + " min" : Math.floor(min / 60) + " h " + (min % 60) + " min"})`;
};
const tag = (kind, letter) => `<span class="ab ab-${kind.toLowerCase()}">${letter}</span>`;

function atcRows(list, kind, letter) {
  return list.map((c) => `<tr><td>${tag(kind, letter)}</td><td class="cs">${esc(c.callsign)}</td><td class="fq">${esc(c.frequency)}</td>
    <td>${esc(c.name || "?")} <span class="muted">${esc(c.cid ?? "")}${RATINGS[c.rating] ? " · " + RATINGS[c.rating] : ""}</span></td>
    <td class="muted">${since(c.logon_time)}</td></tr>${kind === "ATIS" && c.text_atis?.length
      ? `<tr><td></td><td colspan="4" class="atis">${c.atis_code ? `<b>INFO ${esc(c.atis_code)}</b> ` : ""}${c.text_atis.map(esc).join(" ")}</td></tr>` : ""}`).join("");
}

// Osobne warstwy (panes) nad nazwami punktów, żeby plakietek nie przykrywały etykiety; dymki jeszcze wyżej.
export function atcPanes(map) {
  [["atcFir", 655], ["atcAd", 660], ["atcTip", 700]].forEach(([n, z]) => {
    if (!map.getPane(n)) map.createPane(n).style.zIndex = z;
  });
  return { fir: "atcFir", ad: "atcAd", tip: "atcTip" };
}

export function atcTooltip(title, subtitle, rows) {
  return `<div class="atc-tip-h"><b>${esc(title)}</b> ${esc(subtitle || "")}</div><table>${rows}</table>`;
}

// Plakietka lotniska (divIcon pod punktem lotniska) z dymkiem
export function airportBadge(ap, panes = {}) {
  const fac = ap.facilities;
  const html = `<div class="atcb"><b class="ab-icao">${esc(ap.icao)}</b>${FACILITIES.filter(([k]) => fac[k])
    .map(([k, l]) => tag(k, l)).join("")}</div>`;
  const rows = FACILITIES.filter(([k]) => fac[k]).map(([k, l]) => atcRows(fac[k], k, l)).join("");
  return L.marker([ap.lat, ap.lon], { icon: L.divIcon({ className: "atcicon", html, iconSize: null }), pane: panes.ad || "markerPane" })
    .bindTooltip(atcTooltip(ap.icao, ap.name, rows), { direction: "top", offset: [0, -6], className: "atc-tip", opacity: 1, pane: panes.tip || "tooltipPane" });
}

// Granice FIR: szare kontury; FIR z zalogowanym kontrolerem CTR/FSS na zielono z plakietką CTR (dymek: kto jest online).
// FIR-y z `skip` (EPWW: rysujemy tam sektory z pliku .ese) dostają samą plakietkę, gdy ktoś jest online.
export function drawFirs(layer, firs, onlineFirs = {}, { skip = ["EPWW"], labels = true, panes = {} } = {}) {
  firs.features.forEach((f) => {
    const id = f.properties.id;
    const on = onlineFirs[id];
    const skipped = skip.some((s) => id === s || id.startsWith(s + "-"));
    if (skipped && !on) return;
    // sektory ACC (EDWW-ALR itd.) rysujemy tylko, gdy są online; całe FIR-y zawsze
    if (id.includes("-") && !on) return;
    if (!skipped) {
      L.geoJSON(f, {
        interactive: false,
        style: on ? { color: "#5fd23a", weight: 1.5, fillColor: "#5fd23a", fillOpacity: 0.12 }
          : { color: "#4a524a", weight: 1, fill: false, dashArray: "4 4" },
      }).addTo(layer);
    }
    if (!labels) return;
    const at = [f.properties.label[1], f.properties.label[0]];
    if (!on) {
      L.marker(at, { interactive: false, icon: L.divIcon({ className: "maplabel", html: `<div><span class="firname">${esc(id)}</span></div>`, iconSize: null }) })
        .addTo(layer);
      return;
    }
    const html = `<div class="atcb fir">${tag("CTR", "CTR")}<b class="ab-icao">${esc(id)}</b></div>`;
    L.marker(at, { icon: L.divIcon({ className: "atcicon center", html, iconSize: null }), pane: panes.fir || "markerPane" })
      .bindTooltip(atcTooltip(id, f.properties.name || "", atcRows(on, "CTR", "CTR")),
        { direction: "top", offset: [0, -12], className: "atc-tip", opacity: 1, pane: panes.tip || "tooltipPane" })
      .addTo(layer);
  });
}

// Sektory EPWW: kolor wg właściciela; w trybie online szary = nikt nie obsługuje (UNICOM).
// online = {sector_owner: {nazwa: {callsign, frequency, name, cid}}} albo null (podział pełny z pliku .ese).
export function drawSectors(layer, gj, online = null, { labels = true } = {}) {
  gj.features.forEach((f) => {
    const pr = f.properties;
    const own = online ? online.sector_owner[pr.name] : null;
    const cs = online ? own?.callsign : pr.callsign;
    const freq = online ? own?.frequency : pr.frequency;
    const color = online && !own ? "#555" : colorFor(cs || pr.name);
    const poly = L.geoJSON(f, { style: { color, weight: 1.2, fillColor: color, fillOpacity: online && !own ? 0.03 : 0.16 } })
      .bindTooltip(`<b>${esc(pr.name)}</b> ${fl(pr.lower_ft)}–${fl(pr.upper_ft)}<br>${online ? (own ? `${esc(own.callsign)} ${esc(own.frequency)}<br>${esc(own.name || "")} (${esc(own.cid ?? "")})` : "UNICOM 122.800") : `${esc(cs || "")} ${esc(freq || "")}`}`, { sticky: true });
    poly.addTo(layer);
    if (labels) {
      L.marker(poly.getBounds().getCenter(), {
        interactive: false,
        icon: L.divIcon({ className: "maplabel", iconSize: null,
          html: `<div><small>${esc(pr.name)}</small><br>${freq ? `<span class="freq${own ? " on" : ""}">${esc(freq)}</span>` : `<span class="hint">UNICOM</span>`}</div>` }),
      }).addTo(layer);
    }
  });
}

// Właściciel każdego sektora: pierwsze zalogowane stanowisko z listy OWNER (jak w EuroScope).
export function sectorOwners(gj, positions, online) {
  const byId = Object.fromEntries(positions.map((p) => [p.position_id, p]));
  const owners = {};
  gj.features.forEach((f) => {
    const owner = (f.properties.owners || []).map((id) => byId[id]).find((p) => p && online[p.callsign]);
    if (owner) owners[f.properties.name] = online[owner.callsign];
  });
  return { sector_owner: owners };
}

// Sylwetka samolotu widziana z góry (nos do góry), obracana wg kursu
export const PLANE_PATH = "M0,-9.5 C0.9,-9.5 1.3,-8.4 1.3,-7 L1.3,-2.6 L9,1.6 L9,3.3 L1.3,1 L1.1,5.6 L3.6,7.6 L3.6,8.9 L0,8 "
  + "L-3.6,8.9 L-3.6,7.6 L-1.1,5.6 L-1.3,1 L-9,3.3 L-9,1.6 L-1.3,-2.6 L-1.3,-7 C-1.3,-8.4 -0.9,-9.5 0,-9.5 Z";

// Samolot: sylwetka obrócona wg kursu, etykieta z callsignem (i FL/typem przy większym zoomie).
export function aircraftMarker(p, { label = true, detail = false } = {}) {
  const fl = p.altitude !== null && p.altitude !== undefined ? "FL" + String(Math.round(p.altitude / 100)).padStart(3, "0") : "";
  const html = `<div class="ac"><svg viewBox="-10 -10 20 20" style="transform:rotate(${p.heading || 0}deg)"><path d="${PLANE_PATH}"/></svg>`
    + (label ? `<span>${esc(p.callsign)}${detail ? `<br>${fl} ${esc(p.aircraft || "")} ${p.groundspeed ?? ""}` : ""}</span>` : "") + "</div>";
  return L.marker([p.lat, p.lon], { icon: L.divIcon({ className: "acicon", html, iconSize: [20, 20], iconAnchor: [10, 10] }) });
}

// Symbole punktów jak w EuroScope (SYMBOLDEF, jednostki = piksele, oś Y w dół).
// Linie: [[x, y], ...] rysowane jako łamana; okrąg: {circle: promień}.
export const SYMBOLS = {
  aerodrome: [[[-2, -4], [4, -4]], [[4, -4], [7, -1]], [[7, -1], [4, 2]], [[4, 2], [-2, 2]], [[-2, 2], [-6, -2]], [[-4, -2], [-2, -4]]],
  vor: [[[-4, 0], [-2, 2], [2, 2], [4, 0], [2, -2], [-2, -2], [-4, 0]]],
  ndb: [[[0, -4], [-2, 0], [0, 4], [2, 0], [0, -4]]],
  vfr: { circle: 3 },
  fix: { circle: 4 },
};
export const symbolFor = (kind) => ({ AD: "aerodrome", VOR: "vor", "VOR-DME": "vor", VORTAC: "vor", DME: "vor", NDB: "ndb", "NDB-DME": "ndb", VFR: "vfr" }[kind] || "fix");

// Ikona SVG symbolu (legenda, przyciski warstw)
export function symbolSvg(name, color = "currentColor", size = 18, scale = 1.6) {
  const sym = SYMBOLS[name];
  const v = size / 2 / scale;
  const body = sym.circle ? `<circle cx="0" cy="0" r="${sym.circle}"/>`
    : sym.map((line) => `<polyline points="${line.map(([x, y]) => `${x},${y}`).join(" ")}"/>`).join("");
  return `<svg class="sym" width="${size}" height="${size}" viewBox="${-v} ${-v} ${2 * v} ${2 * v}" fill="none" stroke="${color}" stroke-width="${1.4 / scale * 1.4}">${body}</svg>`;
}

// Marker rysowany na kanwie (mapa z preferCanvas): kształt z SYMBOLS, skalowany. Obsługuje dymki i kliknięcia
// jak CircleMarker (obszar trafienia = promień).
export const SymbolMarker = L.CircleMarker.extend({
  options: { symbol: "fix", scale: 1.6, fill: false, weight: 1.6, radius: 8 },
  _updatePath() {
    const r = this._renderer;
    if (!r._ctx) { r._updateCircle(this); return; }
    if (!r._drawing || this._empty()) return;
    const ctx = r._ctx, p = this._point, s = this.options.scale, sym = SYMBOLS[this.options.symbol] || SYMBOLS.fix;
    ctx.beginPath();
    if (sym.circle) {
      ctx.moveTo(p.x + sym.circle * s, p.y);
      ctx.arc(p.x, p.y, sym.circle * s, 0, Math.PI * 2);
    } else {
      sym.forEach((line) => line.forEach(([x, y], i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, p.x + x * s, p.y + y * s)));
    }
    r._fillStroke(ctx, this);
  },
});
