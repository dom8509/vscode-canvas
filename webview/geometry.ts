import type { HeadShape, PathStyle, Side } from "../src/jsonCanvas";

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Screen = world * zoom + offset. */
export interface View {
  x: number;
  y: number;
  zoom: number;
}

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 4;

export const SIDE_NORMALS: Record<Side, Point> = {
  top: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  bottom: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
};

/** The middle of one side of a rectangle. */
export function anchor(r: Rect, side: Side): Point {
  switch (side) {
    case "top":
      return { x: r.x + r.width / 2, y: r.y };
    case "right":
      return { x: r.x + r.width, y: r.y + r.height / 2 };
    case "bottom":
      return { x: r.x + r.width / 2, y: r.y + r.height };
    case "left":
      return { x: r.x, y: r.y + r.height / 2 };
  }
}

/** `p` turned by `deg` degrees clockwise around `c`. */
export function rotatePoint(p: Point, c: Point, deg: number): Point {
  if (!deg) return p;
  const a = (deg * Math.PI) / 180;
  const cos = Math.cos(a), sin = Math.sin(a);
  const dx = p.x - c.x, dy = p.y - c.y;
  return { x: c.x + dx * cos - dy * sin, y: c.y + dx * sin + dy * cos };
}

/** The side a box's `side` faces most nearly after the box is turned by `deg`. */
export function turnedSide(side: Side, deg: number): Side {
  const order: Side[] = ["top", "right", "bottom", "left"];
  const steps = Math.round(deg / 90);
  return order[(((order.indexOf(side) + steps) % 4) + 4) % 4]!;
}

export function center(r: Rect): Point {
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
}

/** The side of `r` that faces the point `p`. */
export function sideFacing(r: Rect, p: Point): Side {
  const c = center(r);
  // Normalise by the size, so a wide card still picks top/bottom for points above it.
  const dx = (p.x - c.x) / Math.max(r.width, 1);
  const dy = (p.y - c.y) / Math.max(r.height, 1);
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? "right" : "left";
  return dy > 0 ? "bottom" : "top";
}

/** The sides an edge without stored sides attaches to: the ones that face each other. */
export function autoSides(from: Rect, to: Rect): [Side, Side] {
  return [sideFacing(from, center(to)), sideFacing(to, center(from))];
}

export interface EdgeCurve {
  start: Point;
  end: Point;
  /** SVG path data of a cubic Bézier curve. */
  d: string;
  /** The point halfway along the curve, where a label goes. */
  mid: Point;
  /** The direction the curve arrives in at its end, for an arrowhead. */
  endDir: Point;
  /** The direction the curve leaves its start in, reversed, for an arrowhead at the start. */
  startDir: Point;
}

/** A curve that leaves `a` straight out of `sideA` and enters `b` straight into `sideB`. A free end (no side) has no pull. */
export function edgeCurve(a: Point, sideA: Side | null, b: Point, sideB: Side | null): EdgeCurve {
  const dist = Math.hypot(b.x - a.x, b.y - a.y);
  const k = Math.min(Math.max(dist / 2, 30), 250);
  const out = (p: Point, side: Side | null): Point =>
    side ? { x: p.x + SIDE_NORMALS[side].x * k, y: p.y + SIDE_NORMALS[side].y * k } : { x: p.x, y: p.y };
  const c1 = out(a, sideA);
  const c2 = out(b, sideB);
  const mid = {
    x: 0.125 * a.x + 0.375 * c1.x + 0.375 * c2.x + 0.125 * b.x,
    y: 0.125 * a.y + 0.375 * c1.y + 0.375 * c2.y + 0.125 * b.y,
  };
  const line = unit({ x: b.x - a.x, y: b.y - a.y }, { x: 1, y: 0 });
  // At a free end the curve's tangent comes from the other control point.
  const before = sideB ? c2 : c1;
  const after = sideA ? c1 : c2;
  return {
    start: a,
    end: b,
    d: `M ${a.x} ${a.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${b.x} ${b.y}`,
    mid,
    endDir: unit({ x: b.x - before.x, y: b.y - before.y }, sideB ? neg(SIDE_NORMALS[sideB]) : line),
    startDir: unit({ x: a.x - after.x, y: a.y - after.y }, sideA ? neg(SIDE_NORMALS[sideA]) : neg(line)),
  };
}

