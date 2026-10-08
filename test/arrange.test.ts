import { describe, expect, it } from "vitest";
import type { CanvasNode } from "../src/jsonCanvas";
import { align, distribute, reorder } from "../webview/arrange";

const card = (id: string): CanvasNode => ({ id, type: "text", text: "", x: 0, y: 0, width: 10, height: 10 });
const group = (id: string): CanvasNode => ({ id, type: "group", x: 0, y: 0, width: 10, height: 10 });
const ids = (nodes: CanvasNode[]) => nodes.map((n) => n.id).join(" ");

describe("reorder", () => {
  const nodes = [group("G1"), group("G2"), card("a"), card("b"), card("c"), card("d")];

  it("moves cards one step forward or backward", () => {
    expect(ids(reorder(nodes, ["b"], "forward"))).toBe("G1 G2 a c b d");
    expect(ids(reorder(nodes, ["c"], "backward"))).toBe("G1 G2 a c b d");
    expect(ids(reorder(nodes, ["d"], "forward"))).toBe("G1 G2 a b c d");
    expect(ids(reorder(nodes, ["a"], "backward"))).toBe("G1 G2 a b c d");
  });

  it("moves cards to the front or the back, keeping their own order", () => {
    expect(ids(reorder(nodes, ["a", "c"], "front"))).toBe("G1 G2 b d a c");
    expect(ids(reorder(nodes, ["b", "d"], "back"))).toBe("G1 G2 b d a c");
  });

  it("moves several selected cards forward together", () => {
    expect(ids(reorder(nodes, ["a", "b"], "forward"))).toBe("G1 G2 c a b d");
  });

  it("keeps groups at the start and moves a group only among groups", () => {
    expect(ids(reorder(nodes, ["G1"], "front"))).toBe("G2 G1 a b c d");
    expect(ids(reorder(nodes, ["G2"], "forward"))).toBe("G1 G2 a b c d");
    expect(ids(reorder(nodes, ["a"], "back"))).toBe("G1 G2 a b c d");
    expect(ids(reorder([card("a"), group("G"), card("b")], ["b"], "back"))).toBe("G b a");
  });

  it("ignores ids that are not in the list and keeps the others in order", () => {
    expect(ids(reorder(nodes, ["x"], "front"))).toBe(ids(nodes));
    expect(ids(reorder(nodes, ["x", "c"], "front"))).toBe("G1 G2 a b d c");
  });

  it("leaves locked cards where they are", () => {
    const list = [card("a"), { ...card("b"), locked: true }, card("c")];
    expect(ids(reorder(list, ["a", "b"], "front"))).toBe("b c a");
    expect(ids(reorder(list, ["b"], "back"))).toBe("a b c");
  });

  it("leaves the list it is given alone", () => {
    const list = [card("a"), card("b")];
    reorder(list, ["a"], "front");
    expect(ids(list)).toBe("a b");
  });
});

const r = (x: number, y: number, width: number, height: number) => ({ x, y, width, height });

describe("align", () => {
  const rects = [r(0, 0, 10, 10), r(30, 20, 20, 40), r(100, 50, 40, 10)];

  it("aligns to an edge of the selection's bounds", () => {
    expect(align(rects, "left").map((x) => x.x)).toEqual([0, 0, 0]);
    expect(align(rects, "right").map((x) => x.x + x.width)).toEqual([140, 140, 140]);
    expect(align(rects, "top").map((x) => x.y)).toEqual([0, 0, 0]);
    expect(align(rects, "bottom").map((x) => x.y + x.height)).toEqual([60, 60, 60]);
  });

  it("aligns centers to the middle of the bounds", () => {
    expect(align(rects, "center").map((x) => x.x + x.width / 2)).toEqual([70, 70, 70]);
    expect(align(rects, "middle").map((x) => x.y + x.height / 2)).toEqual([30, 30, 30]);
  });

  it("keeps sizes and the other axis", () => {
    const out = align(rects, "left");
    expect(out.map((x) => [x.y, x.width, x.height])).toEqual(rects.map((x) => [x.y, x.width, x.height]));
  });
});

describe("distribute", () => {
  it("keeps the outer two and makes the gaps equal", () => {
    const out = distribute([r(0, 0, 10, 10), r(15, 0, 10, 10), r(90, 0, 10, 10)], "horizontal");
    expect(out.map((x) => x.x)).toEqual([0, 45, 90]);
  });

  it("works in the list's order, whatever order the cards lie in", () => {
    const out = distribute([r(90, 0, 10, 10), r(0, 0, 10, 10), r(15, 0, 10, 10)], "horizontal");
    expect(out.map((x) => x.x)).toEqual([90, 0, 45]);
  });

  it("makes equal gaps also when cards overlap", () => {
    const out = distribute([r(0, 0, 0, 40), r(0, 5, 0, 40), r(0, 50, 0, 40)], "vertical");
    expect(out.map((x) => x.y)).toEqual([0, 25, 50]);
    const wide = distribute([r(0, 0, 60, 10), r(10, 0, 60, 10), r(50, 0, 60, 10)], "horizontal");
    expect(wide.map((x) => x.x)).toEqual([0, 25, 50]);
  });
});
