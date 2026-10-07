// Hand-drawn strokes, as in Excalidraw: each line is drawn with rough.js,
// seeded by the element's id so it keeps the same wobble on every redraw.

import rough from "roughjs";

const generator = rough.generator();

/** A stable seed for rough.js from an id. */
export function seedOf(id: string): number {
  let h = 2166136261;
  for (let k = 0; k < id.length; k++) h = Math.imul(h ^ id.charCodeAt(k), 16777619);
  return (h >>> 0) % 2147483646 + 1;
}

/** SVG path data that traces `d` twice with a slight wobble, like a pen sketch. */
export function sketchPath(d: string, seed: number, strokeWidth = 2): string {
  if (!d) return "";
  const drawable = generator.path(d, { seed, strokeWidth, roughness: 1, bowing: 1, fill: undefined });
  return generator
    .toPaths(drawable)
    .map((p) => p.d)
    .join(" ");
}
