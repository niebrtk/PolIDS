// Wspólne funkcje: zapytania do API i drobne narzędzia DOM.

export async function api(path, options = {}) {
  const res = await fetch(path, options);
  let body = null;
  try { body = await res.json(); } catch { /* pusta odpowiedź */ }
  if (!res.ok) {
    const msg = body && body.detail ? (typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail)) : res.statusText;
    throw new Error(msg);
  }
  return body;
}

export function esc(v) {
  return String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export function h(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

export function fmt(v, digits = 1, unit = "") {
  if (v === null || v === undefined || v === "") return "–";
  const n = Number(v);
  if (Number.isNaN(n)) return esc(v);
  return (Number.isInteger(n) ? n : n.toFixed(digits)) + unit;
}

export function debounce(fn, ms = 250) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

// Podmenu PANDORY: kolumna zielonych przycisków obok menu głównego.
// tabs: [{id, label, render(pane), fill?}] albo {sep: true} jako odstęp.
export function subtabs(root, tabs) {
  const nav = h(`<nav class="submenu">${tabs.map((t) => t.sep ? `<div class="sep"></div>` : `<button data-id="${t.id}">${esc(t.label)}</button>`).join("")}</nav>`);
  const pane = h(`<div class="pane"></div>`);
  root.append(nav, pane);
  let current = null;
  const show = (id) => {
    current?.destroy?.();
    const t = tabs.find((x) => x.id === id) || tabs.find((x) => !x.sep);
    nav.querySelectorAll("button[data-id]").forEach((b) => b.classList.toggle("active", b.dataset.id === t.id));
    pane.className = "pane" + (t.fill ? " fill" : "");
    pane.innerHTML = "";
    current = t.render(pane) || null;
  };
  nav.addEventListener("click", (e) => { const b = e.target.closest("button[data-id]"); if (b) show(b.dataset.id); });
  show(tabs.find((x) => !x.sep).id);
  return { nav, pane, show };
}

// Podmenu z literami A–Z (jak w AIRCRAFT / CALLSIGN w PANDORZE). onPick("") = wszystkie.
export function letterMenu(root, onPick) {
  const letters = ["*", ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"];
  const nav = h(`<nav class="submenu letters">${letters.map((l) => `<button data-l="${l}">${l === "*" ? "∗" : l}</button>`).join("")}</nav>`);
  root.append(nav);
  const set = (l) => nav.querySelectorAll("button").forEach((b) => b.classList.toggle("active", b.dataset.l === l));
  nav.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-l]");
    if (!b) return;
    set(b.dataset.l);
    onPick(b.dataset.l === "*" ? "" : b.dataset.l);
  });
  set("*");
  return { set: (l) => set(l || "*") };
}

export function iframeWithFallback(pane, url, note = "") {
  pane.append(h(`<div class="toolbar" style="padding:6px 10px;margin:0;background:var(--panel)">
      <span class="hint mono">${esc(url)}</span><span style="flex:1"></span>
      ${note ? `<span class="hint">${esc(note)}</span>` : ""}
      <a class="btn" href="${esc(url)}" target="_blank" rel="noopener">Otwórz w nowej karcie ↗</a></div>`));
  pane.append(h(`<iframe class="embed" src="${esc(url)}" referrerpolicy="no-referrer"></iframe>`));
}

export const BASEMAPS = {
  dark: L => L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png", {
    attribution: "© OpenStreetMap, © CARTO", subdomains: "abcd", maxZoom: 19 }),
  osm: L => L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap", maxZoom: 19 }),
};
