import { esc } from "./api.js";

// Ruch vs przepustowość sektorów (traffic volumes vIFF) na godzinę naprzód, w stylu wykresów NM UI.
// Kolory obciążenia: zielony < 90 % przepustowości, pomarańczowy 90–100 %, czerwony powyżej (przeciążenie).

const BAND = { H: "górny", M: "środkowy", L: "dolny" };
const FIR_PART = { ALLFIR: "cały FIR", NFIR: "FIR północ", SFIR: "FIR południe" };

export function tvLabel(id) {
  const code = id.replace(/^EP-/, "");
  let m = /^([A-Z])([HML])$/.exec(code);
  if (m) return `sektor ${m[1]} ${BAND[m[2]]}`;
  m = /^([A-Z]{2})TMA(D?)$/.exec(code);
  if (m) return `TMA EP${m[1]}${m[2] ? " (D)" : ""}`;
  m = /^(ALLFIR|NFIR|SFIR)(.*)$/.exec(code);
  if (m) return `${FIR_PART[m[1]]}${m[2] ? " " + m[2] : ""}`;
  return "kombinacja sektorów";
}

export const tvGroup = (tv) => (tv.status === 1 ? "Aktywne (regulowane)" : /^EP-[A-Z][HML]$/.test(tv.id) ? "Sektory ACC"
  : /TMA/.test(tv.id) ? "TMA" : "Kombinacje i FIR");

export function loadClass(n, cap) {
  if (!cap || n === null || n === undefined) return "nolim";
  const r = n / cap;
  return r > 1 ? "over" : r >= 0.9 ? "near" : "ok";
}

// największe obciążenie w ciągu godziny: wejścia (vIFF, bieżąca i następna godzina) albo zajętość
export function loadRatio(tv) {
  const e = Math.max(0, ...tv.hours.map((h) => (h.entries_cap ? h.entries / h.entries_cap : 0)));
  const o = tv.occupancy_cap ? tv.peak_60 / tv.occupancy_cap : 0;
  return Math.max(e, o);
}

export function listRow(tv, selected) {
  const r = loadRatio(tv);
  const cls = r > 1 ? "over" : r >= 0.9 ? "near" : r > 0 ? "ok" : "nolim";
  // liczba przy pasku: godzina (bieżąca albo następna) z większym obciążeniem wejść
  const h0 = [...tv.hours].sort((a, b) => (b.entries_cap ? b.entries / b.entries_cap : 0) - (a.entries_cap ? a.entries / a.entries_cap : 0))[0];
  return `<button class="vf-row ${tv.id === selected ? "on" : ""}" data-tv="${esc(tv.id)}" title="${esc(tvLabel(tv.id))}">
    <b>${esc(tv.id)}</b><span class="vf-bar"><i class="${cls}" style="width:${Math.min(100, Math.round(r * 100))}%"></i></span>
    <span class="vf-num" title="${h0 ? esc(h0.hour) + "Z" : ""}">${h0 ? `${h0.entries}/${h0.entries_cap ?? "∞"}` : "–"}</span></button>`;
}

const clock = (now, m) => {
  const t = (parseInt(now.slice(0, 2), 10) * 60 + parseInt(now.slice(2), 10) + m) % 1440;
  return String(Math.floor(t / 60)).padStart(2, "0") + String(t % 60).padStart(2, "0");
};

