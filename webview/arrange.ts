// Arranging cards: layer order, align and distribute, snap guides, and
// scaling several cards at once. Pure functions on cards and rectangles.

import { type CanvasNode, isLocked } from "../src/jsonCanvas";
import { type Rect, boundsOf } from "./geometry";

export type LayerOp = "forward" | "backward" | "front" | "back";

/** `list` with the items in `picked` moved one step or all the way toward its end ("forward") or start. */
function move<T>(list: T[], picked: (item: T) => boolean, op: LayerOp): T[] {
  if (op === "front") return [...list.filter((n) => !picked(n)), ...list.filter(picked)];
  if (op === "back") return [...list.filter(picked), ...list.filter((n) => !picked(n))];
  const out = [...list];
  const step = op === "forward" ? 1 : -1;
  const order = out.map((_, i) => i);
  if (op === "forward") order.reverse();
  for (const i of order) {
    const j = i + step;
    if (j < 0 || j >= out.length || !picked(out[i]!) || picked(out[j]!)) continue;
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/**
 * The cards in a new layer order: the ones in `ids` one step forward or back, or to the front or back.
 * Cards later in the list are drawn on top. Groups stay at the start, behind every card, and move only among groups.
 * Locked cards stay where they are.
 */
export function reorder(nodes: CanvasNode[], ids: Iterable<string>, op: LayerOp): CanvasNode[] {
  const set = new Set(ids);
  const picked = (n: CanvasNode) => set.has(n.id) && !isLocked(n);
  const groups = nodes.filter((n) => n.type === "group");
  const cards = nodes.filter((n) => n.type !== "group");
  return [...move(groups, picked, op), ...move(cards, picked, op)];
}

export type AlignEdge = "left" | "center" | "right" | "top" | "middle" | "bottom";

/** The rects moved so the given edge or center of each lines up with that of their bounds. Sizes stay. */
export function align(rects: Rect[], edge: AlignEdge): Rect[] {
  const b = boundsOf(rects);
  if (!b) return [];
  return rects.map((r) => {
    switch (edge) {
      case "left":
        return { ...r, x: b.x };
      case "center":
        return { ...r, x: b.x + (b.width - r.width) / 2 };
      case "right":
        return { ...r, x: b.x + b.width - r.width };
      case "top":
        return { ...r, y: b.y };
      case "middle":
        return { ...r, y: b.y + (b.height - r.height) / 2 };
      case "bottom":
        return { ...r, y: b.y + b.height - r.height };
    }
  });
}

/**
 * The rects spread along an axis so the gaps between them are equal. The first and the last, by their
 * centers, stay where they are. Returned in the order given.
 */
export function distribute(rects: Rect[], axis: "horizontal" | "vertical"): Rect[] {
  const [pos, size] = axis === "horizontal" ? (["x", "width"] as const) : (["y", "height"] as const);
  const order = rects.map((_, i) => i).sort((a, b) => rects[a]![pos] + rects[a]![size] / 2 - (rects[b]![pos] + rects[b]![size] / 2));
  const out = rects.map((r) => ({ ...r }));
  if (rects.length < 3) return out;
  const first = rects[order[0]!]!;
  const last = rects[order[order.length - 1]!]!;
  const total = rects.reduce((sum, r) => sum + r[size], 0);
  const gap = (last[pos] + last[size] - first[pos] - total) / (rects.length - 1);
  let at = first[pos];
  for (const i of order) {
    out[i]![pos] = at;
    at += rects[i]![size] + gap;
  }
  return out;
}
