import type { Side } from "../src/jsonCanvas";

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

/** A curve that leaves `a` straight out of `sideA` and enters `b` straight into `sideB`. */
export function edgeCurve(a: Point, sideA: Side, b: Point, sideB: Side | null): EdgeCurve {
  const dist = Math.hypot(b.x - a.x, b.y - a.y);
  const k = Math.min(Math.max(dist / 2, 30), 250);
  const na = SIDE_NORMALS[sideA];
  const c1 = { x: a.x + na.x * k, y: a.y + na.y * k };
  let c2: Point;
  if (sideB) {
    const nb = SIDE_NORMALS[sideB];
    c2 = { x: b.x + nb.x * k, y: b.y + nb.y * k };
  } else {
    c2 = { x: b.x, y: b.y };
  }
  const mid = {
    x: 0.125 * a.x + 0.375 * c1.x + 0.375 * c2.x + 0.125 * b.x,
    y: 0.125 * a.y + 0.375 * c1.y + 0.375 * c2.y + 0.125 * b.y,
  };
  return {
    start: a,
    end: b,
    d: `M ${a.x} ${a.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${b.x} ${b.y}`,
    mid,
    endDir: unit({ x: b.x - c2.x, y: b.y - c2.y }, sideB ? neg(SIDE_NORMALS[sideB]) : { x: 1, y: 0 }),
    startDir: unit({ x: a.x - c1.x, y: a.y - c1.y }, neg(na)),
  };
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