// Wykres: po lewej wejścia na godzinę (vIFF: bieżąca i następna pełna godzina) z linią przepustowości,
// po prawej liczba samolotów w sektorze minuta po minucie od teraz do +60 min z linią przepustowości chwilowej.
export function chartHtml(tv, now) {
  const W = 540, H = 150, top = 14, bottom = 22, plotH = H - top - bottom;
  // --- wejścia / h
  const hours = tv.hours.length ? tv.hours : [];
  const eMax = Math.max(4, tv.entries_cap || 0, ...hours.map((h) => h.entries || 0)) * 1.1;
  const ey = (v) => top + plotH - (v / eMax) * plotH;
  const bars = hours.map((h, i) => {
    const x = 34 + i * 62, y = ey(h.entries || 0);
    return `<rect x="${x}" y="${y}" width="40" height="${top + plotH - y}" class="vf-${loadClass(h.entries, h.entries_cap)}"/>
      <text x="${x + 20}" y="${y - 3}" class="vf-val">${h.entries ?? "–"}</text>
      <text x="${x + 20}" y="${H - 6}" class="vf-ax">${esc(h.hour)}Z${i === 0 ? " teraz" : ""}</text>`;
  }).join("");
  const eCap = tv.entries_cap ? `<line x1="26" x2="162" y1="${ey(tv.entries_cap)}" y2="${ey(tv.entries_cap)}" class="vf-cap"/>
    <text x="164" y="${ey(tv.entries_cap) + 4}" class="vf-capt">${tv.entries_cap}</text>` : "";
  // --- zajętość minuta po minucie
  const occ = tv.occupancy || [];
  const oMax = Math.max(3, tv.occupancy_cap || 0, ...occ) * 1.1;
  const x0 = 214, x1 = W - 34, ox = (m) => x0 + (m / 60) * (x1 - x0), oy = (v) => top + plotH - (v / oMax) * plotH;
  let path = `M${ox(0)},${oy(0)}`;
  occ.forEach((v, m) => { path += `L${ox(m)},${oy(v)}L${ox(m + 1 > 60 ? 60 : m + 1)},${oy(v)}`; });
  path += `L${ox(60)},${oy(0)}Z`;
  const oCls = loadClass(tv.peak_60, tv.occupancy_cap);
  const ticks = [0, 20, 40, 60].map((m) => `<line x1="${ox(m)}" x2="${ox(m)}" y1="${top}" y2="${top + plotH}" class="vf-grid"/>
    <text x="${ox(m)}" y="${H - 6}" class="vf-ax">${clock(now, m)}</text>`).join("");
  const oCap = tv.occupancy_cap ? `<line x1="${x0}" x2="${x1}" y1="${oy(tv.occupancy_cap)}" y2="${oy(tv.occupancy_cap)}" class="vf-cap"/>
    <text x="${x1 + 3}" y="${oy(tv.occupancy_cap) + 4}" class="vf-capt">${tv.occupancy_cap}</text>` : "";
  const yTicks = (max, y, x) => [0, Math.round(max / 2), Math.floor(max)].map((v) => `<text x="${x}" y="${y(v) + 4}" class="vf-ax end">${v}</text>`).join("");
  const svg = `<svg viewBox="0 0 ${W} ${H}" class="vf-svg">
    <text x="96" y="${top - 3}" class="vf-sub">wejścia / godz.${tv.entries_cap ? "" : " (bez limitu)"}</text>
    ${yTicks(eMax / 1.1, ey, 24)}${bars}${eCap}
    <text x="${(x0 + x1) / 2}" y="${top - 3}" class="vf-sub">samoloty w sektorze (teraz → +60 min)</text>
    ${ticks}${yTicks(oMax / 1.1, oy, x0 - 6)}<path d="${path}" class="vf-occ vf-${oCls}"/>${oCap}
  </svg>`;
  const fls = (tv.flights || []).map((f) => `<span class="${f.airborne ? "" : "vf-gnd"}" title="${f.airborne ? "w powietrzu" : "jeszcze na ziemi / planowany"}">${esc(f.callsign)} ${esc(f.entry)}–${esc(f.exit)}</span>`).join("");
  return `<div class="vf-head"><b>${esc(tv.id)}</b><span>${esc(tvLabel(tv.id))}</span>
      <span class="hint">${tv.status === 1 ? "aktywny w vIFF · " : ""}${tv.volumes.length ? esc(tv.volumes.join(", ")) : ""}</span>
      <button class="btn vf-close" title="Zamknij wykres">✕</button></div>
    ${svg}
    <div class="vf-legend"><span><i class="vf-ok"></i>&lt; 90 %</span><span><i class="vf-near"></i>90–100 %</span><span><i class="vf-over"></i>&gt; przepustowość</span>
      <span><i class="vf-capl"></i>przepustowość</span><span class="hint">vIFF ${esc(now.slice(0, 2))}:${esc(now.slice(2))}Z · szczyt ${tv.peak_60}${tv.occupancy_cap ? "/" + tv.occupancy_cap : ""} ·
      wejścia co 20 min: ${(tv.windows || []).map((w) => w.entries).join(" · ") || "–"}</span></div>
    ${fls ? `<div class="vf-flights mono">${fls}</div>` : `<div class="hint">brak lotów w ciągu godziny</div>`}`;
}
