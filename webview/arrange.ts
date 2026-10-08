// Arranging cards: layer order, align and distribute, snap guides, and
// scaling several cards at once. Pure functions on cards and rectangles.

import type { CanvasNode } from "../src/jsonCanvas";

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
 */
export function reorder(nodes: CanvasNode[], ids: Iterable<string>, op: LayerOp): CanvasNode[] {
  const set = new Set(ids);
  const picked = (n: CanvasNode) => set.has(n.id);
  const groups = nodes.filter((n) => n.type === "group");
  const cards = nodes.filter((n) => n.type !== "group");
  return [...move(groups, picked, op), ...move(cards, picked, op)];
}
