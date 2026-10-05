import { api, esc, h, iframeWithFallback } from "../api.js";

// Frazeologia: "Say Again? The Phraseology Database" z EUROCONTROL Learning Zone. Najpierw backend sprawdza,
// czy serwis pozwala osadzić się w ramce (nagłówki X-Frame-Options / CSP). Jeśli tak, pokazujemy ramkę;
// jeśli nie albo nie da się tego sprawdzić, zostaje przycisk otwierający frazeologię w nowej karcie.
const card = (url, why) => `<div class="pane"><div class="card ext-card">
  <h3>Frazeologia · EUROCONTROL Learning Zone</h3>
  <p>${esc(why)} Materiał otwiera się w osobnej karcie przeglądarki.</p>
  <a class="btn primary big" href="${esc(url)}" target="_blank" rel="noopener">Otwórz frazeologię w nowej karcie ↗</a>
  <p class="hint mono">${esc(url)}</p>
  <p class="hint">Adres można zmienić w pliku .env: VPANDORA_PHRASEOLOGY_URL=…</p>
</div></div>`;

export default {
  mount(root, ctx) {
    const url = ctx.config.links.phraseology;
    const holder = h(`<div class="pane"><p class="hint">Sprawdzam, czy Learning Zone pozwala wyświetlić się w ramce…</p></div>`);
    root.append(holder);
    api("/api/embed-check/phraseology").then((r) => {
      holder.remove();
      if (r.embeddable && !r.reason) {
        const pane = h(`<div class="pane fill"></div>`);
        root.append(pane);
        iframeWithFallback(pane, url, "EUROCONTROL Learning Zone");
      } else {
        const why = r.embeddable === false ? `Learning Zone nie pozwala wyświetlać się wewnątrz innych aplikacji (${r.reason}).`
          : r.reason ? `Nie da się pokazać ramki: ${r.reason}.` : "";
        root.append(h(card(url, why)));
      }
    }).catch((e) => { holder.remove(); root.append(h(card(url, `Nie udało się sprawdzić strony (${e.message}).`))); });
  },
};
