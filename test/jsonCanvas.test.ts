import { describe, expect, it } from "vitest";
import { cssColor, isImagePath, isLocked, newId, parseCanvas, serializeCanvas, setLocked } from "../src/jsonCanvas";

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
