import { describe, expect, it } from "vitest";
import { type CanvasNode, SHAPES, nodeLook, setNodeLook } from "../src/jsonCanvas";
import { defaultShapeSize, shapeMarks, shapePath } from "../webview/shapes";

const card = (): CanvasNode => ({ id: "n", type: "text", text: "", x: 0, y: 0, width: 100, height: 80 });

describe("nodeLook", () => {
  it("reads a plain card as a card", () => {
    expect(nodeLook(card())).toEqual({
      shape: "card",
      fill: "semi",
      fontSize: undefined,
      fontFamily: "sans",
      strokeWidth: "normal",
    });
  });

  it("reads shapes and free text, and ignores unknown ones", () => {
    expect(nodeLook({ ...card(), shape: "star", fill: "solid" }).shape).toBe("star");
    expect(nodeLook({ ...card(), shape: "text", fontSize: "xl" })).toMatchObject({ shape: "text", fontSize: "xl" });
    expect(nodeLook({ ...card(), shape: "blob" }).shape).toBe("card");
  });

  it("never gives other card types a shape", () => {
    expect(nodeLook({ id: "f", type: "file", file: "a.md", x: 0, y: 0, width: 1, height: 1, shape: "star" }).shape).toBe("card");
  });
});

describe("setNodeLook", () => {
  it("stores only what differs from a plain card", () => {
    const n = card();
    setNodeLook(n, { shape: "ellipse", fill: "none", fontSize: "l", fontFamily: "hand", strokeWidth: "extra" });
    expect(n).toMatchObject({ shape: "ellipse", fill: "none", fontSize: "l", fontFamily: "hand", strokeWidth: "extra" });
    setNodeLook(n, { shape: "card", fill: "semi", fontSize: undefined, fontFamily: "sans", strokeWidth: "normal" });
    expect(n).toEqual(card());
  });

  it("gives shapes a medium font, but leaves a plain card's font to the editor", () => {
    expect(nodeLook({ ...card(), shape: "star" }).fontSize).toBe("m");
    expect(nodeLook({ ...card(), fontSize: "xl" }).fontSize).toBe("xl");
    expect(nodeLook({ ...card(), fontFamily: "comic", strokeWidth: "huge" })).toMatchObject({
      fontFamily: "sans",
      strokeWidth: "normal",
    });
  });
});

describe("shapePath", () => {
  it("draws every shape inside its box", () => {
    for (const shape of SHAPES) {
      const d = shapePath(shape, 200, 100, 2);
      expect(d).toMatch(/^M /);
      const numbers = d.match(/-?\d+(\.\d+)?/g)!.map(Number);
      // Curves may bow a little past their points, but all points stay near the box.
      for (const n of numbers) expect(n).toBeGreaterThanOrEqual(-20);
      expect(Math.max(...numbers)).toBeLessThanOrEqual(220);
    }
  });

  it("adds marks only to the boxes that have them", () => {
    expect(shapeMarks("x-box", 100, 100)).not.toBe("");
    expect(shapeMarks("check-box", 100, 100)).not.toBe("");
    expect(shapeMarks("ellipse", 100, 100)).toBe("");
  });

  it("gives tall arrows a tall default size", () => {
    const size = defaultShapeSize("arrow-up");
    expect(size.height).toBeGreaterThan(size.width);
  });
});
