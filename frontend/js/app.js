import { api } from "./api.js";
import meteo from "./tabs/meteo.js";
import { adciv, admil, advfr } from "./tabs/aip.js";
import about from "./tabs/about.js";
import radio from "./tabs/radio.js";
import emergency from "./tabs/emergency.js";
import aircraft from "./tabs/aircraft.js";
import callsign from "./tabs/callsign.js";
import aerodrome from "./tabs/aerodrome.js";
import map from "./tabs/map.js";
import inop from "./tabs/inop.js";
import docs from "./tabs/docs.js";

const TABS = { about, radio, meteo, aerodrome, adciv, admil, advfr, callsign, aircraft, map, inop, docs, emergency };
const views = document.getElementById("views");
const mounted = {};
const ctx = { config: null, open };

function open(tab, arg) {
  if (!TABS[tab]) tab = "aerodrome";
  document.querySelectorAll("#tabs button").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  views.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
  if (!mounted[tab]) {
    const el = document.createElement("section");
    el.className = "view";
    views.append(el);
    mounted[tab] = { el, api: TABS[tab].mount(el, ctx) || {} };
  }
  mounted[tab].el.classList.add("active");
  mounted[tab].api.activate?.(arg);
  const hash = "#" + tab + (arg ? "/" + arg : "");
  if (location.hash !== hash) history.replaceState(null, "", hash);
}

document.getElementById("tabs").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-tab]");
  if (b) open(b.dataset.tab);
});

window.addEventListener("hashchange", () => {
  const [tab, arg] = location.hash.slice(1).split("/");
  if (tab) open(tab, arg);
});

function tick() {
  const d = new Date();
  document.getElementById("utc").textContent = d.toISOString().slice(11, 19) + "Z";
}
setInterval(tick, 1000);
tick();

(async () => {
  try {
    ctx.config = await api("/api/config");
    document.getElementById("airac").textContent = `AIRAC ${ctx.config.airac.ident}`;
    document.getElementById("airac").title = `od ${ctx.config.airac.effective}, następny ${ctx.config.airac.next}`;
  } catch (e) {
    ctx.config = { links: {}, default_aerodrome: "EPWA", airac: {} };
    console.error(e);
  }
  const [tab, arg] = location.hash.slice(1).split("/");
  open(tab || "aerodrome", arg);
})();
