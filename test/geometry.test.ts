import { describe, expect, it } from "vitest";
import { anchor, autoSides, boundsOf, containsRect, edgeCurve, fitView, gridAround, sideFacing, zoomAt } from "../webview/geometry";

const r = { x: 0, y: 0, width: 200, height: 100 };

describe("geometry", () => {
  it("finds side anchors", () => {
    expect(anchor(r, "top")).toEqual({ x: 100, y: 0 });
    expect(anchor(r, "right")).toEqual({ x: 200, y: 50 });
    expect(anchor(r, "bottom")).toEqual({ x: 100, y: 100 });
    expect(anchor(r, "left")).toEqual({ x: 0, y: 50 });
  });

  it("picks the side facing a point", () => {
    expect(sideFacing(r, { x: 500, y: 60 })).toBe("right");
    expect(sideFacing(r, { x: -500, y: 60 })).toBe("left");
    expect(sideFacing(r, { x: 150, y: -100 })).toBe("top");
    expect(sideFacing(r, { x: 150, y: 300 })).toBe("bottom");
  });

  it("joins nodes by the sides that face each other", () => {
    expect(autoSides(r, { x: 400, y: 0, width: 100, height: 100 })).toEqual(["right", "left"]);
    expect(autoSides(r, { x: 0, y: 400, width: 200, height: 100 })).toEqual(["bottom", "top"]);
  });

  it("bends a curve out of its sides", () => {
    const c = edgeCurve({ x: 0, y: 0 }, "right", { x: 200, y: 0 }, "left");
    expect(c.d).toBe("M 0 0 C 100 0, 100 0, 200 0");
    expect(c.mid).toEqual({ x: 100, y: 0 });
    expect(c.endDir).toEqual({ x: 1, y: 0 });
  });

  it("fits content, never past 100 %", () => {
    const small = fitView({ x: 0, y: 0, width: 100, height: 100 }, 1000, 800);
    expect(small.zoom).toBe(1);
    expect(small.x).toBe(450);
    const big = fitView({ x: 0, y: 0, width: 4000, height: 1000 }, 1000, 800, 0);
    expect(big.zoom).toBe(0.25);
  });

  it("zooms around a point", () => {
    const v = zoomAt({ x: 0, y: 0, zoom: 1 }, 2, { x: 100, y: 100 });
    expect(v).toEqual({ x: -100, y: -100, zoom: 2 });
  });

  it("measures bounds and containment", () => {
    expect(boundsOf([])).toBeUndefined();
    expect(boundsOf([r, { x: 300, y: -50, width: 10, height: 10 }])).toEqual({ x: 0, y: -50, width: 310, height: 150 });
    expect(containsRect(r, { x: 10, y: 10, width: 50, height: 50 })).toBe(true);
    expect(containsRect(r, { x: 190, y: 10, width: 50, height: 50 })).toBe(false);
  });

  it("lays dropped cards out in a grid around the drop point", () => {
    const card = { width: 100, height: 50 };
    expect(gridAround({ x: 0, y: 0 }, [card], 20)).toEqual([{ x: -50, y: -25 }]);
    expect(gridAround({ x: 0, y: 0 }, [card, card, card], 20)).toEqual([
      { x: -110, y: -60 },
      { x: 10, y: -60 },
      { x: -110, y: 10 },
    ]);
    expect(gridAround({ x: 0, y: 0 }, [], 20)).toEqual([]);
  });
});
