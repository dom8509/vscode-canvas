// Drawing styles, as in Excalidraw. The canvas data only names a style
// ("architect", "artist" or "cartoonist"); what a style looks like is decided
// here, in the rendering layer, so the same canvas can be drawn clean or sketchy
// without changing its data.

export type DrawingStyleName = "architect" | "artist" | "cartoonist";

export const DRAWING_STYLE_NAMES: DrawingStyleName[] = ["architect", "artist", "cartoonist"];

/** The style used when neither the element, the canvas nor the settings name one. */
export const DEFAULT_DRAWING_STYLE: DrawingStyleName = "artist";

/**
 * How lines of a style are drawn, as rough.js options. Room for more later:
 * stroke width, fill style, roundness, stroke color.
 */
export interface DrawingStyle {
  /** How far lines stray from their path. 0 is a clean, technical line. */
  roughness: number;
  /** How much straight lines bend. */
  bowing: number;
  /** Draw each line once instead of twice, as a pen would on a ruler. */
  disableMultiStroke: boolean;
}

export const DRAWING_STYLES: Record<DrawingStyleName, DrawingStyle> = {
  architect: { roughness: 0, bowing: 0, disableMultiStroke: true },
  artist: { roughness: 1, bowing: 1, disableMultiStroke: false },
  cartoonist: { roughness: 2, bowing: 2, disableMultiStroke: false },
};

export function isDrawingStyle(v: unknown): v is DrawingStyleName {
  return DRAWING_STYLE_NAMES.includes(v as DrawingStyleName);
}

/**
 * The style to draw with: the first valid name of, from the most specific on,
 * the element's, the canvas's and the settings', else the default.
 */
export function resolveDrawingStyle(...names: unknown[]): DrawingStyleName {
  return names.find(isDrawingStyle) ?? DEFAULT_DRAWING_STYLE;
}

/**
 * Sets the style of a canvas element. A style equal to the one it would
 * inherit is left out of the file, so the element follows the canvas.
 */
export function setDrawingStyle(element: Record<string, unknown>, name: DrawingStyleName, inherited: DrawingStyleName): void {
  if (name === inherited) delete element.style;
  else element.style = name;
}

/** A stable seed for rough.js from an element's id, so it looks the same on every render. */
export function seedOf(id: string): number {
  let h = 2166136261;
  for (let k = 0; k < id.length; k++) h = Math.imul(h ^ id.charCodeAt(k), 16777619);
  return ((h >>> 0) % 2147483646) + 1;
}
