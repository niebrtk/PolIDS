import { api, esc, h, subtabs } from "../api.js";

export default {
  mount(root) {
    const holder = h(`<div class="pane"><p class="hint">Ładowanie…</p></div>`);
    root.append(holder);
    api("/api/emergency").then((data) => {
      holder.remove();
      subtabs(root, data.procedures.map((p) => ({
        id: p.id, label: p.id, render: (pane) => {
          pane.classList.add("emergency");
          pane.innerHTML = `<h2>${esc(p.title)}</h2>` + p.sections.map((s) =>
            `<h3>${esc(s.title)}</h3><ul>${s.items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`).join("") +
            `<p class="hint" style="margin-top:20px">Procedury edytujesz w data/seed/emergency.json.</p>`;
        },
      })));
    }).catch((e) => { holder.innerHTML = `<p class="error">${esc(e.message)}</p>`; });
  },
};
