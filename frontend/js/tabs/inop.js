import { h, iframeWithFallback } from "../api.js";

export default {
  mount(root, ctx) {
    const pane = h(`<div class="pane fill"></div>`);
    root.append(pane);
    iframeWithFallback(pane, ctx.config.links.inop, "Strona PL vACC (INOP / ograniczenia)");
  },
};
