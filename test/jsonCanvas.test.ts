import { describe, expect, it } from "vitest";
import {
  type CanvasData,
  cssColor,
  isImagePath,
  isLocked,
  isPoint,
  newId,
  nodeLook,
  parseCanvas,
  pointNodeAt,
  prunePoints,
  serializeCanvas,
  setLocked,
  setNodeLook,
} from "../src/jsonCanvas";

describe("parseCanvas", () => {
  it("reads an empty file as an empty canvas", () => {
    expect(parseCanvas("")).toEqual({ nodes: [], edges: [] });
    expect(parseCanvas("  \n")).toEqual({ nodes: [], edges: [] });
  });

  it("throws on text that is not JSON", () => {
    expect(() => parseCanvas("{nodes:")).toThrow();
    expect(() => parseCanvas("[]")).toThrow(/object/);
  });

  it("keeps all four node types and unknown properties", () => {
    const text = JSON.stringify({
      nodes: [
        { id: "a", type: "text", text: "Hi", x: 0, y: 0, width: 100, height: 50, extra: 1 },
        { id: "b", type: "file", file: "a.md", x: 1, y: 2, width: 3, height: 4 },
        { id: "c", type: "link", url: "https://x.y", x: 0, y: 0, width: 1, height: 1 },
        { id: "d", type: "group", label: "G", x: 0, y: 0, width: 1, height: 1 },
      ],
      edges: [],
      meta: { v: 1 },
    });
    const data = parseCanvas(text);
    expect(data.nodes.map((n) => n.type)).toEqual(["text", "file", "link", "group"]);
    expect(data.nodes[0]!.extra).toBe(1);
    expect(data.meta).toEqual({ v: 1 });
  });

  it("drops broken nodes and edges that point nowhere", () => {
    const data = parseCanvas(
      JSON.stringify({
        nodes: [
          { id: "a", type: "text", text: "x", x: 0, y: 0, width: 10, height: 10 },
          { id: "a", type: "text", text: "dup", x: 0, y: 0, width: 10, height: 10 },
          { type: "text" },
          { id: "z", type: "unknown" },
        ],
        edges: [
          { id: "e1", fromNode: "a", toNode: "a" },
          { id: "e2", fromNode: "a", toNode: "missing" },
          { id: "e3", fromNode: "a", toNode: "a", fromSide: "middle" },
        ],
      }),
    );
    expect(data.nodes.map((n) => n.id)).toEqual(["a"]);
    expect(data.edges.map((e) => e.id)).toEqual(["e1", "e3"]);
    expect(data.edges[1]!.fromSide).toBeUndefined();
  });

  it("repairs missing numbers and text", () => {
    const data = parseCanvas('{"nodes":[{"id":"a","type":"text","x":"5"}]}');
    expect(data.nodes[0]).toMatchObject({ x: 5, y: 0, width: 250, height: 60, text: "" });
    expect(data.edges).toEqual([]);
  });
});

describe("serializeCanvas", () => {
  it("writes tab-indented JSON that reads back the same", () => {
    const data = parseCanvas('{"nodes":[{"id":"a","type":"text","text":"x","x":0,"y":0,"width":1,"height":1}],"edges":[]}');
    const text = serializeCanvas(data);
    expect(text).toContain('\n\t"nodes"');
    expect(parseCanvas(text)).toEqual(data);
  });
});

describe("helpers", () => {
  it("makes 16-digit hex ids", () => {
    expect(newId()).toMatch(/^[0-9a-f]{16}$/);
  });

  it("maps colors", () => {
    expect(cssColor("1")).toBe("#fb464c");
    expect(cssColor("#abc")).toBe("#abc");
    expect(cssColor("red; x")).toBeUndefined();
    expect(cssColor(undefined)).toBeUndefined();
  });

  it("knows images", () => {
    expect(isImagePath("a/b.PNG")).toBe(true);
    expect(isImagePath("a/b.md")).toBe(false);
  });
});

describe("lock", () => {
  it("is saved as locked: true and left out of the file when off", () => {
    const node = { id: "a", type: "text" as const, text: "", x: 0, y: 0, width: 1, height: 1 };
    expect(isLocked(node)).toBe(false);
    setLocked(node, true);
    expect(node).toHaveProperty("locked", true);
    expect(isLocked(node)).toBe(true);
    setLocked(node, false);
    expect(node).not.toHaveProperty("locked");
  });

  it("survives a round trip, on cards and connections", () => {
    const text = serializeCanvas({
      nodes: [
        { id: "a", type: "text", text: "", x: 0, y: 0, width: 1, height: 1, locked: true },
        { id: "b", type: "text", text: "", x: 0, y: 0, width: 1, height: 1 },
      ],
      edges: [{ id: "e", fromNode: "a", toNode: "b", locked: true }],
    });
    const data = parseCanvas(text);
    expect(isLocked(data.nodes[0]!)).toBe(true);
    expect(isLocked(data.nodes[1]!)).toBe(false);
    expect(isLocked(data.edges[0]!)).toBe(true);
    expect(serializeCanvas(data)).toBe(text);
  });

  it("counts only true as locked", () => {
    expect(isLocked({ id: "e", fromNode: "a", toNode: "b", locked: "yes" })).toBe(false);
  });
});

describe("points", () => {
  const card = { id: "c", type: "text" as const, text: "Hi", x: 0, y: 0, width: 100, height: 50 };

  it("makes a 1×1 empty text node centered on the free end", () => {
    const p = pointNodeAt({ x: 100, y: 40 });
    expect(p).toMatchObject({ type: "text", text: "", shape: "point", x: 99.5, y: 39.5, width: 1, height: 1 });
    expect(p.id).toMatch(/^[0-9a-f]{16}$/);
    expect(isPoint(p)).toBe(true);
    expect(isPoint(card)).toBe(false);
  });

  it("removes a point no connection names, and keeps the others", () => {
    const a = pointNodeAt({ x: 0, y: 0 });
    const b = pointNodeAt({ x: 9, y: 9 });
    const orphan = pointNodeAt({ x: 5, y: 5 });
    const data: CanvasData = {
      nodes: [card, a, b, orphan],
      edges: [
        { id: "e1", fromNode: "c", toNode: a.id },
        { id: "e2", fromNode: b.id, toNode: "c", locked: true },
      ],
    };
    prunePoints(data);
    expect(data.nodes.map((n) => n.id)).toEqual(["c", a.id, b.id]);
  });

  it("keeps a point without a connection when a canvas is read and written", () => {
    const orphan = pointNodeAt({ x: 5, y: 5 });
    const text = serializeCanvas({ nodes: [card, orphan], edges: [] });
    expect(serializeCanvas(parseCanvas(text))).toBe(text);
  });

  it("keeps a connection to a point through a round trip", () => {
    const a = pointNodeAt({ x: 300, y: 25 });
    const text = serializeCanvas({ nodes: [card, a], edges: [{ id: "e", fromNode: "c", fromSide: "right", toNode: a.id }] });
    const data = parseCanvas(text);
    expect(data.edges).toHaveLength(1);
    expect(serializeCanvas(data)).toBe(text);
  });

  it("is not a card whose look can be set", () => {
    const p = pointNodeAt({ x: 0, y: 0 });
    expect(nodeLook(p).shape).toBe("point");
    const before = { ...p };
    setNodeLook(p, { shape: "rectangle", fontSize: "l", strokeWidth: "bold" });
    expect(p).toEqual(before);
  });
});
