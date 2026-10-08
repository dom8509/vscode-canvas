// Sticky styles: a new card, shape or free text takes the look picked last, as a new connection does.

import type { NodeLook } from "../src/jsonCanvas";

/** The look picked last in the properties panel, with the color. Kept in the webview state, never in the file. */
export type NodeDefaults = Partial<NodeLook> & { color?: string };

/**
 * The part of `defaults` that fits a new element drawn as `shape`: a plain card, free text, a shape or a
 * stroke. A `closed` stroke is a custom shape and takes what a shape takes.
 */
export function pickNodeDefaults(defaults: NodeDefaults, shape: NodeLook["shape"], closed = false): NodeDefaults {
  const fits: (keyof NodeDefaults)[] =
    shape === "text"
      ? ["color", "fontFamily", "fontSize"]
      : shape === "card"
        ? ["color", "fontFamily", "fontSize", "strokeWidth"]
        : shape === "draw" && !closed
          ? ["color", "strokeWidth"]
          : ["color", "fill", "fontFamily", "fontSize", "strokeWidth"];
  return Object.fromEntries(fits.filter((k) => defaults[k] !== undefined).map((k) => [k, defaults[k]]));
}
