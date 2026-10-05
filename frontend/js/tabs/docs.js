import { api, esc, h } from "../api.js";

export default {
  mount(root) {
    const wrap = h(`<div class="pane fill"><div class="mapwrap">
      <div class="mapside">
        <h4>DOKUMENTY</h4>
        <div class="list"></div>
        <h4>DODAJ PDF</h4>
        <form class="upload">
          <input type="file" name="file" accept="application/pdf" required><br><br>
          <input class="field" name="title" placeholder="Tytuł (np. ICAO Doc 4444)" style="width:100%"><br><br>
          <input class="field" name="category" placeholder="Kategoria (ICAO, PL vACC, INNE…)" style="width:100%"><br><br>
          <button class="btn primary">Wyślij</button> <span class="hint msg"></span>
        </form>
        <p class="hint">PDF-y możesz też po prostu wrzucić do folderu <span class="mono">data/docs/</span>
        (podfolder = kategoria) i kliknąć „Odśwież”.</p>
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
        list.innerHTML = `<p class="hint">Brak dokumentów. Dodaj np. ICAO Doc 4444 i Doc 9432 (nie są dołączone do repozytorium ze względu na prawa autorskie).</p>`;
        return;
      }
      const groups = {};
      docs.forEach((d) => (groups[d.category] ||= []).push(d));
      list.innerHTML = Object.entries(groups).map(([cat, ds]) => `<div class="hint" style="margin-top:8px">${esc(cat)}</div>` +
        ds.map((d) => `<div style="display:flex;gap:6px;align-items:center;margin:3px 0">
          <a href="#" data-url="${esc(d.url)}" style="flex:1">${esc(d.title)}</a>
          <button class="btn" data-del="${d.id}" title="Usuń" style="padding:0 6px">✕</button></div>`).join("")).join("");
      if (!viewer.getAttribute("src")) viewer.src = docs[0].url;
    };
    list.addEventListener("click", async (e) => {
      const a = e.target.closest("a[data-url]");
      if (a) { e.preventDefault(); viewer.src = a.dataset.url; return; }
      const del = e.target.closest("button[data-del]");
      if (del && confirm("Usunąć dokument i plik PDF?")) { await api(`/api/docs/${del.dataset.del}`, { method: "DELETE" }); load(); }
    });
    wrap.querySelector(".upload").addEventListener("submit", async (e) => {
      e.preventDefault();
      const msg = wrap.querySelector(".msg");
      try {
        await api("/api/docs", { method: "POST", body: new FormData(e.target) });
        e.target.reset(); msg.textContent = "Dodano"; load();
      } catch (err) { msg.textContent = err.message; }
    });
    wrap.querySelector(".refresh").addEventListener("click", async () => { await api("/api/import", { method: "POST" }); load(); });
    load();
  },
};
