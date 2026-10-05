import { api, debounce, esc, fmt, h, letterMenu } from "../api.js";

const RECAT = {
  A: "Super Heavy", B: "Upper Heavy", C: "Lower Heavy", D: "Upper Medium", E: "Lower Medium", F: "Light",
};
const DESC_KIND = { L: "samolot lądowy", S: "wodnosamolot", A: "amfibia", H: "śmigłowiec", G: "wiatrakowiec", T: "tiltrotor" };
const DESC_ENG = { J: "odrzutowy", T: "turbośmigłowy", P: "tłokowy", E: "elektryczny", R: "rakietowy" };

function describe(d) {
  if (!d || d.length < 3) return "";
  return `${DESC_KIND[d[0]] || d[0]}, ${d[1]} × silnik ${DESC_ENG[d[2]] || d[2]}`;
}

function photoUrl(a) {
  return `https://www.jetphotos.com/photo/keyword/${encodeURIComponent(`${a.manufacturer || ""} ${a.model || a.icao}`.trim())}`;
}

export default {
  mount(root) {
    let prefix = "";
    const letters = letterMenu(root, (l) => { prefix = l; load(); });
    const pane = h(`<div class="pane"><div class="split">
      <div class="list">
        <div class="toolbar">
          <input type="search" class="q" placeholder="Typ ICAO, model, producent…" size="32">
          <select class="wtc"><option value="">WTC: wszystkie</option><option>L</option><option>M</option><option>H</option><option>J</option></select>
          <select class="recat"><option value="">RECAT-EU: wszystkie</option>${Object.entries(RECAT).map(([k, v]) => `<option value="${k}">${k} – ${v}</option>`).join("")}</select>
          <span class="hint count"></span>
        </div>
        <table class="data"><thead><tr>
          <th>ICAO</th><th>Producent</th><th>Model</th><th>Opis</th><th>WTC</th><th>RECAT-EU</th>
          <th>Rozpiętość [m]</th><th>Długość [m]</th><th>Wysokość [m]</th><th>MTOW [kg]</th>
        </tr></thead><tbody></tbody></table>
      </div>
      <div class="detail"><div class="card"><p class="hint">Wybierz typ z listy, żeby zobaczyć szczegóły i zdjęcie.</p></div></div>
    </div></div>`);
    root.append(pane);
    const $ = (s) => pane.querySelector(s);
    let rows = [];
    let seq = 0;

    const load = async () => {
      const qs = new URLSearchParams({ q: $(".q").value.trim(), prefix, wtc: $(".wtc").value, recat: $(".recat").value, limit: 500 });
      const my = ++seq;
      let data;
      try {
        data = await api(`/api/aircraft?${qs}`);
      } catch (e) { $("tbody").innerHTML = `<tr><td colspan="10" class="error">${esc(e.message)}</td></tr>`; return; }
      if (my !== seq) return; // starsza odpowiedź przyszła po nowszej
      rows = data;
      $(".count").textContent = `${rows.length} typów${rows.length === 500 ? " (pokazano pierwsze 500)" : ""}`;
      $("tbody").innerHTML = rows.map((a, i) => `<tr data-i="${i}">
        <td class="mono"><b>${esc(a.icao)}</b></td><td>${esc(a.manufacturer)}</td><td>${esc(a.model)}</td>
        <td class="mono">${esc(a.description)}</td><td class="mono">${esc(a.wtc)}</td>
        <td class="mono recat-${esc(a.recat)}"><b>${esc(a.recat)}</b></td>
        <td class="num">${fmt(a.wingspan, 2)}</td><td class="num">${fmt(a.length, 2)}</td><td class="num">${fmt(a.height, 2)}</td>
        <td class="num">${fmt(a.mtow, 0)}</td></tr>`).join("");
    };

    const show = (a) => {
      const url = photoUrl(a);
      $(".detail").innerHTML = `<div class="card">
        <h3>${esc(a.icao)} · ${esc(a.manufacturer)} ${esc(a.model)}</h3>
        <dl class="props">
          <dt>Opis ICAO</dt><dd>${esc(a.description || "–")} <span class="hint">${esc(describe(a.description))}</span></dd>
          <dt>WTC (ICAO)</dt><dd>${esc(a.wtc || "–")}</dd>
          <dt>RECAT-EU</dt><dd class="recat-${esc(a.recat)}">${esc(a.recat || "–")} ${a.recat ? "– " + RECAT[a.recat] : ""}</dd>
          <dt>Rozpiętość</dt><dd>${fmt(a.wingspan, 2, " m")}</dd>
          <dt>Długość</dt><dd>${fmt(a.length, 2, " m")}</dd>
          <dt>Wysokość</dt><dd>${fmt(a.height, 2, " m")}</dd>
          <dt>MTOW / MLW</dt><dd>${fmt(a.mtow, 0, " kg")} / ${fmt(a.mlw, 0, " kg")}</dd>
          <dt>Silniki</dt><dd>${esc(a.engine_count ?? "–")} × ${esc(a.engine_type || "–")}</dd>
          <dt>Pułap</dt><dd>${fmt(a.ceiling_ft, 0, " ft")}</dd>
          <dt>Vmo / Mmo</dt><dd>${fmt(a.vmo_kt, 0, " kt")} / ${fmt(a.mmo, 2)}</dd>
          <dt>IATA</dt><dd>${esc(a.iata || "–")}</dd>
          <dt>Źródło</dt><dd class="hint">${esc(a.source)}</dd>
        </dl></div>
        <div class="card" style="margin-top:12px">
          <h3>Zdjęcie</h3>
          <iframe class="photo" src="${esc(url)}" referrerpolicy="no-referrer"></iframe>
          <p class="hint">Jeśli podgląd jest pusty, serwis blokuje osadzanie:
            <a href="${esc(url)}" target="_blank" rel="noopener">JetPhotos ↗</a> ·
            <a href="https://www.google.com/search?tbm=isch&q=${encodeURIComponent(`${a.manufacturer || ""} ${a.model}`)}" target="_blank" rel="noopener">Google Grafika ↗</a></p>
        </div>`;
    };

    $("tbody").addEventListener("click", (e) => {
      const tr = e.target.closest("tr[data-i]");
      if (!tr) return;
      pane.querySelectorAll("tr.selected").forEach((x) => x.classList.remove("selected"));
      tr.classList.add("selected");
      show(rows[tr.dataset.i]);
    });
    $(".q").addEventListener("input", debounce(load));
    $(".wtc").addEventListener("change", load);
    $(".recat").addEventListener("change", load);
    load();
    return { activate: (arg) => { if (arg) { $(".q").value = arg; prefix = ""; letters.set(""); load(); } $(".q").focus(); } };
  },
};