/** The path of an edge in the given style: a curve, a straight line or right-angled elbows. */
export function edgePath(a: Point, sideA: Side | null, b: Point, sideB: Side | null, style: PathStyle = "curved"): EdgeCurve {
  if (style === "curved") return edgeCurve(a, sideA, b, sideB);
  const points = style === "straight" ? [a, b] : elbowPoints(a, sideA, b, sideB);
  const last = points.length - 1;
  const line = unit({ x: b.x - a.x, y: b.y - a.y }, { x: 1, y: 0 });
  return {
    start: a,
    end: b,
    d: "M " + points.map((p) => `${p.x} ${p.y}`).join(" L "),
    mid: pointAlong(points, 0.5),
    endDir: unit({ x: b.x - points[last - 1]!.x, y: b.y - points[last - 1]!.y }, line),
    startDir: unit({ x: a.x - points[1]!.x, y: a.y - points[1]!.y }, sideA ? neg(SIDE_NORMALS[sideA]) : neg(line)),
  };
}

/**
 * The path of a connection through its bends, from `points[0]` to the last point. Curved goes
 * smoothly through every point (Catmull-Rom); straight and elbow join them with straight segments.
 */
export function bentPath(points: Point[], style: PathStyle): EdgeCurve {
  const n = points.length;
  const a = points[0]!;
  const b = points[n - 1]!;
  let d: string;
  let line: Point[];
  if (style === "curved") {
    d = `M ${a.x} ${a.y}`;
    line = [a];
    for (let i = 0; i < n - 1; i++) {
      const p0 = points[i - 1] ?? points[i]!;
      const p1 = points[i]!;
      const p2 = points[i + 1]!;
      const p3 = points[i + 2] ?? p2;
      const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
      const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
      d += ` C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${p2.x} ${p2.y}`;
      for (let k = 1; k <= 16; k++) line.push(bezierAt(p1, c1, c2, p2, k / 16));
    }
  } else {
    d = "M " + points.map((p) => `${p.x} ${p.y}`).join(" L ");
    line = points;
  }
  return {
    start: a,
    end: b,
    d,
    mid: pointAlong(line, 0.5),
    endDir: unit({ x: b.x - points[n - 2]!.x, y: b.y - points[n - 2]!.y }, { x: 1, y: 0 }),
    startDir: unit({ x: a.x - points[1]!.x, y: a.y - points[1]!.y }, { x: -1, y: 0 }),
  };
}

function bezierAt(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const u = 1 - t;
  const w = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t] as const;
  return { x: w[0] * p0.x + w[1] * p1.x + w[2] * p2.x + w[3] * p3.x, y: w[0] * p0.y + w[1] * p1.y + w[2] * p2.y + w[3] * p3.y };
}

const ELBOW_OUT = 24;

/** Corners of a right-angled path that leaves `a` straight out of `sideA` and enters `b` straight into `sideB`. */
export function elbowPoints(a: Point, sideA: Side | null, b: Point, sideB: Side | null): Point[] {
  const none = { x: 0, y: 0 };
  const na = sideA ? SIDE_NORMALS[sideA] : none;
  const p1 = { x: a.x + na.x * ELBOW_OUT, y: a.y + na.y * ELBOW_OUT };
  const nb = sideB ? SIDE_NORMALS[sideB] : none;
  const p2 = { x: b.x + nb.x * ELBOW_OUT, y: b.y + nb.y * ELBOW_OUT };
  // A free end runs the way the bound end leaves, or along the longer axis when both are free.
  const horizA = sideA ? na.y === 0 : sideB ? nb.y === 0 : Math.abs(b.x - a.x) >= Math.abs(b.y - a.y);
  const horizB = sideB ? nb.y === 0 : horizA;
  let middle: Point[];
  if (horizA && horizB) {
    const mx = (p1.x + p2.x) / 2;
    middle = [{ x: mx, y: p1.y }, { x: mx, y: p2.y }];
  } else if (!horizA && !horizB) {
    const my = (p1.y + p2.y) / 2;
    middle = [{ x: p1.x, y: my }, { x: p2.x, y: my }];
  } else if (horizA) {
    middle = [{ x: p2.x, y: p1.y }];
  } else {
    middle = [{ x: p1.x, y: p2.y }];
  }
  const all = [a, p1, ...middle, p2, b];
  // Drop repeated points and corners on a straight run.
  const out: Point[] = [];
  for (const p of all) {
    const prev = out[out.length - 1];
    if (prev && Math.abs(prev.x - p.x) < 1e-6 && Math.abs(prev.y - p.y) < 1e-6) continue;
    const before = out[out.length - 2];
    if (before && prev && ((before.x === prev.x && prev.x === p.x) || (before.y === prev.y && prev.y === p.y))) out.pop();
    out.push(p);
  }
  return out;
}

