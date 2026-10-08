import { describe, expect, it } from "vitest";
import { pickNodeDefaults } from "../webview/nodeDefaults";

const all = { color: "4", fill: "solid", fontFamily: "hand", fontSize: "l", strokeWidth: "bold", shape: "star" } as const;

describe("pickNodeDefaults", () => {
  it("gives a shape its color, fill, font, text size and border", () => {
    expect(pickNodeDefaults(all, "rectangle")).toEqual({ color: "4", fill: "solid", fontFamily: "hand", fontSize: "l", strokeWidth: "bold" });
  });

  it("gives a card its color, font, text size and border, but no fill", () => {
    expect(pickNodeDefaults(all, "card")).toEqual({ color: "4", fontFamily: "hand", fontSize: "l", strokeWidth: "bold" });
  });

  it("gives free text its color, font and text size only", () => {
    expect(pickNodeDefaults(all, "text")).toEqual({ color: "4", fontFamily: "hand", fontSize: "l" });
  });

  it("gives a stroke its color and width only", () => {
    expect(pickNodeDefaults(all, "draw")).toEqual({ color: "4", strokeWidth: "bold" });
  });

  it("never takes the shape itself, and leaves out what was not picked", () => {
    expect(pickNodeDefaults({ fill: "none" }, "ellipse")).toEqual({ fill: "none" });
    expect(pickNodeDefaults({}, "card")).toEqual({});
  });
});
