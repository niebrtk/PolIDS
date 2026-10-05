import { h, iframeWithFallback } from "../api.js";

// Frazeologia: materiał EUROCONTROL Learning Zone w ramce. Jeśli strona nie pozwoli się osadzić
// (albo wymaga zalogowania), zostaje przycisk otwarcia w nowej karcie.
export default {
  mount(root, ctx) {
    const pane = h(`<div class="pane fill"></div>`);
    root.append(pane);
    iframeWithFallback(pane, ctx.config.links.phraseology, "EUROCONTROL Learning Zone");
  },
};