/** The point at fraction `t` of the length of a polyline. */
export function pointAlong(points: Point[], t: number): Point {
  const lengths = points.slice(1).map((p, i) => Math.hypot(p.x - points[i]!.x, p.y - points[i]!.y));
  let left = lengths.reduce((s, l) => s + l, 0) * t;
  for (let i = 0; i < lengths.length; i++) {
    const l = lengths[i]!;
    if (left <= l && l > 0) {
      const a = points[i]!;
      const b = points[i + 1]!;
      return { x: a.x + ((b.x - a.x) * left) / l, y: a.y + ((b.y - a.y) * left) / l };
    }
    left -= l;
  }
  return points[points.length - 1]!;
}

/**
 * The outline of the head of an edge whose tip is at `tip`, pointing along
 * `dir`, as SVG path data. Filled heads (arrow, dot, diamond) are closed.
 */
export function headPath(shape: HeadShape, tip: Point, dir: Point, size: number): { d: string; filled: boolean } | undefined {
  const at = (back: number, side: number): Point => ({
    x: tip.x - dir.x * back - dir.y * side,
    y: tip.y - dir.y * back + dir.x * side,
  });
  const line = (...ps: Point[]) => "M " + ps.map((p) => `${p.x} ${p.y}`).join(" L ");
  switch (shape) {
    case "none":
      return undefined;
    case "arrow":
      return { d: "M " + arrowHead(tip, dir, size).replace(/,/g, " ").split(" ").reduce((d, n, k) => d + (k && k % 2 === 0 ? " L " : " ") + n) + " Z", filled: true };
    case "open":
      return { d: line(at(size, size * 0.55), tip, at(size, -size * 0.55)), filled: false };
    case "dot": {
      const c = at(size * 0.4, 0);
      const r = size * 0.4;
      return { d: `M ${c.x - r} ${c.y} A ${r} ${r} 0 1 0 ${c.x + r} ${c.y} A ${r} ${r} 0 1 0 ${c.x - r} ${c.y} Z`, filled: true };
    }
    case "bar":
      return { d: line(at(0, size * 0.55), at(0, -size * 0.55)), filled: false };
    case "diamond":
      return { d: line(tip, at(size * 0.6, size * 0.4), at(size * 1.2, 0), at(size * 0.6, -size * 0.4)) + " Z", filled: true };
  }
}

/** SVG markup for the head of an edge whose tip is at `tip`, pointing along `dir`. Filled shapes use class "fill", lines "stroke". */
export function headSvg(shape: HeadShape, tip: Point, dir: Point, size: number): string {
  const head = headPath(shape, tip, dir, size);
  if (!head) return "";
  return `<path class="${head.filled ? "fill" : "stroke"}" d="${head.d}"/>`;
}

function neg(p: Point): Point {
  return { x: -p.x, y: -p.y };
}

function unit(p: Point, fallback: Point): Point {
  const len = Math.hypot(p.x, p.y);
  return len < 1e-6 ? fallback : { x: p.x / len, y: p.y / len };
}

/** The three corners of an arrowhead whose tip is at `tip`, pointing along `dir`. */
export function arrowHead(tip: Point, dir: Point, size: number): string {
  const back = { x: tip.x - dir.x * size, y: tip.y - dir.y * size };
  const half = size * 0.5;
  const left = { x: back.x - dir.y * half, y: back.y + dir.x * half };
  const right = { x: back.x + dir.y * half, y: back.y - dir.x * half };
  return `${tip.x},${tip.y} ${left.x},${left.y} ${right.x},${right.y}`;
}

export function rectsIntersect(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

export function containsRect(outer: Rect, inner: Rect): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height
  );
}

/** The rectangle spanned by two corner points, in any order. */
export function rectFromPoints(a: Point, b: Point): Rect {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(a.x - b.x), height: Math.abs(a.y - b.y) };
}

