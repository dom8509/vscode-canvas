// The context menu: opened by a right-click, closed by a pick, a click outside or Escape.

import { escapeHtml } from "./markdown";
import type { MenuEntry } from "./contextMenuItems";

let menu: HTMLElement | null = null;

export function isContextMenuOpen(): boolean {
  return menu !== null;
}

export function closeContextMenu(): void {
  menu?.remove();
  menu = null;
}

/** Opens the menu at a point on the screen, kept inside the window. `onPick` gets the action of the item picked. */
export function openContextMenu(entries: MenuEntry[], x: number, y: number, onPick: (action: string) => void): void {
  closeContextMenu();
  const el = document.createElement("div");
  el.id = "context-menu";
  el.setAttribute("role", "menu");
  el.innerHTML = entries
    .map((e) =>
      e === "-"
        ? '<div class="separator"></div>'
        : `<button role="menuitem" data-pick="${e.action}"${e.enabled ? "" : " disabled"}><span>${escapeHtml(e.label)}</span><kbd>${escapeHtml(e.keys)}</kbd></button>`,
    )
    .join("");
  document.body.append(el);
  menu = el;
  const r = el.getBoundingClientRect();
  el.style.left = `${Math.max(4, Math.min(x, window.innerWidth - r.width - 4))}px`;
  el.style.top = `${Math.max(4, Math.min(y, window.innerHeight - r.height - 4))}px`;
  el.addEventListener("pointerdown", (e) => e.stopPropagation());
  el.addEventListener("contextmenu", (e) => e.preventDefault());
  el.addEventListener("click", (e) => {
    const button = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-pick]");
    if (!button || button.disabled) return;
    closeContextMenu();
    onPick(button.dataset.pick!);
  });
}

// A press anywhere else closes the menu.
document.addEventListener("pointerdown", () => closeContextMenu());
window.addEventListener("blur", () => closeContextMenu());
