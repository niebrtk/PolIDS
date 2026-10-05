import { iframeWithFallback, subtabs } from "../api.js";

const NOTE = "Jeśli strona się nie wyświetla, blokuje osadzanie – użyj przycisku obok.";

export default {
  mount(root, ctx) {
    const l = ctx.config.links;
    subtabs(root, [
      { id: "civ", label: "AD CIV (IFR)", fill: true, render: (p) => iframeWithFallback(p, l.aip_ifr, NOTE) },
      { id: "vfr", label: "AD VFR", fill: true, render: (p) => iframeWithFallback(p, l.aip_vfr, NOTE) },
      { id: "mil", label: "AD MIL", fill: true, render: (p) => iframeWithFallback(p, l.aip_mil, NOTE) },
    ]);
  },
};
