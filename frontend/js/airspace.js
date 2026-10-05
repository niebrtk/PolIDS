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

// Granice FIR: szare kontury, FIR z zalogowanym kontrolerem CTR/FSS na zielono z jego callsignem i częstotliwością.
export function drawFirs(layer, firs, onlineFirs = {}, { skip = ["EPWW"], labels = true } = {}) {
  firs.features.forEach((f) => {
    const id = f.properties.id;
    if (skip.some((s) => id === s || id.startsWith(s + "-"))) return;
    const on = onlineFirs[id];
    // sektory ACC (EDWW-ALR itd.) rysujemy tylko, gdy są online; całe FIR-y zawsze
    if (id.includes("-") && !on) return;
    L.geoJSON(f, {
      interactive: false,
      style: on ? { color: "#5fd23a", weight: 1.5, fillColor: "#5fd23a", fillOpacity: 0.12 }
        : { color: "#4a524a", weight: 1, fill: false, dashArray: "4 4" },
    }).addTo(layer);
    if (labels) {
      const html = on ? on.map((c) => `<span class="freq on">${esc(c.frequency)}</span> ${esc(c.callsign)}`).join("<br>")
        : `<span class="firname">${esc(id)}</span>`;
      L.marker([f.properties.label[1], f.properties.label[0]], {
        interactive: !!on,
        icon: L.divIcon({ className: "maplabel", html: `<div>${html}</div>`, iconSize: null }),
      }).bindTooltip(on ? on.map((c) => `${esc(c.callsign)} · ${esc(c.name || "")} (${esc(c.cid)})`).join("<br>") : "")
        .addTo(layer);
    }
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

// Samolot: strzałka obrócona wg kursu, etykieta z callsignem (i FL/typem przy większym zoomie).
export function aircraftMarker(p, { label = true, detail = false } = {}) {
  const fl = p.altitude !== null && p.altitude !== undefined ? "FL" + String(Math.round(p.altitude / 100)).padStart(3, "0") : "";
  const html = `<div class="ac"><svg viewBox="-10 -10 20 20" style="transform:rotate(${p.heading || 0}deg)"><path d="M0,-9 L6,8 L0,4 L-6,8 Z"/></svg>`
    + (label ? `<span>${esc(p.callsign)}${detail ? `<br>${fl} ${esc(p.aircraft || "")} ${p.groundspeed ?? ""}` : ""}</span>` : "") + "</div>";
  return L.marker([p.lat, p.lon], { icon: L.divIcon({ className: "acicon", html, iconSize: [20, 20], iconAnchor: [10, 10] }) });
}
