// Arranging cards: layer order, align and distribute, snap guides, and
// scaling several cards at once. Pure functions on cards and rectangles.

import { type CanvasNode, isLocked } from "../src/jsonCanvas";
import { type Point, type Pull, type Rect, boundsOf } from "./geometry";

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

/** A snap guide: a line at `at` on one axis ("x" is a vertical line), drawn from `from` to `to` along the other. */
export interface Guide {
  axis: "x" | "y";
  at: number;
  from: number;
  to: number;
}

export interface Snap {
  /** How far to move on each axis to meet a guide; undefined where no card is near. */
  dx: number | undefined;
  dy: number | undefined;
  guides: Guide[];
}

const lines = (r: Rect, axis: "x" | "y"): number[] =>
  axis === "x" ? [r.x, r.x + r.width / 2, r.x + r.width] : [r.y, r.y + r.height / 2, r.y + r.height];

/** The smallest move on one axis that puts an edge or center of `moving` on an edge or center of another rect. */
function snapAxis(moving: Rect, others: Rect[], tolerance: number, axis: "x" | "y"): { offset: number | undefined; guides: Guide[] } {
  let offset: number | undefined;
  for (const o of others) {
    for (const a of lines(moving, axis)) {
      for (const b of lines(o, axis)) {
        const d = b - a;
        if (Math.abs(d) <= tolerance && (offset === undefined || Math.abs(d) < Math.abs(offset))) offset = d;
      }
    }
  }
  if (offset === undefined) return { offset, guides: [] };
  const other = axis === "x" ? "y" : "x";
  const size = axis === "x" ? "height" : "width";
  const placed = axis === "x" ? { ...moving, x: moving.x + offset } : { ...moving, y: moving.y + offset };
  const guides = new Map<number, Guide>();
  for (const o of others) {
    for (const at of lines(placed, axis)) {
      if (!lines(o, axis).some((b) => Math.abs(b - at) < 0.5)) continue;
      const g = guides.get(at) ?? { axis, at, from: placed[other], to: placed[other] + placed[size] };
      g.from = Math.min(g.from, o[other]);
      g.to = Math.max(g.to, o[other] + o[size]);
      guides.set(at, g);
    }
  }
  return { offset, guides: [...guides.values()] };
}

/**
 * Where `moving` snaps to the cards around it: an edge or center within `tolerance` of an edge or center
 * of another card, the closest on each axis, with the guide lines that show the match.
 */
export function snapGuides(moving: Rect, others: Rect[], tolerance: number): Snap {
  const x = snapAxis(moving, others, tolerance, "x");
  const y = snapAxis(moving, others, tolerance, "y");
  return { dx: x.offset, dy: y.offset, guides: [...x.guides, ...y.guides] };
}

/** The smallest box a multi-selection can be scaled down to. */
export const MIN_BOX = 20;

/**
 * Scales `rects`, which lie in the box `from`, by dragging the handle that pulls (`dx`, `dy`) to `pointer`.
 * The opposite corner or side stays; a side handle leaves the other axis alone. With `keepRatio` the box
 * keeps its ratio. The box never flips past its anchor: it stops at `MIN_BOX`, as a single resize stops.
 */
export function scaleRects(rects: Rect[], from: Rect, dx: Pull, dy: Pull, pointer: Point, keepRatio: boolean): { box: Rect; rects: Rect[] } {
  const right = from.x + from.width;
  const bottom = from.y + from.height;
  let w = dx === 1 ? pointer.x - from.x : dx === -1 ? right - pointer.x : from.width;
  let h = dy === 1 ? pointer.y - from.y : dy === -1 ? bottom - pointer.y : from.height;
  w = Math.max(MIN_BOX, w);
  h = Math.max(MIN_BOX, h);
  if (keepRatio) {
    const s = dx && dy ? Math.max(w / from.width, h / from.height) : dx ? w / from.width : h / from.height;
    w = Math.max(MIN_BOX, from.width * s);
    h = Math.max(MIN_BOX, from.height * s);
  }
  // A side handle that keeps the ratio grows the other axis from the middle.
  const x = dx === -1 ? right - w : dx === 1 ? from.x : from.x + (from.width - w) / 2;
  const y = dy === -1 ? bottom - h : dy === 1 ? from.y : from.y + (from.height - h) / 2;
  const sx = w / from.width;
  const sy = h / from.height;
  return {
    box: { x, y, width: w, height: h },
    rects: rects.map((r) => ({ x: x + (r.x - from.x) * sx, y: y + (r.y - from.y) * sy, width: r.width * sx, height: r.height * sy })),
  };
}