export function boundsOf(rects: Rect[]): Rect | undefined {
  if (rects.length === 0) return undefined;
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const r of rects) {
    x1 = Math.min(x1, r.x);
    y1 = Math.min(y1, r.y);
    x2 = Math.max(x2, r.x + r.width);
    y2 = Math.max(y2, r.y + r.height);
  }
  return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
}

export function clampZoom(z: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
}

/** The view that shows all of `bounds` in a viewport of the given size, never zoomed in past 100 %. */
export function fitView(bounds: Rect, width: number, height: number, padding = 60): View {
  const zoom = clampZoom(
    Math.min(1, (width - 2 * padding) / Math.max(bounds.width, 1), (height - 2 * padding) / Math.max(bounds.height, 1)),
  );
  return {
    zoom,
    x: width / 2 - (bounds.x + bounds.width / 2) * zoom,
    y: height / 2 - (bounds.y + bounds.height / 2) * zoom,
  };
}

/** The view after zooming to `zoom` while keeping the world point under screen point `at` in place. */
export function zoomAt(view: View, zoom: number, at: Point): View {
  const z = clampZoom(zoom);
  const wx = (at.x - view.x) / view.zoom;
  const wy = (at.y - view.y) / view.zoom;
  return { zoom: z, x: at.x - wx * z, y: at.y - wy * z };
}

/** `to`, turned around `from` to the nearest multiple of `step` degrees, at the same distance. */
export function snapAngle(from: Point, to: Point, step: number): Point {
  const len = Math.hypot(to.x - from.x, to.y - from.y);
  const s = (step * Math.PI) / 180;
  const a = Math.round(Math.atan2(to.y - from.y, to.x - from.x) / s) * s;
  return { x: from.x + Math.cos(a) * len, y: from.y + Math.sin(a) * len };
}

export function snap(v: number, grid: number): number {
  return Math.round(v / grid) * grid;
}

/** Where to put the top-left corners of several cards dropped at once: a near-square grid centred on the drop point. */
export function gridAround(at: Point, sizes: { width: number; height: number }[], gap: number): Point[] {
  if (sizes.length === 0) return [];
  const cols = Math.ceil(Math.sqrt(sizes.length));
  const cellW = Math.max(...sizes.map((s) => s.width)) + gap;
  const cellH = Math.max(...sizes.map((s) => s.height)) + gap;
  const rows = Math.ceil(sizes.length / cols);
  const used = Math.min(cols, sizes.length);
  const left = at.x - (used * cellW - gap) / 2;
  const top = at.y - (rows * cellH - gap) / 2;
  return sizes.map((_, i) => ({ x: left + (i % cols) * cellW, y: top + Math.floor(i / cols) * cellH }));
}

/** Which way a resize handle pulls: -1 the left or top side, 1 the right or bottom side, 0 neither. */
export type Pull = -1 | 0 | 1;

/** Where the anchor lies along a side, from 0 (left or top) to 1 (right or bottom). A side handle keeps the top or left in place. */
const anchorAt = (pull: Pull): number => (pull === -1 ? 1 : 0);

/** The point that stays put while a card is resized by the handle at (`dx`, `dy`): the opposite corner or side, turned with the card. */
export function resizeAnchor(r: Rect, dx: Pull, dy: Pull, turn: number): Point {
  const p = { x: r.x + anchorAt(dx) * r.width, y: r.y + anchorAt(dy) * r.height };
  return rotatePoint(p, center(r), turn);
}

/** The top-left corner of a card of the new size whose anchor stays at `anchor`. */
export function resizedCorner(anchor: Point, width: number, height: number, dx: Pull, dy: Pull, turn: number): Point {
  const fromCenter = { x: anchor.x - anchorAt(dx) * width + width / 2, y: anchor.y - anchorAt(dy) * height + height / 2 };
  const c = rotatePoint(fromCenter, anchor, turn);
  return { x: c.x - width / 2, y: c.y - height / 2 };
}

/** The upright box around a card turned by `turn` degrees around its center. */
export function turnedBounds(r: Rect, turn: number): Rect {
  if (!turn) return { x: r.x, y: r.y, width: r.width, height: r.height };
  const c = center(r);
  const corners = [
    { x: r.x, y: r.y },
    { x: r.x + r.width, y: r.y },
    { x: r.x + r.width, y: r.y + r.height },
    { x: r.x, y: r.y + r.height },
  ].map((p) => rotatePoint(p, c, turn));
  return boundsOf(corners.map((p) => ({ ...p, width: 0, height: 0 })))!;
}
