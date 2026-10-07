import { describe, expect, it } from "vitest";
import { type CanvasEdge, edgeStyle, setEdgeStyle } from "../src/jsonCanvas";
import { edgePath, elbowPoints, headSvg, pointAlong } from "../webview/geometry";

const plain = (): CanvasEdge => ({ id: "e", fromNode: "a", toNode: "b" });

describe("edgeStyle", () => {
  it("reads a plain edge as Obsidian draws it", () => {
    expect(edgeStyle(plain())).toEqual({
      fromHead: "none",
      toHead: "arrow",
      lineStyle: "solid",
      lineWidth: "normal",
      pathStyle: "curved",
    });
  });

  it("ignores unknown values", () => {
    expect(edgeStyle({ ...plain(), lineStyle: "wavy", toHead: "star" })).toMatchObject({
      lineStyle: "solid",
      toHead: "arrow",
    });
  });
});

describe("setEdgeStyle", () => {
  it("keeps the JSON Canvas ends right and stores the rest as extras", () => {
    const e = plain();
    setEdgeStyle(e, { fromHead: "dot", toHead: "none", lineStyle: "dashed", pathStyle: "elbow" });
    expect(e).toMatchObject({ fromEnd: "arrow", fromHead: "dot", toEnd: "none", lineStyle: "dashed", pathStyle: "elbow" });
    expect(e.toHead).toBeUndefined();
    expect(edgeStyle(e)).toMatchObject({ fromHead: "dot", toHead: "none", lineStyle: "dashed", pathStyle: "elbow" });
  });

  it("leaves defaults out of the file", () => {
    const e = plain();
    setEdgeStyle(e, { fromHead: "diamond", lineWidth: "bold" });
    setEdgeStyle(e, { fromHead: "none", toHead: "arrow", lineWidth: "normal", lineStyle: "solid", pathStyle: "curved" });
    expect(e).toEqual(plain());
  });
});

describe("edge paths", () => {
  it("draws a straight line", () => {
    const p = edgePath({ x: 0, y: 0 }, "right", { x: 100, y: 0 }, "left", "straight");
    expect(p.d).toBe("M 0 0 L 100 0");
    expect(p.mid).toEqual({ x: 50, y: 0 });
    expect(p.endDir).toEqual({ x: 1, y: 0 });
  });

  it("goes round corners at right angles", () => {
    const pts = elbowPoints({ x: 0, y: 0 }, "right", { x: 200, y: 100 }, "left");
    expect(pts).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 200, y: 100 },
    ]);
    for (let i = 1; i < pts.length; i++) {
      expect(pts[i]!.x === pts[i - 1]!.x || pts[i]!.y === pts[i - 1]!.y).toBe(true);
    }
  });

  it("finds the point halfway along a polyline", () => {
    expect(pointAlong([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }], 0.5)).toEqual({ x: 10, y: 0 });
  });

  it("draws every head shape, and nothing for none", () => {
    expect(headSvg("none", { x: 0, y: 0 }, { x: 1, y: 0 }, 10)).toBe("");
    for (const shape of ["arrow", "open", "dot", "bar", "diamond"] as const) {
      expect(headSvg(shape, { x: 0, y: 0 }, { x: 1, y: 0 }, 10)).toMatch(/^<(polygon|polyline|circle) /);
    }
  });
});
