import { describe, expect, it } from "vitest";
import { DRAWING_STYLES, resolveDrawingStyle, seedOf, setDrawingStyle } from "../webview/drawingStyles";
import { sketchPath } from "../webview/sketch";

describe("drawing styles", () => {
  it("has the three Excalidraw styles, from clean to sketchy", () => {
    expect(DRAWING_STYLES.architect.roughness).toBe(0);
    expect(DRAWING_STYLES.artist.roughness).toBe(1);
    expect(DRAWING_STYLES.cartoonist.roughness).toBe(2);
  });

  it("takes the most specific valid style: element, canvas, settings, default", () => {
    expect(resolveDrawingStyle("cartoonist", "architect", "artist")).toBe("cartoonist");
    expect(resolveDrawingStyle(undefined, "architect", "cartoonist")).toBe("architect");
    expect(resolveDrawingStyle("nonsense", undefined, "cartoonist")).toBe("cartoonist");
    expect(resolveDrawingStyle()).toBe("artist");
  });

  it("leaves a style equal to the inherited one out of the element", () => {
    const el: Record<string, unknown> = { style: "cartoonist" };
    setDrawingStyle(el, "artist", "artist");
    expect(el).not.toHaveProperty("style");
    setDrawingStyle(el, "architect", "artist");
    expect(el.style).toBe("architect");
  });

  it("draws the same element the same way every time", () => {
    const d = "M 0 0 L 100 0 L 100 50 Z";
    const seed = seedOf("abc123");
    expect(seedOf("abc123")).toBe(seed);
    expect(sketchPath(d, seed, "cartoonist")).toBe(sketchPath(d, seed, "cartoonist"));
    expect(sketchPath(d, seed, "cartoonist")).not.toBe(sketchPath(d, seed, "architect"));
  });
});
