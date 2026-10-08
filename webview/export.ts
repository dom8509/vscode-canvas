// Export of a canvas, or of its selection, as one SVG file that needs nothing
// outside itself. The cards, connections and strokes are clones of the board's
// own elements, in a foreignObject, with the board's stylesheet, the chosen
// paper, the handwriting font and the images inlined. A PNG is that SVG drawn
// on a canvas.

import { type CanvasData, type CanvasEdge, type CanvasNode, isPoint } from "../src/jsonCanvas";
import { type Rect, containsRect } from "./geometry";
import type { Paper } from "./theme";

/** The declarations of `#viewport[data-paper="…"]` in the board's stylesheet: the colors of one paper. */
export function paperVariables(css: string, paper: Paper): string {
  const block = new RegExp(`#viewport\\[data-paper="${paper}"\\]\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? "";
  return block
    .split(";")
    .map((d) => d.trim())
    .filter(Boolean)
    .map((d) => `${d};`)
    .join(" ");
}

/** `css` with every `url(…)` that `data` has a data URI for pointing at that data URI instead. */
export function inlineUrls(css: string, data: Record<string, string>): string {
  return css.replace(/url\(\s*(["']?)([^"')]+)\1\s*\)/g, (whole, _q: string, path: string) => (data[path] ? `url("${data[path]}")` : whole));
}

/**
 * What an export holds: the selection, with the cards inside a selected group and the connections
 * between what it holds; or, with nothing selected, every card and connection. Never a point.
 */
export function exportItems(data: CanvasData, selection: Set<string>): { nodes: CanvasNode[]; edges: CanvasEdge[] } {
  const cards = data.nodes.filter((n) => !isPoint(n));
  if (selection.size === 0) return { nodes: cards, edges: data.edges };
  const ids = new Set(cards.filter((n) => selection.has(n.id)).map((n) => n.id));
  for (const g of cards.filter((n) => n.type === "group" && selection.has(n.id))) {
    for (const n of cards) if (n.id !== g.id && containsRect(g, n)) ids.add(n.id);
  }
  return {
    nodes: cards.filter((n) => ids.has(n.id)),
    edges: data.edges.filter((e) => selection.has(e.id) || (ids.has(e.fromNode) && ids.has(e.toNode))),
  };
}

/** A standalone SVG document: its style, a background if given, and the board's elements in one foreignObject. */
export function svgDocument(o: { width: number; height: number; style: string; background: string | undefined; body: string }): string {
  const { width: w, height: h } = o;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    `<style>${o.style}</style>` +
    (o.background ? `<rect width="${w}" height="${h}" fill="${o.background}"/>` : "") +
    `<foreignObject x="0" y="0" width="${w}" height="${h}">${o.body}</foreignObject></svg>`
  );
}

export interface ExportOptions {
  background: boolean;
  paper: Paper;
}

/** The layers of the board, back to front, and the elements of each that belong to an export. */
const LAYERS: [string, string][] = [
  ["#groups", ".node"],
  ["#edges", ".edge"],
  ["#nodes", ".node"],
  ["#labels", ".edge-label"],
];

/** Parts of a card that only the editor needs: handles, hints, lock badges and click areas. */
const EDITOR_ONLY = ".connect, .resize, .rotate, .lock-badge, .hit, .type-text .placeholder";

/**
 * The SVG of `items`, cloned from the board in `world`. `css` is the board's stylesheet with its fonts
 * inlined, `images` the data URIs of the image files, `themeVars` the editor's own CSS variables.
 */
export function buildSvg(
  world: HTMLElement,
  items: { nodes: CanvasNode[]; edges: CanvasEdge[] },
  bounds: Rect,
  options: ExportOptions,
  css: string,
  images: Record<string, string>,
  themeVars: string,
): string {
  const ids = new Set([...items.nodes, ...items.edges].map((i) => i.id));
  const files = new Map(items.nodes.flatMap((n) => (n.type === "file" ? [[n.id, n.file] as const] : [])));
  const { width, height } = bounds;

  const root = document.createElement("div");
  root.setAttribute("style", `${themeVars} width: ${width}px; height: ${height}px; font-family: var(--vscode-font-family); font-size: var(--vscode-font-size, 13px);`);
  const viewport = document.createElement("div");
  viewport.id = "viewport";
  viewport.dataset.paper = options.paper;
  viewport.setAttribute("style", `position: relative; inset: auto; width: ${width}px; height: ${height}px; background: none;`);
  const clone = document.createElement("div");
  clone.id = "world";
  clone.setAttribute("style", `transform: translate(${-bounds.x}px, ${-bounds.y}px);`);
  for (const [layer, part] of LAYERS) {
    const source = world.querySelector(layer);
    if (!source) continue;
    const copy = source.cloneNode(false) as Element;
    for (const el of source.querySelectorAll<HTMLElement>(`:scope > ${part}`)) {
      if (!ids.has(el.dataset.id ?? "")) continue;
      const c = el.cloneNode(true) as HTMLElement;
      c.classList.remove("selected", "drop-target", "fading", "rebinding");
      c.querySelectorAll(EDITOR_ONLY).forEach((x) => x.remove());
      const file = files.get(el.dataset.id ?? "");
      if (file && images[file]) c.querySelectorAll("img").forEach((img) => img.setAttribute("src", images[file]!));
      copy.append(c);
    }
    clone.append(copy);
  }
  viewport.append(clone);
  root.append(viewport);

  const background = options.background ? (/--vscode-editor-background:\s*([^;]+);/.exec(paperVariables(css, options.paper))?.[1] ?? "#ffffff") : undefined;
  const style = `${css}\n#viewport[data-paper] { background: none; }`;
  return svgDocument({ width, height, style: escapeStyle(style), background, body: new XMLSerializer().serializeToString(root) });
}

/** CSS made safe inside an XML <style> element. */
function escapeStyle(css: string): string {
  return css.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** The SVG drawn on a canvas at `scale` times its size, as PNG bytes. Every resource in it is a data URI, so the canvas stays readable. */
export async function svgToPng(svg: string, width: number, height: number, scale: number): Promise<Uint8Array> {
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await img.decode();
  const canvas = new OffscreenCanvas(Math.round(width * scale), Math.round(height * scale));
  canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
  const blob = await canvas.convertToBlob({ type: "image/png" });
  return new Uint8Array(await blob.arrayBuffer());
}
