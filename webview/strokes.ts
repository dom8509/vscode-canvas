// Pen strokes: smoothing, their box, and hitting them. A stroke's points are
// relative to its box; the box is the node's x, y, width and height.

import { type CanvasNode, rotationOf, strokePoints } from "../src/jsonCanvas";
import { type Point, type Rect, center, rotatePoint } from "./geometry";

/** The points of a line with the ones within `tolerance` of it dropped (Ramer–Douglas–Peucker). The ends stay. */
export function simplify(points: Point[], tolerance: number): Point[] {
  if (points.length <= 2) return points;
  const keep = new Array<boolean>(points.length).fill(false);
  keep[0] = keep[points.length - 1] = true;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [i, j] = stack.pop()!;
    let far = -1;
    let farthest = tolerance;
    for (let k = i + 1; k < j; k++) {
      const d = distanceToSegment(points[k]!, points[i]!, points[j]!);
      if (d > farthest) {
        far = k;
        farthest = d;
      }
    }
    if (far < 0) continue;
    keep[far] = true;
    stack.push([i, far], [far, j]);
  }
  return points.filter((_, k) => keep[k]);
}

/** SVG path data of a smooth line through every point (Catmull-Rom as cubic Béziers). One point is a dot. */
export function smoothPath(points: Point[]): string {
  const r = (v: number) => Math.round(v * 100) / 100;
  const a = points[0];
  if (!a) return "";
  if (points.length === 1) return `M ${r(a.x)} ${r(a.y)} L ${r(a.x)} ${r(a.y)}`;
  let d = `M ${r(a.x)} ${r(a.y)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = points[i + 2] ?? p2;
    d += ` C ${r(p1.x + (p2.x - p0.x) / 6)} ${r(p1.y + (p2.y - p0.y) / 6)}, ${r(p2.x - (p3.x - p1.x) / 6)} ${r(p2.y - (p3.y - p1.y) / 6)}, ${r(p2.x)} ${r(p2.y)}`;
  }
  return d;
}

/** The box around a stroke drawn in canvas coordinates, at least one pixel each way, and its points relative to the box. */
export function strokeBox(points: Point[]): { box: Rect; points: Point[] } {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const round = (v: number) => Math.round(v * 10) / 10;
  const x = round(Math.min(...xs));
  const y = round(Math.min(...ys));
  const box = { x, y, width: Math.max(1, round(Math.max(...xs) - x)), height: Math.max(1, round(Math.max(...ys) - y)) };
  return { box, points: points.map((p) => ({ x: p.x - x, y: p.y - y })) };
}

/** The points of a stroke whose box changed size from `from` to `to`. */
export function scalePoints(points: Point[], from: { width: number; height: number }, to: { width: number; height: number }): Point[] {
  const sx = to.width / from.width;
  const sy = to.height / from.height;
  return points.map((p) => ({ x: p.x * sx, y: p.y * sy }));
}

/** A stroke's points in canvas coordinates, turned with it. */
export function worldPoints(node: CanvasNode): Point[] {
  const c = center(node);
  const turn = rotationOf(node);
  return strokePoints(node).map((p) => rotatePoint({ x: node.x + p.x, y: node.y + p.y }, c, turn));
}

/** Whether `p` lies within `tolerance` of a stroke's line. */
export function hitStroke(node: CanvasNode, p: Point, tolerance: number): boolean {
  const points = worldPoints(node);
  if (points.length === 1) return Math.hypot(p.x - points[0]!.x, p.y - points[0]!.y) <= tolerance;
  for (let i = 1; i < points.length; i++) if (distanceToSegment(p, points[i - 1]!, points[i]!) <= tolerance) return true;
  return false;
}

export function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = dx * dx + dy * dy;
  const t = len ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len)) : 0;
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}
