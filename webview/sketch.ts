// Strokes for the canvas's geometric elements (shape and card outlines,
// edges, arrowheads), drawn with rough.js in a drawing style. Each element
// passes a seed from its id, so it keeps the same wobble on every redraw.
//
// Real freehand drawing, if it comes, would use perfect-freehand instead;
// rough.js stays the base for the structured elements.

import rough from "roughjs";
import { DRAWING_STYLES, type DrawingStyleName } from "./drawingStyles";

const generator = rough.generator();

/** SVG path data that traces `d` in the drawing style `style`. */
export function sketchPath(d: string, seed: number, style: DrawingStyleName): string {
  if (!d) return "";
  const drawable = generator.path(d, { ...DRAWING_STYLES[style], seed });
  return generator
    .toPaths(drawable)
    .map((p) => p.d)
    .join(" ");
}
