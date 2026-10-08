// The shortcut overview: every key of the canvas, opened with "?".

import { keyText, shortcutOverview } from "./shortcuts";
import { escapeHtml } from "./markdown";

export function shortcutPanelHtml(): string {
  const groups = shortcutOverview()
    .map(
      (g) => `<section><h3>${g.title}</h3><dl>${g.shortcuts
        .map((s) => {
          const keys = s.keys.length ? s.keys.map((k) => `<kbd>${escapeHtml(keyText(k))}</kbd>`).join(" ") : `<kbd>${escapeHtml(keyText(s.hint ?? ""))}</kbd>`;
          return `<dt>${escapeHtml(s.label)}</dt><dd>${keys}</dd>`;
        })
        .join("")}</dl></section>`,
    )
    .join("");
  return `<div id="shortcut-panel" hidden><h2>Keys</h2><div class="groups">${groups}</div></div>`;
}

/** Opens the overview, or closes it when it is open. */
export function toggleShortcutPanel(open = undefined as boolean | undefined): void {
  const panel = document.getElementById("shortcut-panel")!;
  panel.hidden = open === undefined ? !panel.hidden : !open;
  document.querySelector('[data-action="help"]')?.classList.toggle("active", !panel.hidden);
}

export function isShortcutPanelOpen(): boolean {
  return !document.getElementById("shortcut-panel")!.hidden;
}
