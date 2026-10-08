import { describe, expect, it } from "vitest";
import { anchor, autoSides, bentPath, boundsOf, containsRect, edgeCurve, edgePath, fitView, gridAround, sideFacing, snapAngle, turnedBounds, zoomAt } from "../webview/geometry";

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

describe("turnedBounds", () => {
  it("is the rect itself when not turned", () => {
    expect(turnedBounds({ x: 10, y: 20, width: 40, height: 20 }, 0)).toEqual({ x: 10, y: 20, width: 40, height: 20 });
  });

  it("is the box around the turned outline", () => {
    const b = turnedBounds({ x: 0, y: 0, width: 40, height: 20 }, 90);
    expect(b.x).toBeCloseTo(10);
    expect(b.y).toBeCloseTo(-10);
    expect(b.width).toBeCloseTo(20);
    expect(b.height).toBeCloseTo(40);
    const d = turnedBounds({ x: 0, y: 0, width: 10, height: 10 }, 45);
    expect(d.width).toBeCloseTo(Math.SQRT2 * 10);
  });
});

describe("snapAngle", () => {
  const from = { x: 0, y: 0 };
  const angle = (p: { x: number; y: number }) => (Math.atan2(p.y, p.x) * 180) / Math.PI;

  it("snaps to 15° steps and keeps the length", () => {
    const flat = snapAngle(from, { x: 100, y: 5 }, 15);
    expect(angle(flat)).toBeCloseTo(0);
    expect(Math.hypot(flat.x, flat.y)).toBeCloseTo(Math.hypot(100, 5));
    expect(angle(snapAngle(from, { x: 100, y: 28 }, 15))).toBeCloseTo(15);
    const down = snapAngle({ x: 10, y: 10 }, { x: 13, y: 200 }, 15);
    expect(down.x).toBeCloseTo(10);
    expect(down.y).toBeCloseTo(10 + Math.hypot(3, 190));
  });
});

describe("free ends", () => {
  it("draws a curve from a free start straight towards a card's side", () => {
    const c = edgePath({ x: 0, y: 0 }, null, { x: 200, y: 0 }, "left", "curved");
    expect(c.start).toEqual({ x: 0, y: 0 });
    expect(c.endDir).toEqual({ x: 1, y: 0 });
    expect(c.startDir.x).toBeCloseTo(-1);
  });

  it("points the heads along the line when both ends are free", () => {
    for (const style of ["curved", "straight", "elbow"] as const) {
      const c = edgePath({ x: 0, y: 0 }, null, { x: 0, y: 100 }, null, style);
      expect(c.endDir.y, style).toBeCloseTo(1);
      expect(c.startDir.y, style).toBeCloseTo(-1);
    }
  });
});

describe("bentPath", () => {
  const points = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }];

  it("curves through every point", () => {
    const c = bentPath(points, "curved");
    expect(c.d.startsWith("M 0 0 C")).toBe(true);
    for (const p of points) expect(c.d).toContain(`${p.x} ${p.y}`);
    expect(c.d.match(/C/g)).toHaveLength(2);
  });

  it("joins the points with straight segments for straight and elbow", () => {
    expect(bentPath(points, "straight").d).toBe("M 0 0 L 100 0 L 100 100");
    expect(bentPath(points, "elbow").d).toBe("M 0 0 L 100 0 L 100 100");
  });

  it("points the heads along the first and last segment", () => {
    for (const style of ["curved", "straight"] as const) {
      const c = bentPath(points, style);
      expect(c.start).toEqual({ x: 0, y: 0 });
      expect(c.end).toEqual({ x: 100, y: 100 });
      expect(c.endDir.x, style).toBeCloseTo(0);
      expect(c.endDir.y, style).toBeCloseTo(1);
      expect(c.startDir.x, style).toBeCloseTo(-1);
      expect(c.startDir.y, style).toBeCloseTo(0);
    }
  });

  it("puts the label halfway along the path", () => {
    expect(bentPath(points, "straight").mid).toEqual({ x: 100, y: 0 });
    const curved = bentPath(points, "curved").mid;
    expect(curved.x).toBeGreaterThan(95);
    expect(curved.y).toBeLessThan(5);
  });
});
