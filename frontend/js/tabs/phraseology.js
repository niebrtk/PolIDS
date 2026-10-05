import { esc, h } from "../api.js";

// Frazeologia: materiał EUROCONTROL Learning Zone. Serwis odrzuca osadzanie w ramce na innych stronach
// (nagłówki X-Frame-Options / CSP), dlatego zamiast iframe otwieramy go w nowej karcie przeglądarki.
export default {
  mount(root, ctx) {
    const url = ctx.config.links.phraseology;
    root.append(h(`<div class="pane"><div class="card ext-card">
      <h3>Frazeologia · EUROCONTROL Learning Zone</h3>
      <p>Learning Zone nie pozwala wyświetlać swoich stron wewnątrz innych aplikacji, więc ramka kończyła się
        komunikatem „odmowa połączenia”. Materiał otwiera się w osobnej karcie przeglądarki.</p>
      <a class="btn primary big" href="${esc(url)}" target="_blank" rel="noopener">Otwórz frazeologię w nowej karcie ↗</a>
      <p class="hint mono">${esc(url)}</p>
      <p class="hint">Adres można zmienić w pliku .env: VPANDORA_PHRASEOLOGY_URL=…</p>
    </div></div>`));
  },
};
