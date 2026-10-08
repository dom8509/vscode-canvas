import { describe, expect, it } from "vitest";
import { SHORTCUTS, keyText, matchesShortcut, shortcut, shortcutOverview } from "../webview/shortcuts";
import { TOOLBAR_BUTTONS } from "../webview/toolbar";

const press = (key: string, more: Partial<KeyboardEvent> = {}) =>
  ({ key, code: "", ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...more }) as KeyboardEvent;

describe("shortcuts", () => {
  it("uses no key twice", () => {
    const keys = SHORTCUTS.flatMap((s) => s.keys.map((k) => k.toLowerCase()));
    expect(keys.filter((k, i) => keys.indexOf(k) !== i)).toEqual([]);
  });

  it("has a key for every tool and add button in the bottom toolbar", () => {
    for (const id of ["select", "hand", "text", "rectangle", "ellipse", "arrow", "line", "card", "group"]) {
      expect(shortcut(id).keys.length, id).toBeGreaterThan(0);
    }
    const named = TOOLBAR_BUTTONS.flatMap((b) => b.shortcuts);
    for (const s of SHORTCUTS.filter((s) => s.group === "tools")) expect(named, s.id).toContain(s.id);
    for (const id of named) expect(() => shortcut(id)).not.toThrow();
  });

  it("reads Ctrl on Windows and Linux and ⌘ on macOS", () => {
    expect(keyText("Mod+Shift+Z", false)).toBe("Ctrl+Shift+Z");
    expect(keyText("Mod+Shift+Z", true)).toBe("⌘⇧Z");
    expect(keyText("V", true)).toBe("V");
  });

  it("matches a tool key only without modifiers", () => {
    expect(matchesShortcut("select", press("v"))).toBe(true);
    expect(matchesShortcut("select", press("V", { shiftKey: true }))).toBe(false);
    expect(matchesShortcut("select", press("v", { ctrlKey: true }))).toBe(false);
    expect(matchesShortcut("select", press("v", { altKey: true }))).toBe(false);
  });

  it("matches Ctrl or ⌘ for Mod", () => {
    expect(matchesShortcut("duplicate", press("d", { ctrlKey: true }))).toBe(true);
    expect(matchesShortcut("duplicate", press("d", { metaKey: true }))).toBe(true);
    expect(matchesShortcut("duplicate", press("d"))).toBe(false);
  });

  it("matches by the typed key or by the physical key, so other layouts work", () => {
    expect(matchesShortcut("fit", press("!", { shiftKey: true, code: "Digit1" }))).toBe(true);
    expect(matchesShortcut("help", press("?", { shiftKey: true, code: "Minus" }))).toBe(true);
    // Ctrl+Shift+] types "}" on a US layout; on a German one, AltGr+9 types "]" and reads as Ctrl+Alt.
    expect(matchesShortcut("toFront", press("}", { ctrlKey: true, shiftKey: true, code: "BracketRight" }))).toBe(true);
    expect(matchesShortcut("forward", press("]", { ctrlKey: true, altKey: true, code: "Digit9" }))).toBe(true);
    expect(matchesShortcut("forward", press("*", { ctrlKey: true, code: "BracketRight" }))).toBe(true);
    // On a German layout "+" sits where "]" is on a US one: Ctrl++ zooms in, it does not bring forward.
    expect(matchesShortcut("zoomIn", press("+", { ctrlKey: true, code: "BracketRight" }))).toBe(true);
    expect(matchesShortcut("forward", press("+", { ctrlKey: true, code: "BracketRight" }))).toBe(false);
    expect(matchesShortcut("forward", press("}", { ctrlKey: true, shiftKey: true, code: "BracketRight" }))).toBe(false);
  });
});

describe("shortcutOverview", () => {
  it("lists every key under tools, editing, view or navigation", () => {
    const overview = shortcutOverview();
    expect(overview.map((g) => g.title)).toEqual(["Tools", "Editing", "View", "Navigation"]);
    expect(overview.flatMap((g) => g.shortcuts).length).toBe(SHORTCUTS.length);
    for (const g of overview) expect(g.shortcuts.length, g.title).toBeGreaterThan(0);
  });
});
