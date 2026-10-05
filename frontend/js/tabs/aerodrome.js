import { api, esc, fmt, h } from "../api.js";
import { colorize } from "./meteo.js";

// Róża wiatrów: pasy jako prostokąty, strzałka wiatru skąd wieje.
function windrose(status) {
  const p = status.parsed || {};
  const size = 260, c = size / 2, r = 105;
  const seen = new Set();
  const rwys = status.runways.filter((x) => {
    const key = Math.round((x.heading % 180) / 5);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const ticks = Array.from({ length: 36 }, (_, i) => {
    const a = (i * 10 - 90) * Math.PI / 180, l = i % 9 === 0 ? 12 : 6;
    return `<line x1="${c + Math.cos(a) * r}" y1="${c + Math.sin(a) * r}" x2="${c + Math.cos(a) * (r - l)}" y2="${c + Math.sin(a) * (r - l)}" stroke="#9aa4af"/>`;
  }).join("");
  const labels = ["N", "E", "S", "W"].map((t, i) => {
    const a = (i * 90 - 90) * Math.PI / 180;
    return `<text x="${c + Math.cos(a) * (r + 13)}" y="${c + Math.sin(a) * (r + 13) + 4}" fill="#9aa4af" font-size="12" text-anchor="middle">${t}</text>`;
  }).join("");
  const rw = rwys.map((x) => `<rect x="${c - 6}" y="${c - 70}" width="12" height="140" fill="#555" stroke="#888" transform="rotate(${x.heading} ${c} ${c})"/>`).join("");
  let arrow = "";
  if (p.wind_dir !== null && p.wind_dir !== undefined) {
    arrow = `<g transform="rotate(${p.wind_dir} ${c} ${c})"><line x1="${c}" y1="${c - r + 4}" x2="${c}" y2="${c - 30}" stroke="#2f8fff" stroke-width="4"/>
      <polygon points="${c - 9},${c - 42} ${c + 9},${c - 42} ${c},${c - 26}" fill="#2f8fff"/></g>`;
  }
  if (p.wind_var_from !== null && p.wind_var_from !== undefined) {
    const arc = (deg) => { const a = (deg - 90) * Math.PI / 180; return [c + Math.cos(a) * (r - 18), c + Math.sin(a) * (r - 18)]; };
    const [x1, y1] = arc(p.wind_var_from), [x2, y2] = arc(p.wind_var_to);
    const span = ((p.wind_var_to - p.wind_var_from) + 360) % 360;
    arrow += `<path d="M${x1},${y1} A${r - 18},${r - 18} 0 ${span > 180 ? 1 : 0} 1 ${x2},${y2}" stroke="#ffb020" stroke-width="3" fill="none"/>`;
  }
  return `<svg class="windrose" viewBox="0 0 ${size} ${size}"><circle cx="${c}" cy="${c}" r="${r}" fill="#1b1f24" stroke="#3c444e"/>${ticks}${labels}${rw}${arrow}</svg>`;
}

function windText(p) {
  if (!p || p.wind_speed === null) return "–";
  const dir = p.wind_variable ? "VRB" : String(p.wind_dir).padStart(3, "0");
  return `${dir}°/${p.wind_speed}${p.wind_gust ? "G" + p.wind_gust : ""} kt`;
}

function value(label, v, extra = "") {
  return `<div class="card"><div class="label">${label}</div><div class="big" style="font-size:22px">${v}</div>${extra}</div>`;
}

export default {
  mount(root, ctx) {
    const MAIN = ["EPWA", "EPMO", "EPKK", "EPKT", "EPGD", "EPPO", "EPWR", "EPLL", "EPRZ", "EPLB", "EPSC", "EPBY", "EPSY", "EPZG", "EPRA"];
    const sub = h(`<nav class="submenu">${MAIN.map((i) => `<button data-ad="${i}">${i}</button>`).join("")}</nav>`);
    root.append(sub);
    sub.addEventListener("click", (e) => { const b = e.target.closest("button[data-ad]"); if (b) go(b.dataset.ad); });
    const pane = h(`<div class="pane">
      <div class="toolbar">
        <input class="field ad" list="ad-list" size="10" placeholder="ICAO">
        <datalist id="ad-list"></datalist>
        <button class="btn primary go">Pokaż</button>
        <span class="title" style="font-weight:600"></span><span style="flex:1"></span>
        <span class="hint upd"></span>
      </div>
      <div class="content"></div>
    </div>`);
    root.append(pane);
    const $ = (s) => pane.querySelector(s);
    let icao = localStorage.getItem("aerodrome.icao") || ctx.config.default_aerodrome || "EPWA";
    let timer = null;

    api("/api/aerodromes").then((ads) => {
      $("#ad-list").innerHTML = ads.map((a) => `<option value="${a.icao}">${esc(a.name)}</option>`).join("");
    });

    const renderChecklist = async (el) => {
      const data = await api(`/api/aerodromes/${icao}/checklist`);
      const key = `checklist.${icao}`;
      let done = {};
      try { done = JSON.parse(localStorage.getItem(key) || "{}"); } catch { done = {}; }
      el.innerHTML = data.items.map((t, i) => `<label><input type="checkbox" data-i="${i}" ${done[i] ? "checked" : ""}>${esc(t)}</label>`).join("") +
        `<button class="btn reset" style="margin-top:6px">Wyczyść</button>`;
      el.onchange = (e) => { done[e.target.dataset.i] = e.target.checked; localStorage.setItem(key, JSON.stringify(done)); };
      el.querySelector(".reset").onclick = () => { localStorage.removeItem(key); renderChecklist(el); };
    };

    const renderNotams = async (el) => {
      el.innerHTML = `<span class="hint">Ładowanie NOTAM…</span>`;
      try {
        const data = await api(`/api/notam/${icao}`);
        el.innerHTML = data.notams.length
          ? data.notams.map((n) => `<div class="notam"><b class="mono">${esc(n.id || "")}</b><pre>${esc(n.raw)}</pre></div>`).join("")
          : `<span class="hint">Brak NOTAM-ów.</span>`;
      } catch (e) { el.innerHTML = `<span class="error">${esc(e.message)}</span>`; }
    };

    const load = async () => {
      const content = $(".content");
      let info, st;
      try {
        [info, st] = await Promise.all([api(`/api/aerodromes/${icao}`), api(`/api/aerodromes/${icao}/status`)]);
      } catch (e) { content.innerHTML = `<p class="error">${esc(e.message)}</p>`; return; }
      const p = st.parsed || {};
      $(".title").textContent = `${info.icao} · ${info.name}  (elev ${fmt(info.elevation_ft, 0)} ft)`;
      $(".upd").textContent = "Aktualizacja " + new Date().toISOString().slice(11, 16) + "Z";
      const clouds = (p.clouds || []).map((c) => `${c.cover}${c.base_ft !== null ? String(c.base_ft / 100).padStart(3, "0") : "///"}${c.type || ""}`).join(" ") || (p.cavok ? "CAVOK" : "NSC");
      const rvr = (p.rvr || []).map((x) => `R${x.runway} ${x.value}`).join("<br>") || "–";
      content.innerHTML = `
        ${st.errors.length ? `<p class="error">${st.errors.map(esc).join("<br>")}</p>` : ""}
        <div class="awos">
          <div class="card" style="text-align:center">${windrose(st)}
            <div class="big">${windText(p)}</div>
            <div class="hint">${p.wind_var_from !== null && p.wind_var_from !== undefined ? `zmienny ${p.wind_var_from}°–${p.wind_var_to}°` : "&nbsp;"}</div>
          </div>
          <div>
            <div class="values">
              ${value("QNH", p.qnh ?? "–", '<span class="hint">hPa</span>')}
              ${value("QFE", st.qfe ?? "–", '<span class="hint">hPa (przybl.)</span>')}
              ${value("Widzialność", p.visibility_m !== null && p.visibility_m !== undefined ? (p.visibility_m >= 9999 ? "≥10 km" : p.visibility_m + " m") : "–")}
              ${value("Podstawa", p.ceiling_ft ? p.ceiling_ft + " ft" : "–")}
              ${value("Temp / Dew", `${p.temperature ?? "–"} / ${p.dewpoint ?? "–"}`, '<span class="hint">°C</span>')}
              ${value("Kategoria", `<span class="cat-${esc(p.flight_category)}">${esc(p.flight_category || "–")}</span>`)}
              ${value("Chmury", `<span style="font-size:15px">${esc(clouds)}</span>`)}
              ${value("RVR", `<span style="font-size:15px">${rvr}</span>`)}
              ${value("Zjawiska", `<span style="font-size:15px">${esc((p.weather || []).join(" ") || "–")}</span>`)}
            </div>
            <div class="card" style="margin-top:12px">
              <h3>Pasy · sugerowany: <span class="badge" style="color:var(--ok)">${esc(st.suggested_runway || "–")}</span> <span class="hint">${esc(st.suggestion_reason)}</span></h3>
              <table class="data rwy-table"><thead><tr><th>Pas</th><th>Kurs (true)</th><th>Długość</th><th>Czołowy</th><th>Boczny</th></tr></thead><tbody>
              ${st.runways.map((r) => `<tr><td class="mono ${r.designator === st.suggested_runway ? "sugg" : ""}">${esc(r.designator)}</td>
                <td class="num">${fmt(r.heading, 0)}°</td><td class="num">${fmt(r.length_m, 0)} m</td>
                <td class="num" style="color:${r.headwind < 0 ? "var(--bad)" : "inherit"}">${r.headwind === null ? "–" : (r.headwind < 0 ? "TW " : "") + Math.abs(r.headwind).toFixed(0) + " kt"}</td>
                <td class="num">${r.crosswind === null ? "–" : Math.abs(r.crosswind).toFixed(0) + " kt " + (r.crosswind > 0 ? "R" : r.crosswind < 0 ? "L" : "")}</td></tr>`).join("")}
              </tbody></table>
            </div>
          </div>
        </div>
        <div class="grid two" style="margin-top:12px">
          <div class="card"><h3>METAR</h3><div class="wx">${colorize(st.metar)}</div><h3 style="margin-top:12px">TAF</h3><div class="wx">${st.taf ? st.taf.split("\n").map((l) => colorize(l.trim())).join("<br>&nbsp;&nbsp;&nbsp;&nbsp;") : colorize(null)}</div></div>
          <div class="card"><h3>Częstotliwości</h3>
            <table class="data">${info.atc_positions.map((x) => `<tr><td class="mono">${esc(x.callsign)}</td><td>${esc(x.name)}</td><td class="num">${esc(x.frequency)}</td></tr>`).join("")
              || info.frequencies.map((x) => `<tr><td>${esc(x.kind)}</td><td>${esc(x.description)}</td><td class="num">${esc(x.mhz)}</td></tr>`).join("")
              || `<tr><td class="hint">Brak danych</td></tr>`}</table>
          </div>
          <div class="card"><h3>NOTAM</h3><div class="notams"></div></div>
          <div class="card"><h3>Checklista</h3><div class="checklist"></div></div>
        </div>`;
      renderNotams(content.querySelector(".notams"));
      renderChecklist(content.querySelector(".checklist"));
    };

    const go = (code) => {
      icao = (code || $(".ad").value || icao).trim().toUpperCase();
      $(".ad").value = icao;
      localStorage.setItem("aerodrome.icao", icao);
      sub.querySelectorAll("button").forEach((b) => b.classList.toggle("active", b.dataset.ad === icao));
      history.replaceState(null, "", "#aerodrome/" + icao);
      load();
      clearInterval(timer);
      timer = setInterval(load, 60000);
    };
    $(".go").addEventListener("click", () => go());
    $(".ad").addEventListener("keydown", (e) => e.key === "Enter" && go());
    $(".ad").addEventListener("change", () => go());
    return { activate: (arg) => go(arg || icao) };
  },
};
