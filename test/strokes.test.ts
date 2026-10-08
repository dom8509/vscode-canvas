import { describe, expect, it } from "vitest";
import type { CanvasNode } from "../src/jsonCanvas";
import { closes, hitInside, hitStroke, scalePoints, simplify, smoothPath, strokeBox, strokesTouched } from "../webview/strokes";

const stroke = (points: number[], more: Partial<CanvasNode> = {}): CanvasNode =>
  ({ id: "s", type: "text", text: "", shape: "draw", x: 100, y: 100, width: 100, height: 100, points, ...more }) as CanvasNode;

describe("simplify", () => {
  it("keeps the ends and drops points within the tolerance", () => {
    const line = [{ x: 0, y: 0 }, { x: 1, y: 0.1 }, { x: 2, y: -0.1 }, { x: 3, y: 0 }];
    expect(simplify(line, 0.5)).toEqual([{ x: 0, y: 0 }, { x: 3, y: 0 }]);
  });

  it("keeps a corner", () => {
    const corner = [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 5 }, { x: 10, y: 10 }];
    expect(simplify(corner, 0.5)).toEqual([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }]);
  });

  it("leaves one or two points alone", () => {
    expect(simplify([{ x: 1, y: 1 }], 1)).toEqual([{ x: 1, y: 1 }]);
    expect(simplify([{ x: 1, y: 1 }, { x: 1, y: 1.1 }], 1)).toEqual([{ x: 1, y: 1 }, { x: 1, y: 1.1 }]);
  });
});

describe("smoothPath", () => {
  it("goes through every point", () => {
    const d = smoothPath([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }]);
    expect(d.startsWith("M 0 0 C")).toBe(true);
    expect(d).toContain("10 0");
    expect(d.endsWith("10 10")).toBe(true);
  });

  it("draws one point as a dot", () => {
    expect(smoothPath([{ x: 3, y: 4 }])).toBe("M 3 4 L 3 4");
  });
});

describe("strokeBox", () => {
  it("gives the box and the points relative to it", () => {
    const { box, points } = strokeBox([{ x: 10, y: 20 }, { x: 40, y: 5 }, { x: 25, y: 35 }]);
    expect(box).toEqual({ x: 10, y: 5, width: 30, height: 30 });
    expect(points).toEqual([{ x: 0, y: 15 }, { x: 30, y: 0 }, { x: 15, y: 30 }]);
  });

  it("is at least one pixel wide and high", () => {
    expect(strokeBox([{ x: 10, y: 20 }, { x: 40, y: 20 }]).box).toEqual({ x: 10, y: 20, width: 30, height: 1 });
  });
});

describe("scalePoints", () => {
  it("maps a stroke from one box to another", () => {
    const from = { width: 100, height: 50 };
    const to = { width: 200, height: 25 };
    expect(scalePoints([{ x: 50, y: 50 }, { x: 0, y: 10 }], from, to)).toEqual([{ x: 100, y: 25 }, { x: 0, y: 5 }]);
  });
});

describe("hitStroke", () => {
  // An open loop: down the left side, along the bottom, up the right side.
  const loop = stroke([0, 0, 0, 100, 100, 100, 100, 0]);

  it("hits within the tolerance of the line", () => {
    expect(hitStroke(loop, { x: 103, y: 150 }, 6)).toBe(true);
    expect(hitStroke(loop, { x: 150, y: 196 }, 6)).toBe(true);
    expect(hitStroke(loop, { x: 110, y: 150 }, 6)).toBe(false);
  });

  it("misses inside an open loop", () => {
    expect(hitStroke(loop, { x: 150, y: 150 }, 6)).toBe(false);
    expect(hitStroke(loop, { x: 150, y: 101 }, 6)).toBe(false);
  });

  it("honours the turn", () => {
    const bar = stroke([0, 50, 100, 50], { rotation: 90 });
    expect(hitStroke(bar, { x: 150, y: 110 }, 4)).toBe(true);
    expect(hitStroke(bar, { x: 110, y: 150 }, 4)).toBe(false);
  });
});

describe("strokesTouched", () => {
  const card = (id: string, more: Partial<CanvasNode> = {}): CanvasNode =>
    ({ id, type: "text", text: "", x: 100, y: 100, width: 100, height: 100, ...more }) as CanvasNode;
  // A level stroke from (100, 150) to (200, 150).
  const level = stroke([0, 50, 100, 50], { id: "level" });

  it("finds the strokes the path passes within the tolerance", () => {
    const far = stroke([0, 0, 100, 0], { id: "far", y: 400 });
    expect(strokesTouched([level, far], [{ x: 150, y: 155 }], 8)).toEqual(["level"]);
    expect(strokesTouched([level, far], [{ x: 150, y: 170 }], 8)).toEqual([]);
  });

  it("finds a stroke crossed between two pointer samples", () => {
    expect(strokesTouched([level], [{ x: 150, y: 100 }, { x: 150, y: 200 }], 8)).toEqual(["level"]);
  });

  it("passes by cards, shapes, free text, groups, points and locked strokes", () => {
    const others = [
      card("card"),
      card("shape", { shape: "rectangle" }),
      card("free", { shape: "text" }),
      card("group", { type: "group" }),
      card("point", { shape: "point", x: 150, y: 150, width: 1, height: 1 }),
      stroke([0, 50, 100, 50], { id: "locked", locked: true }),
      stroke([0, 50, 100, 50, 50, 0, 0, 50], { id: "written", closed: true, text: "Hi" }),
    ];
    expect(strokesTouched(others, [{ x: 150, y: 100 }, { x: 150, y: 200 }], 8)).toEqual([]);
  });
});

describe("closes", () => {
  const ring = (gap: number, size = 100) => [{ x: 0, y: 0 }, { x: size, y: 0 }, { x: size, y: size }, { x: gap, y: 0 }];

  it("closes when the end comes back within the tolerance of the start", () => {
    expect(closes(ring(10), 12, 16)).toBe(true);
    expect(closes(ring(20), 12, 16)).toBe(false);
  });

  it("does not close a stroke smaller than the least size", () => {
    expect(closes(ring(2, 10), 12, 16)).toBe(false);
    expect(closes(ring(2, 16), 12, 16)).toBe(true);
  });
});

describe("hitInside", () => {
  // A triangle with its corners at the box's top left, top right and bottom left.
  const triangle = stroke([0, 0, 100, 0, 0, 100, 0, 0], { closed: true });

  it("hits inside the outline and misses outside it", () => {
    expect(hitInside(triangle, { x: 120, y: 120 })).toBe(true);
    expect(hitInside(triangle, { x: 180, y: 180 })).toBe(false);
  });

  it("honours the turn", () => {
    const turned = { ...triangle, rotation: 180 };
    expect(hitInside(turned, { x: 120, y: 120 })).toBe(false);
    expect(hitInside(turned, { x: 180, y: 180 })).toBe(true);
  });
});
