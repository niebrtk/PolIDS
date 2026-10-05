import { esc, h } from "../api.js";

// Strona INOP z om.plvacc.pl w ramce. Jej dużą czerwoną stopkę chowamy, wydłużając ramkę poniżej
// widocznego obszaru (do treści innej domeny nie mamy dostępu). Wysokość da się dopasować na pasku.
export default {
  mount(root, ctx) {
    const url = ctx.config.links.inop;
    let px = Number(localStorage.getItem("inop.footer") ?? ctx.config.inop_hide_footer_px ?? 150);
    const pane = h(`<div class="pane fill">
      <div class="toolbar" style="padding:6px 10px;margin:0;background:var(--panel)">
        <span class="hint mono">${esc(url)}</span><span style="flex:1"></span>
        <label class="hint">ukryj stopkę: <input type="number" class="px" min="0" max="600" step="10" value="${px}" style="width:70px"> px</label>
        <a class="btn" href="${esc(url)}" target="_blank" rel="noopener">Otwórz w nowej karcie ↗</a>
      </div>
      <div class="clip"><iframe class="embed" src="${esc(url)}" referrerpolicy="no-referrer"></iframe></div>
    </div>`);
    root.append(pane);
    const frame = pane.querySelector("iframe");
    const apply = () => { frame.style.height = `calc(100% + ${px}px)`; };
    pane.querySelector(".px").addEventListener("change", (e) => {
      px = Math.max(0, Number(e.target.value) || 0);
      localStorage.setItem("inop.footer", px);
      apply();
    });
    apply();
  },
};
