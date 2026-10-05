import { api, esc, h } from "../api.js";

// Dokumenty PDF zgromadzone w folderze data/docs/ (podfolder = kategoria). Tylko podgląd.
export default {
  mount(root) {
    const wrap = h(`<div class="pane fill"><div class="mapwrap">
      <div class="mapside">
        <h4>DOKUMENTY</h4>
        <div class="list"></div>
        <p class="hint" style="margin-top:14px">Nowe PDF-y wrzuć do folderu <span class="mono">data/docs/</span>
        (podfolder = kategoria) i kliknij „Odśwież”.</p>
        <button class="btn refresh">Odśwież</button>
      </div>
      <iframe class="embed viewer" style="background:#333"></iframe>
    </div></div>`);
    root.append(wrap);
    const list = wrap.querySelector(".list");
    const viewer = wrap.querySelector(".viewer");

    const load = async () => {
      const docs = await api("/api/docs");
      if (!docs.length) {
        list.innerHTML = `<p class="hint">Brak dokumentów w data/docs/.</p>`;
        return;
      }
      const groups = {};
      docs.forEach((d) => (groups[d.category] ||= []).push(d));
      list.innerHTML = Object.entries(groups).map(([cat, ds]) => `<div class="hint" style="margin-top:8px">${esc(cat)}</div>` +
        ds.map((d) => `<div style="margin:3px 0"><a href="#" data-url="${esc(d.url)}">${esc(d.title)}</a></div>`).join("")).join("");
      if (!viewer.getAttribute("src")) viewer.src = docs[0].url;
    };
    list.addEventListener("click", (e) => {
      const a = e.target.closest("a[data-url]");
      if (a) { e.preventDefault(); viewer.src = a.dataset.url; }
    });
    wrap.querySelector(".refresh").addEventListener("click", async () => { await api("/api/import", { method: "POST" }); load(); });
    load();
  },
};
