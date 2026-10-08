// Every key of the canvas, in one table. The tooltips, the hints on the
// toolbar buttons, the context menu and the shortcut overview all read it.

export type ShortcutGroup = "tools" | "editing" | "view" | "navigation";

export interface Shortcut {
  id: string;
  label: string;
  group: ShortcutGroup;
  /** Keys as "Mod+Shift+Z": Mod is Ctrl, or ⌘ on macOS. The first one is shown. */
  keys: string[];
  /** For what is not a key press, such as "Scroll". Shown instead of the keys. */
  hint?: string;
}

export const SHORTCUT_GROUPS: { group: ShortcutGroup; title: string }[] = [
  { group: "tools", title: "Tools" },
  { group: "editing", title: "Editing" },
  { group: "view", title: "View" },
  { group: "navigation", title: "Navigation" },
];

export const SHORTCUTS: Shortcut[] = [
  { id: "select", label: "Select", group: "tools", keys: ["V"] },
  { id: "hand", label: "Hand: drag to pan", group: "tools", keys: ["H"] },
  { id: "text", label: "Text", group: "tools", keys: ["T"] },
  { id: "rectangle", label: "Rectangle", group: "tools", keys: ["R"] },
  { id: "ellipse", label: "Ellipse", group: "tools", keys: ["O"] },
  { id: "card", label: "Add card", group: "tools", keys: ["N"] },
  { id: "group", label: "Add group", group: "tools", keys: ["G"] },

  { id: "edit", label: "Edit the selected card", group: "editing", keys: ["Enter"] },
  { id: "delete", label: "Delete", group: "editing", keys: ["Delete", "Backspace"] },
  { id: "cut", label: "Cut", group: "editing", keys: ["Mod+X"] },
  { id: "copy", label: "Copy", group: "editing", keys: ["Mod+C"] },
  { id: "paste", label: "Paste", group: "editing", keys: ["Mod+V"] },
  { id: "duplicate", label: "Duplicate", group: "editing", keys: ["Mod+D"] },
  { id: "selectAll", label: "Select all", group: "editing", keys: ["Mod+A"] },
  { id: "nudge", label: "Nudge (Shift: further)", group: "editing", keys: [], hint: "Arrow keys" },
  { id: "undo", label: "Undo", group: "editing", keys: ["Mod+Z"] },
  { id: "redo", label: "Redo", group: "editing", keys: ["Mod+Shift+Z"] },

  { id: "zoomIn", label: "Zoom in", group: "view", keys: ["Mod+="] },
  { id: "zoomOut", label: "Zoom out", group: "view", keys: ["Mod+-"] },
  { id: "zoomReset", label: "Zoom to 100%", group: "view", keys: ["Mod+0"] },
  { id: "fit", label: "Zoom to fit", group: "view", keys: ["Shift+1"] },
  { id: "fitSelection", label: "Zoom to selection", group: "view", keys: ["Shift+2"] },
  { id: "help", label: "Show the keys", group: "view", keys: ["?"] },

  { id: "escape", label: "Close a menu, back to select, clear the selection", group: "navigation", keys: ["Escape"] },
  { id: "scroll", label: "Pan (Shift: sideways)", group: "navigation", keys: [], hint: "Scroll" },
  { id: "pan", label: "Pan", group: "navigation", keys: [], hint: "Space+drag" },
  { id: "pinch", label: "Zoom", group: "navigation", keys: [], hint: "Mod+scroll" },
];

export function shortcut(id: string): Shortcut {
  const s = SHORTCUTS.find((s) => s.id === id);
  if (!s) throw new Error(`No shortcut "${id}".`);
  return s;
}

export const IS_MAC = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

const MAC_NAMES: Record<string, string> = { Mod: "⌘", Shift: "⇧", Alt: "⌥" };
const KEY_NAMES: Record<string, string> = { Escape: "Esc", Delete: "Del" };

/** "Mod+Shift+Z" as a person reads it: "Ctrl+Shift+Z", or "⌘⇧Z" on macOS. */
export function keyText(keys: string, mac = IS_MAC): string {
  const parts = keys.split(/\+(?!$)/).map((p) => KEY_NAMES[p] ?? p);
  if (mac) return parts.map((p) => MAC_NAMES[p] ?? p).join("");
  return parts.map((p) => (p === "Mod" ? "Ctrl" : p)).join("+");
}

/** The first key of a shortcut, or its hint, as a person reads it. */
export function shortcutText(id: string, mac = IS_MAC): string {
  const s = shortcut(id);
  return s.keys[0] ? keyText(s.keys[0], mac) : keyText(s.hint ?? "", mac);
}

/** "Label (key)", for a tooltip. */
export function tooltip(id: string, label = shortcut(id).label): string {
  return `${label} (${shortcutText(id)})`;
}

/** The physical key (`KeyboardEvent.code`) on a US layout, for keys other layouts type differently. */
function codeOf(key: string): string | undefined {
  if (/^[A-Z]$/.test(key)) return `Key${key}`;
  if (/^[0-9]$/.test(key)) return `Digit${key}`;
  return { "[": "BracketLeft", "]": "BracketRight", "=": "Equal", "-": "Minus" }[key];
}

/** Whether a key press is `keys`. */
function matchesKeys(keys: string, e: KeyboardEvent): boolean {
  const parts = keys.split(/\+(?!$)/);
  const key = parts.pop()!;
  const mod = parts.includes("Mod");
  const shift = parts.includes("Shift");
  if ((e.ctrlKey || e.metaKey) !== mod) return false;
  const byKey = e.key.toLowerCase() === key.toLowerCase() || (key === "=" && e.key === "+");
  // "?" is typed with Shift on most layouts, and so are some other signs.
  if (key === "?") return byKey && !e.altKey;
  if (e.shiftKey !== shift) return false;
  // Letters and digits never take Alt; a sign may, when AltGr types it (Ctrl+Alt on Windows).
  if (byKey) return !e.altKey || !/^[a-z0-9]$/i.test(key);
  return !e.altKey && e.code !== "" && e.code === codeOf(key);
}

/** Whether a key press is one of the keys of the shortcut `id`. */
export function matchesShortcut(id: string, e: KeyboardEvent): boolean {
  return shortcut(id).keys.some((k) => matchesKeys(k, e));
}

/** The shortcuts in their groups, in the order the shortcut overview shows them. */
export function shortcutOverview(): { title: string; shortcuts: Shortcut[] }[] {
  return SHORTCUT_GROUPS.map(({ group, title }) => ({ title, shortcuts: SHORTCUTS.filter((s) => s.group === group) }));
}
