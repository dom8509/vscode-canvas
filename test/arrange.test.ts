import { describe, expect, it } from "vitest";
import type { CanvasNode } from "../src/jsonCanvas";
import { reorder } from "../webview/arrange";

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
