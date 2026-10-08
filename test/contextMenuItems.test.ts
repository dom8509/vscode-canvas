import { describe, expect, it } from "vitest";
import type { CanvasEdge, CanvasNode } from "../src/jsonCanvas";
import { type MenuEntry, menuItems } from "../webview/contextMenuItems";

const card = (id: string, more: Partial<CanvasNode> = {}): CanvasNode =>
  ({ id, type: "text", text: "", x: 0, y: 0, width: 10, height: 10, ...more }) as CanvasNode;
const edge = (id: string, more: Partial<CanvasEdge> = {}): CanvasEdge => ({ id, fromNode: "a", toNode: "b", ...more });

const item = (entries: MenuEntry[], action: string) => {
  const found = entries.find((e) => e !== "-" && e.action === action);
  if (!found || found === "-") throw new Error(`No item ${action}`);
  return found;
};
const actions = (entries: MenuEntry[]) => entries.filter((e) => e !== "-").map((e) => (e as { action: string }).action);

describe("menuItems", () => {
  it("offers paste, select all and zoom to fit on the empty canvas", () => {
    expect(actions(menuItems([], true))).toEqual(["paste", "selectAll", "fit", "exportPng", "exportSvg"]);
  });

  it("disables paste when the clipboard is empty", () => {
    expect(item(menuItems([], false), "paste").enabled).toBe(false);
    expect(item(menuItems([card("a")], false), "paste").enabled).toBe(false);
    expect(item(menuItems([card("a")], true), "paste").enabled).toBe(true);
  });

  it("offers every action for a selection, each with its key", () => {
    const entries = menuItems([card("a")], true);
    expect(actions(entries)).toEqual([
      "cut", "copy", "paste", "duplicate", "delete",
      "toFront", "forward", "backward", "toBack",
      "group", "lock", "fitSelection",
      "exportPng", "exportSvg",
    ]);
    for (const e of entries) if (e !== "-" && !e.action.startsWith("export")) expect(e.keys, e.action).not.toBe("");
  });

  it("groups a selection only of two cards or more", () => {
    expect(item(menuItems([card("a")], true), "group").enabled).toBe(false);
    expect(item(menuItems([card("a"), card("b")], true), "group").enabled).toBe(true);
  });

  it("reads Unlock when everything selected is locked", () => {
    expect(item(menuItems([card("a", { locked: true }), edge("e", { locked: true })], true), "lock").label).toBe("Unlock");
    expect(item(menuItems([card("a", { locked: true }), card("b")], true), "lock").label).toBe("Lock");
  });

  it("disables delete, cut and the layer order for a locked selection", () => {
    const entries = menuItems([card("a", { locked: true })], true);
    for (const action of ["delete", "cut", "toFront", "forward", "backward", "toBack"]) {
      expect(item(entries, action).enabled, action).toBe(false);
    }
    expect(item(entries, "copy").enabled).toBe(true);
    expect(item(entries, "lock").enabled).toBe(true);
  });

  it("does not copy or order a selection of connections only", () => {
    const entries = menuItems([edge("e")], true);
    for (const action of ["cut", "copy", "duplicate", "toFront", "group", "fitSelection"]) {
      expect(item(entries, action).enabled, action).toBe(false);
    }
    expect(item(entries, "delete").enabled).toBe(true);
  });

  it("copies a selection of free connections when it holds something to copy", () => {
    const entries = menuItems([edge("e")], true, true);
    for (const action of ["cut", "copy", "duplicate"]) expect(item(entries, action).enabled, action).toBe(true);
    expect(item(menuItems([edge("e", { locked: true })], true, true), "cut").enabled).toBe(false);
  });

  it("always offers both exports, for the selection and for the empty canvas", () => {
    for (const entries of [menuItems([], false), menuItems([card("a", { locked: true })], false), menuItems([edge("e")], false)]) {
      expect(item(entries, "exportPng")).toMatchObject({ label: "Export as PNG", enabled: true });
      expect(item(entries, "exportSvg")).toMatchObject({ label: "Export as SVG", enabled: true });
    }
  });
});
