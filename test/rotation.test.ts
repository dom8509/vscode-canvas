import { describe, expect, it } from "vitest";
import { type CanvasNode, normalizeAngle, rotationOf, setRotation } from "../src/jsonCanvas";
import { rotatePoint, turnedSide } from "../webview/geometry";

const node = (): CanvasNode => ({ id: "n", type: "text", text: "", x: 0, y: 0, width: 10, height: 10 });

describe("rotation", () => {
  it("brings angles into (-180, 180]", () => {
    expect(normalizeAngle(0)).toBe(0);
    expect(normalizeAngle(360)).toBe(0);
    expect(normalizeAngle(270)).toBe(-90);
    expect(normalizeAngle(-180)).toBe(180);
    expect(normalizeAngle(-450)).toBe(-90);
  });

  it("reads and writes a card's turn, leaving upright cards alone", () => {
    const n = node();
    expect(rotationOf(n)).toBe(0);
    setRotation(n, 405);
    expect(n.rotation).toBe(45);
    setRotation(n, 360);
    expect(n).toEqual(node());
    expect(rotationOf({ ...node(), rotation: "x" })).toBe(0);
  });

  it("turns points clockwise around a centre", () => {
    const p = rotatePoint({ x: 10, y: 0 }, { x: 0, y: 0 }, 90);
    expect(p.x).toBeCloseTo(0);
    expect(p.y).toBeCloseTo(10);
  });

  it("finds the side a turned side now faces", () => {
    expect(turnedSide("top", 90)).toBe("right");
    expect(turnedSide("left", -90)).toBe("bottom");
    expect(turnedSide("top", 40)).toBe("top");
    expect(turnedSide("bottom", 180)).toBe("top");
  });
});
