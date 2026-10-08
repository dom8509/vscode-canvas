// Small pictures for the toolbars and menus.

import type { ShapeKind } from "../src/jsonCanvas";
import { shapeMarks, shapePath } from "./shapes";

export function title(value: string): string {
  return value[0]!.toUpperCase() + value.slice(1);
}

/** A small picture of a shape for menus. */
export function shapeIcon(shape: ShapeKind): string {
  const marks = shapeMarks(shape, 24, 20, 2);
  return `<svg class="shape-icon" viewBox="0 0 24 20" width="24" height="20"><path d="${shapePath(shape, 24, 20, 2)}"/>${marks ? `<path d="${marks}"/>` : ""}</svg>`;
}

export function icon(name: string): string {
  const paths: Record<string, string> = {
    card: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9h10M7 13h7"/>',
    file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1"/><path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1"/>',
    type: '<path d="M5 6V4h14v2M12 4v16M9 20h6"/>',
    shapes: '<rect x="3" y="3" width="10" height="10" rx="2"/><circle cx="16.5" cy="16.5" r="4.5"/>',
    group: '<rect x="3" y="3" width="18" height="18" rx="2" stroke-dasharray="3 3"/><rect x="7" y="8" width="6" height="5" rx="1"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    fit: '<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/>',
    undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
    redo: '<path d="m15 14 5-5-5-5"/><path d="M20 9H9a5 5 0 0 0 0 10h3"/>',
    select: '<path d="M6 3l12 9-5.5 1.2L16 20l-2.5 1-2.6-6.6L6 18z"/>',
    hand: '<path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V11M11 10V4.5a1.5 1.5 0 0 1 3 0V11M14 10.5V6a1.5 1.5 0 0 1 3 0v8a7 7 0 0 1-7 7h-.5a6 6 0 0 1-4.6-2.2L3 15.6a1.5 1.5 0 0 1 2.3-1.9L8 16"/>',
    open: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  };
  return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths[name]}</svg>`;
}
