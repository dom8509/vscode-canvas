// What the context menu offers for a selection, and which items apply to it.

import { type CanvasEdge, type CanvasNode, isLocked } from "../src/jsonCanvas";
import { SHORTCUTS, shortcutText } from "./shortcuts";

export interface MenuItem {
  /** The shortcut id of the action, which is also its name in the menu's handler. */
  action: string;
  label: string;
  /** The key, as a person reads it. */
  keys: string;
  enabled: boolean;
}

/** An item, or "-" for a line between groups of items. */
export type MenuEntry = MenuItem | "-";

const entry = (action: string, label: string, enabled: boolean): MenuItem => ({
  action,
  label,
  keys: SHORTCUTS.some((s) => s.id === action) ? shortcutText(action) : "",
  enabled,
});

/** The two exports, at the end of both menus: of the selection, or of the whole canvas. */
const EXPORTS: MenuEntry[] = ["-", entry("exportPng", "Export as PNG", true), entry("exportSvg", "Export as SVG", true)];

/**
 * The menu for the selected elements, or for the empty canvas when nothing is selected. `canCopy`: the
 * selection holds something to copy, as cards do and connections with free ends.
 */
export function menuItems(selected: (CanvasNode | CanvasEdge)[], canPaste: boolean, canCopy?: boolean): MenuEntry[] {
  if (selected.length === 0) {
    return [entry("paste", "Paste", canPaste), entry("selectAll", "Select all", true), entry("fit", "Zoom to fit", true), ...EXPORTS];
  }
  const cards = selected.filter((s): s is CanvasNode => "type" in s);
  const free = selected.filter((s) => !isLocked(s));
  const freeCards = cards.filter((c) => !isLocked(c));
  const allLocked = free.length === 0;
  const copyable = canCopy ?? cards.length > 0;
  return [
    entry("cut", "Cut", copyable && free.length > 0),
    entry("copy", "Copy", copyable),
    entry("paste", "Paste", canPaste),
    entry("duplicate", "Duplicate", copyable),
    entry("delete", "Delete", free.length > 0),
    "-",
    entry("toFront", "Bring to front", freeCards.length > 0),
    entry("forward", "Bring forward", freeCards.length > 0),
    entry("backward", "Send backward", freeCards.length > 0),
    entry("toBack", "Send to back", freeCards.length > 0),
    "-",
    entry("group", "Group selection", cards.length > 1),
    entry("lock", allLocked ? "Unlock" : "Lock", true),
    "-",
    entry("fitSelection", "Zoom to selection", cards.length > 0),
    ...EXPORTS,
  ];
}
