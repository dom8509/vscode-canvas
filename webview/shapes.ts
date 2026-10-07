// Outlines of the shapes a text card can take, as SVG path data in a box of
// the card's size. After tldraw's geo shapes.

import type { ShapeKind } from "../src/jsonCanvas";

type Pt = [number, number];

const poly = (pts: Pt[]) => "M " + pts.map(([x, y]) => `${round(x)} ${round(y)}`).join(" L ") + " Z";
const round = (n: number) => Math.round(n * 100) / 100;

/** A regular polygon with `n` corners, one at the top, stretched to the box. */
function regular(n: number, w: number, h: number, i: number, offset = -Math.PI / 2): string {
  const pts: Pt[] = [];
  for (let k = 0; k < n; k++) {
    const a = offset + (k * 2 * Math.PI) / n;
    pts.push([i + ((w - 2 * i) / 2) * (1 + Math.cos(a)), i + ((h - 2 * i) / 2) * (1 + Math.sin(a))]);
  }
  return poly(pts);
}

/** The outline of `shape` in a `w` × `h` box, inset by `i` so the stroke stays inside. */
export function shapePath(shape: ShapeKind, w: number, h: number, i = 2): string {
  const l = i, t = i, r = w - i, b = h - i;
  const cx = w / 2, cy = h / 2;
  const iw = r - l, ih = b - t;
  switch (shape) {
    case "rectangle":
    case "x-box":
    case "check-box": {
      const k = Math.min(10, iw / 4, ih / 4);
      return `M ${l + k} ${t} H ${r - k} Q ${r} ${t} ${r} ${t + k} V ${b - k} Q ${r} ${b} ${r - k} ${b} H ${l + k} Q ${l} ${b} ${l} ${b - k} V ${t + k} Q ${l} ${t} ${l + k} ${t} Z`;
    }
    case "ellipse":
      return `M ${l} ${cy} A ${iw / 2} ${ih / 2} 0 1 0 ${r} ${cy} A ${iw / 2} ${ih / 2} 0 1 0 ${l} ${cy} Z`;
    case "triangle":
      return poly([[cx, t], [r, b], [l, b]]);
    case "diamond":
      return poly([[cx, t], [r, cy], [cx, b], [l, cy]]);
    case "pentagon":
      return regular(5, w, h, i);
    case "hexagon":
      return poly([[l + iw * 0.25, t], [r - iw * 0.25, t], [r, cy], [r - iw * 0.25, b], [l + iw * 0.25, b], [l, cy]]);
    case "octagon":
      return regular(8, w, h, i, -Math.PI / 2 + Math.PI / 8);
    case "star": {
      const pts: Pt[] = [];
      for (let k = 0; k < 10; k++) {
        const a = -Math.PI / 2 + (k * Math.PI) / 5;
        const f = k % 2 ? 0.42 : 1;
        pts.push([cx + (iw / 2) * f * Math.cos(a), cy + (ih / 2) * f * Math.sin(a) + ih * 0.05]);
      }
      return poly(pts);
    }
    case "rhombus": {
      const k = Math.min(iw * 0.25, ih);
      return poly([[l + k, t], [r, t], [r - k, b], [l, b]]);
    }
    case "trapezoid": {
      const k = Math.min(iw * 0.2, ih);
      return poly([[l + k, t], [r - k, t], [r, b], [l, b]]);
    }
    case "arrow-right":
      return poly([[l, t + ih * 0.25], [r - iw * 0.35, t + ih * 0.25], [r - iw * 0.35, t], [r, cy], [r - iw * 0.35, b], [r - iw * 0.35, b - ih * 0.25], [l, b - ih * 0.25]]);
    case "arrow-left":
      return poly([[r, t + ih * 0.25], [l + iw * 0.35, t + ih * 0.25], [l + iw * 0.35, t], [l, cy], [l + iw * 0.35, b], [l + iw * 0.35, b - ih * 0.25], [r, b - ih * 0.25]]);
    case "arrow-up":
      return poly([[l + iw * 0.25, b], [l + iw * 0.25, t + ih * 0.35], [l, t + ih * 0.35], [cx, t], [r, t + ih * 0.35], [r - iw * 0.25, t + ih * 0.35], [r - iw * 0.25, b]]);
    case "arrow-down":
      return poly([[l + iw * 0.25, t], [l + iw * 0.25, b - ih * 0.35], [l, b - ih * 0.35], [cx, b], [r, b - ih * 0.35], [r - iw * 0.25, b - ih * 0.35], [r - iw * 0.25, t]]);
    case "heart":
      return (
        `M ${cx} ${b} ` +
        `C ${l + iw * 0.15} ${t + ih * 0.7}, ${l} ${t + ih * 0.45}, ${l} ${t + ih * 0.28} ` +
        `C ${l} ${t + ih * 0.08}, ${l + iw * 0.2} ${t}, ${l + iw * 0.3} ${t} ` +
        `C ${l + iw * 0.4} ${t}, ${cx} ${t + ih * 0.1}, ${cx} ${t + ih * 0.22} ` +
        `C ${cx} ${t + ih * 0.1}, ${r - iw * 0.4} ${t}, ${r - iw * 0.3} ${t} ` +
        `C ${r - iw * 0.2} ${t}, ${r} ${t + ih * 0.08}, ${r} ${t + ih * 0.28} ` +
        `C ${r} ${t + ih * 0.45}, ${r - iw * 0.15} ${t + ih * 0.7}, ${cx} ${b} Z`
      );
    case "cloud": {
      // Bumps around an ellipse.
      const bumps = 8;
      const pts: Pt[] = [];
      for (let k = 0; k < bumps; k++) {
        const a = -Math.PI / 2 + (k * 2 * Math.PI) / bumps;
        pts.push([cx + (iw / 2) * 0.74 * Math.cos(a), cy + (ih / 2) * 0.7 * Math.sin(a)]);
      }
      let d = `M ${round(pts[0]![0])} ${round(pts[0]![1])}`;
      for (let k = 0; k < bumps; k++) {
        const [x1, y1] = pts[k]!;
        const [x2, y2] = pts[(k + 1) % bumps]!;
        // Push the control point outwards from the centre, making a bump.
        const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
        const qx = cx + (mx - cx) * 1.62, qy = cy + (my - cy) * 1.68;
        d += ` Q ${round(qx)} ${round(qy)} ${round(x2)} ${round(y2)}`;
      }
      return d + " Z";
    }
  }
}

/** Extra marks inside a shape: the cross of an x-box, the tick of a check-box. */
export function shapeMarks(shape: ShapeKind, w: number, h: number, i = 2): string {
  const l = i, t = i, r = w - i, b = h - i;
  if (shape === "x-box") return `M ${l} ${t} L ${r} ${b} M ${r} ${t} L ${l} ${b}`;
  if (shape === "check-box") {
    const iw = r - l, ih = b - t;
    return `M ${l + iw * 0.25} ${t + ih * 0.52} L ${l + iw * 0.43} ${t + ih * 0.7} L ${l + iw * 0.76} ${t + ih * 0.3}`;
  }
  return "";
}

/** The size a new shape gets when it is placed with a click instead of drawn. */
export function defaultShapeSize(shape: ShapeKind): { width: number; height: number } {
  switch (shape) {
    case "rectangle":
    case "ellipse":
    case "cloud":
    case "arrow-right":
    case "arrow-left":
      return { width: 200, height: 120 };
    case "arrow-up":
    case "arrow-down":
      return { width: 120, height: 200 };
    case "rhombus":
    case "trapezoid":
      return { width: 220, height: 120 };
    default:
      return { width: 160, height: 160 };
  }
}
