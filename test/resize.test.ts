import { describe, expect, it } from "vitest";
import { center, resizeAnchor, resizedCorner, rotatePoint } from "../webview/geometry";

const card = { x: 0, y: 0, width: 100, height: 50 };

describe("resizing from any side", () => {
  it("keeps the opposite corner of an upright card", () => {
    const a = resizeAnchor(card, -1, -1, 0);
    expect(a).toEqual({ x: 100, y: 50 });
    expect(resizedCorner(a, 150, 80, -1, -1, 0)).toEqual({ x: -50, y: -30 });
  });

  it("keeps the opposite side when pulling one side", () => {
    const a = resizeAnchor(card, 1, 0, 0);
    expect(resizedCorner(a, 140, 50, 1, 0, 0)).toEqual({ x: 0, y: 0 });
    const b = resizeAnchor(card, 0, -1, 0);
    expect(resizedCorner(b, 100, 70, 0, -1, 0)).toEqual({ x: 0, y: -20 });
  });

  it("keeps the opposite corner of a turned card where it was", () => {
    const turn = 30;
    const a = resizeAnchor(card, 1, 1, turn);
    const corner = resizedCorner(a, 160, 90, 1, 1, turn);
    const grown = { ...corner, width: 160, height: 90 };
    const kept = rotatePoint({ x: grown.x, y: grown.y }, center(grown), turn);
    expect(kept.x).toBeCloseTo(a.x);
    expect(kept.y).toBeCloseTo(a.y);
  });
});
