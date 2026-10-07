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

/** The path of an edge in the given style: a curve, a straight line or right-angled elbows. */
export function edgePath(a: Point, sideA: Side, b: Point, sideB: Side | null, style: PathStyle = "curved"): EdgeCurve {
  if (style === "curved") return edgeCurve(a, sideA, b, sideB);
  const points = style === "straight" ? [a, b] : elbowPoints(a, sideA, b, sideB);
  const last = points.length - 1;
  return {
    start: a,
    end: b,
    d: "M " + points.map((p) => `${p.x} ${p.y}`).join(" L "),
    mid: pointAlong(points, 0.5),
    endDir: unit({ x: b.x - points[last - 1]!.x, y: b.y - points[last - 1]!.y }, { x: 1, y: 0 }),
    startDir: unit({ x: a.x - points[1]!.x, y: a.y - points[1]!.y }, neg(SIDE_NORMALS[sideA])),
  };
}

const ELBOW_OUT = 24;

/** Corners of a right-angled path that leaves `a` straight out of `sideA` and enters `b` straight into `sideB`. */
export function elbowPoints(a: Point, sideA: Side, b: Point, sideB: Side | null): Point[] {
  const na = SIDE_NORMALS[sideA];
  const p1 = { x: a.x + na.x * ELBOW_OUT, y: a.y + na.y * ELBOW_OUT };
  const nb = sideB ? SIDE_NORMALS[sideB] : { x: 0, y: 0 };
  const p2 = { x: b.x + nb.x * ELBOW_OUT, y: b.y + nb.y * ELBOW_OUT };
  const horizA = na.y === 0;
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

/** SVG markup for the head of an edge whose tip is at `tip`, pointing along `dir`. Filled shapes use class "fill", lines "stroke". */
export function headSvg(shape: HeadShape, tip: Point, dir: Point, size: number): string {
  const at = (back: number, side: number): Point => ({
    x: tip.x - dir.x * back - dir.y * side,
    y: tip.y - dir.y * back + dir.x * side,
  });
  const pts = (...ps: Point[]) => ps.map((p) => `${p.x},${p.y}`).join(" ");
  switch (shape) {
    case "none":
      return "";
    case "arrow":
      return `<polygon class="fill" points="${arrowHead(tip, dir, size)}"/>`;
    case "open":
      return `<polyline class="stroke" points="${pts(at(size, size * 0.55), tip, at(size, -size * 0.55))}"/>`;
    case "dot": {
      const c = at(size * 0.4, 0);
      return `<circle class="fill" cx="${c.x}" cy="${c.y}" r="${size * 0.4}"/>`;
    }
    case "bar":
      return `<polyline class="stroke" points="${pts(at(0, size * 0.55), at(0, -size * 0.55))}"/>`;
    case "diamond":
      return `<polygon class="fill" points="${pts(tip, at(size * 0.6, size * 0.4), at(size * 1.2, 0), at(size * 0.6, -size * 0.4))}"/>`;
  }
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
