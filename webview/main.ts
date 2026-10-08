import {
  type CanvasData,
  type CanvasEdge,
  type CanvasNode,
  type EdgeStyle,
  type NodeLook,
  type ShapeKind,
  type FileNode,
  type GroupNode,
  type Side,
  type TextNode,
  FILLS,
  FONT_FAMILIES,
  FONT_SIZES,
  HEAD_SHAPES,
  LINE_STYLES,
  LINE_WIDTHS,
  PATH_STYLES,
  SHAPES,
  cssColor,
  edgeStyle,
  nodeLook,
  rotationOf,
  isImageFile,
  isLocked,
  setLocked,
  isImagePath,
  isTextPath,
  newId,
  parseCanvas,
  serializeCanvas,
  setEdgeStyle,
  setNodeLook,
  setRotation,
  setTextScale,
  textScaleOf,
  MAX_TEXT_SCALE,
  MIN_TEXT_SCALE,
} from "../src/jsonCanvas";
import type { DroppedItem, FileInfo, HostMessage, ImageData, WebviewMessage } from "../src/protocol";
import {
  type Point,
  type Rect,
  type View,
  anchor,
  center,
  boundsOf,
  containsRect,
  edgePath,
  fitView,
  gridAround,
  headPath,
  headSvg,
  rectFromPoints,
  type Pull,
  rectsIntersect,
  resizeAnchor,
  resizedCorner,
  rotatePoint,
  sideFacing,
  turnedBounds,
  turnedSide,
  snap,
  zoomAt,
} from "./geometry";
import { sectionText } from "../src/subpath";
import { type AlignEdge, type Guide, type LayerOp, align, distribute, reorder, scaleRects, snapGuides } from "./arrange";
import {
  DEFAULT_DRAWING_STYLE,
  DRAWING_STYLE_NAMES,
  type DrawingStyleName,
  isDrawingStyle,
  resolveDrawingStyle,
  seedOf,
  setDrawingStyle,
} from "./drawingStyles";
import { sketchPath } from "./sketch";
import { escapeHtml, renderMarkdown, stripFrontMatter } from "./markdown";
import { defaultShapeSize, shapeMarks, shapePath } from "./shapes";
import { icon, shapeIcon, title } from "./icons";
import { SELECT, type Tool, showTool, toolbarHtml } from "./toolbar";
import { matchesShortcut, tooltip } from "./shortcuts";
import { isShortcutPanelOpen, shortcutPanelHtml, toggleShortcutPanel } from "./shortcutPanel";
import { closeContextMenu, isContextMenuOpen, openContextMenu } from "./contextMenu";
import { menuItems } from "./contextMenuItems";
import { resolveTheme } from "./theme";
import { type NodeDefaults, pickNodeDefaults } from "./nodeDefaults";
import { coalescer } from "./coalesce";

declare function acquireVsCodeApi(): {
  postMessage(msg: WebviewMessage): void;
  getState(): unknown;
  setState(state: unknown): void;
};

const vscode = acquireVsCodeApi();
const post = (msg: WebviewMessage) => vscode.postMessage(msg);

const GRID = 20;
const SIDES: Side[] = ["top", "right", "bottom", "left"];
const SVG_NS = "http://www.w3.org/2000/svg";
/** How much of a note a card shows. */
const PREVIEW_CHARS = 4000;
const WIDTHS: Record<EdgeStyle["lineWidth"], number> = { thin: 1.5, normal: 2.5, bold: 4.5, extra: 7 };
const FILL_ICONS: Record<string, string> = {
  none: '<rect x="5" y="3" width="18" height="16" rx="3" fill="none"/>',
  semi: '<rect x="5" y="3" width="18" height="16" rx="3" fill="currentColor" fill-opacity="0.3"/>',
  solid: '<rect x="5" y="3" width="18" height="16" rx="3" fill="currentColor"/>',
};

// ---------------------------------------------------------------- state

let data: CanvasData = { nodes: [], edges: [] };
let view: View = { x: 0, y: 0, zoom: 1 };
let loaded = false;
const selection = new Set<string>();
let editing: string | null = null;
const files = new Map<string, FileInfo>();
const requestedFiles = new Set<string>();
let spaceHeld = false;
let lastPointer: Point = { x: 0, y: 0 };
let clipboard: { nodes: CanvasNode[]; edges: CanvasEdge[] } | null = null;
/** The drawing style from the VS Code settings. A canvas and its elements can name their own. */
let settingsStyle: DrawingStyleName = DEFAULT_DRAWING_STYLE;
/** The `canvas.theme` setting: auto, light or dark. */
let themeSetting = "auto";

const saved = vscode.getState() as { view?: View; edgeDefaults?: Partial<EdgeStyle>; nodeDefaults?: NodeDefaults } | undefined;
if (saved?.view) view = saved.view;
/** The look last picked in the style bar. New edges get it, as in Excalidraw. */
let edgeDefaults: Partial<EdgeStyle> = saved?.edgeDefaults ?? {};
/** The color and look last picked for cards. New cards, shapes and free text get what fits them. */
let nodeDefaults: NodeDefaults = saved?.nodeDefaults ?? {};

/** Keeps the view and the sticky styles over a reload of the webview. */
function saveState(): void {
  vscode.setState({ view, edgeDefaults, nodeDefaults });
}

// ---------------------------------------------------------------- DOM

const app = document.getElementById("app")!;
app.innerHTML = `
  <div id="viewport" tabindex="0">
    <div id="world">
      <div id="groups"></div>
      <svg id="edges"></svg>
      <div id="nodes"></div>
      <div id="labels"></div>
      <div id="selection-box" hidden></div>
      <svg id="guides"></svg>
    </div>
    <div id="marquee" hidden></div>
    <div id="empty-hint" hidden>Double-click to write · T text · R O shapes · drop files here · ? shortcuts</div>
  </div>
  <div id="error" hidden>
    <p></p>
    <button data-action="source">Open as text</button>
  </div>
  ${toolbarHtml()}
  <div id="props" hidden>
    <section>
      <h3>Color</h3>
      <div class="swatches">
        <button data-color="" title="No color" class="swatch none"></button>
        ${["1", "2", "3", "4", "5", "6"].map((c) => `<button data-color="${c}" class="swatch" style="--swatch: ${cssColor(c)}"></button>`).join("")}
        <label class="swatch custom" title="Custom color"><input type="color"></label>
      </div>
    </section>
    <section class="shape-tools">
      <h3>Shape</h3>
      <div class="pickers"><button class="picker" data-menu="shape" title="Shape"></button></div>
      ${segmentedLook("fill", FILLS)}
    </section>
    <section class="border-tools">
      <h3>Border</h3>
      ${segmentedLook("strokeWidth", LINE_WIDTHS)}
    </section>
    <section class="text-tools">
      <h3>Text</h3>
      ${segmentedLook("fontFamily", FONT_FAMILIES)}
      ${segmentedLook("fontSize", FONT_SIZES)}
    </section>
    <section class="edge-tools">
      <h3>Line</h3>
      ${segmented("lineStyle", LINE_STYLES)}
      ${segmented("lineWidth", LINE_WIDTHS)}
    </section>
    <section class="edge-tools">
      <h3>Arrow</h3>
      ${segmented("pathStyle", PATH_STYLES)}
      <div class="pickers">
        <button class="picker" data-menu="fromHead" title="Start"></button>
        <button class="picker" data-menu="toHead" title="End"></button>
      </div>
    </section>
    <section class="arrange-tools">
      <h3>Align</h3>
      <div class="segmented">${(["left", "center", "right"] as const).map((v) => `<button data-align="${v}" title="Align ${v}">${icon(`align-${v}`)}</button>`).join("")}</div>
      <div class="segmented">${(["top", "middle", "bottom"] as const).map((v) => `<button data-align="${v}" title="Align ${v}">${icon(`align-${v}`)}</button>`).join("")}</div>
      <div class="segmented distribute-tools">${(["horizontal", "vertical"] as const).map((v) => `<button data-distribute="${v}" title="Distribute ${v}ly">${icon(`distribute-${v}`)}</button>`).join("")}</div>
    </section>
    <section>
      <h3>Style</h3>
      <div class="segmented">${DRAWING_STYLE_NAMES.map((v) => `<button data-drawing="${v}" title="${title(v)}">${drawingStyleIcon(v)}</button>`).join("")}</div>
    </section>
    <section class="actions">
      <button class="action" data-action="lock"></button>
      <button class="action danger" data-action="delete" title="${tooltip("delete")}">${icon("trash")}<span>Delete</span></button>
    </section>
    <div id="head-menu" hidden></div>
  </div>
  <div id="zoombar">
    <button data-action="zoom-in" title="${tooltip("zoomIn")}">${icon("plus")}</button>
    <button data-action="zoom-reset" id="zoom-level" title="${tooltip("zoomReset", "Reset zoom")}">100%</button>
    <button data-action="zoom-out" title="${tooltip("zoomOut")}">${icon("minus")}</button>
    <button data-action="fit" title="${tooltip("fit")}">${icon("fit")}</button>
    <button data-action="canvas-style" id="canvas-style"></button>
    <button data-action="undo" title="${tooltip("undo")}">${icon("undo")}</button>
    <button data-action="redo" title="${tooltip("redo")}">${icon("redo")}</button>
    <button data-action="help" title="${tooltip("help")}">${icon("help")}</button>
  </div>
  ${shortcutPanelHtml()}
`;

const viewport = document.getElementById("viewport")!;
const world = document.getElementById("world")!;
const groupsLayer = document.getElementById("groups")!;
const nodesLayer = document.getElementById("nodes")!;
const edgesLayer = document.getElementById("edges") as unknown as SVGSVGElement;
const labelsLayer = document.getElementById("labels")!;
const guidesLayer = document.getElementById("guides") as unknown as SVGSVGElement;
const selectionBox = document.getElementById("selection-box")!;
const marquee = document.getElementById("marquee")!;
const errorBox = document.getElementById("error")!;
const props = document.getElementById("props")!;
const headMenu = document.getElementById("head-menu")!;
const shapeMenu = document.getElementById("shape-menu")!;
const toolbar = document.getElementById("toolbar")!;
const zoomLevel = document.getElementById("zoom-level")!;
const emptyHint = document.getElementById("empty-hint")!;


/** The SVG stroke settings of an edge's line. */
function strokeOf(style: EdgeStyle): { width: number; dash: string } {
  const w = WIDTHS[style.lineWidth];
  const dash = style.lineStyle === "dashed" ? `${w * 3} ${w * 2.5}` : style.lineStyle === "dotted" ? `0 ${w * 2.4}` : "";
  return { width: w, dash };
}

/** A small picture of an edge for the style bar. Only the given parts differ from a plain edge. */
function styleIcon(part: Partial<EdgeStyle>): string {
  const style: EdgeStyle = { fromHead: "none", toHead: "none", lineStyle: "solid", lineWidth: "normal", pathStyle: "straight", ...part };
  const { width, dash } = strokeOf(style);
  let d = "M 5 11 L 27 11";
  if (part.pathStyle === "straight") d = "M 5 16 L 27 6";
  if (part.pathStyle === "curved") d = "M 5 16 C 14 16, 18 6, 27 6";
  if (part.pathStyle === "elbow") d = "M 5 16 L 16 16 L 16 6 L 27 6";
  const heads =
    headSvg(style.fromHead, { x: 4, y: 11 }, { x: -1, y: 0 }, 9) + headSvg(style.toHead, { x: 28, y: 11 }, { x: 1, y: 0 }, 9);
  return `<svg class="style-icon" viewBox="0 0 32 22" width="32" height="22" style="--edge-width: ${Math.min(width * 0.8, 5)}px">
    <path class="stroke" d="${d}" stroke-dasharray="${dash}"/>${heads}</svg>`;
}

/** A row of joined buttons in the properties panel, one per value of an edge style. */
function segmented(key: keyof EdgeStyle, values: readonly string[]): string {
  const buttons = values
    .map((v) => `<button data-style="${key}" data-value="${v}" title="${title(v)}">${styleIcon({ [key]: v })}</button>`)
    .join("");
  return `<div class="segmented">${buttons}</div>`;
}

/** A wavy line drawn in a drawing style: clean, a little sketchy or very sketchy. */
function drawingStyleIcon(style: DrawingStyleName): string {
  const d = sketchPath("M 4 15 C 9 4, 15 4, 17 11 S 22 18, 26 7", 7, style);
  return `<svg class="style-icon drawing-icon" viewBox="0 0 30 22" width="30" height="22"><path d="${d}"/></svg>`;
}

/** The drawing style of the whole canvas: its own, else the settings'. */
function canvasStyle(): DrawingStyleName {
  return resolveDrawingStyle(data.style, settingsStyle);
}

/** The drawing style of a node or edge: its own, else the canvas's. */
function styleOf(element: CanvasNode | CanvasEdge): DrawingStyleName {
  return resolveDrawingStyle(element.style, canvasStyle());
}

/** A row of joined buttons for the look of shapes and text. */
function segmentedLook(key: keyof NodeLook, values: readonly string[]): string {
  const buttons = values
    .map((v) => {
      const face =
        key === "fill"
          ? `<svg class="style-icon" viewBox="0 0 28 22"><g stroke="currentColor" stroke-width="1.8">${FILL_ICONS[v]}</g></svg>`
          : key === "strokeWidth"
            ? styleIcon({ lineWidth: v as EdgeStyle["lineWidth"] })
            : key === "fontFamily"
              ? `<span class="ff-sample ff-${v}">Aa</span>`
              : `<span class="size-label">${v.toUpperCase()}</span>`;
      const names: Record<string, string> = {
        s: "Small", m: "Medium", l: "Large", xl: "Extra large",
        sans: "Sans serif", serif: "Serif", mono: "Monospace", hand: "Handwriting",
        thin: "Thin", normal: "Normal", bold: "Bold", extra: "Extra bold",
      };
      const name = key === "fill" ? `${title(v)} fill` : names[v];
      return `<button data-look="${key}" data-value="${v}" title="${name}">${face}</button>`;
    })
    .join("");
  return `<div class="segmented">${buttons}</div>`;
}

// ---------------------------------------------------------------- helpers

function nodeById(id: string): CanvasNode | undefined {
  return data.nodes.find((n) => n.id === id);
}

function edgeById(id: string): CanvasEdge | undefined {
  return data.edges.find((e) => e.id === id);
}

function toWorld(clientX: number, clientY: number): Point {
  const r = viewport.getBoundingClientRect();
  return { x: (clientX - r.left - view.x) / view.zoom, y: (clientY - r.top - view.y) / view.zoom };
}

function viewportCenter(): Point {
  const r = viewport.getBoundingClientRect();
  return toWorld(r.left + r.width / 2, r.top + r.height / 2);
}

function selectedNodes(): CanvasNode[] {
  return data.nodes.filter((n) => selection.has(n.id));
}

/** Nodes that lie fully inside a group: they move with it. */
function childrenOf(group: CanvasNode): CanvasNode[] {
  return data.nodes.filter((n) => n.id !== group.id && containsRect(group, n));
}

// ---------------------------------------------------------------- saving

function snapshot(): string {
  return serializeCanvas(data);
}

/** Writes the canvas to the document and redraws. Undo and redo are VS Code's, on that document. */
function commit(): void {
  nudges.flush();
  post({ type: "edit", text: snapshot() });
  render();
}

/** The canvas after the last arrow-key nudge, written when the nudges stop: nudges in a row are one undo step. */
let nudged = "";
const nudges = coalescer(() => post({ type: "edit", text: nudged }), 500);

// Write a waiting nudge before the canvas can be saved, closed or left.
window.addEventListener("blur", () => nudges.flush());
document.addEventListener("visibilitychange", () => nudges.flush());

// ---------------------------------------------------------------- view

function applyView(): void {
  world.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`;
  viewport.style.backgroundPosition = `${view.x}px ${view.y}px`;
  viewport.style.backgroundSize = `${GRID * view.zoom}px ${GRID * view.zoom}px`;
  viewport.classList.toggle("far", view.zoom < 0.5);
  zoomLevel.textContent = `${Math.round(view.zoom * 100)}%`;
  saveState();
}

/** Light or dark paper, by the setting and the VS Code theme. The file does not change. */
function applyPaper(): void {
  viewport.dataset.paper = resolveTheme(themeSetting, document.body.className);
}

// VS Code changes the body's classes when the person switches theme.
new MutationObserver(applyPaper).observe(document.body, { attributes: true, attributeFilter: ["class"] });

function zoomBy(factor: number, at?: Point): void {
  const r = viewport.getBoundingClientRect();
  view = zoomAt(view, view.zoom * factor, at ?? { x: r.width / 2, y: r.height / 2 });
  applyView();
}

function fitToContent(nodes: CanvasNode[] = data.nodes): void {
  const r = viewport.getBoundingClientRect();
  const b = boundsOf(nodes);
  if (!b) {
    view = { x: r.width / 2, y: r.height / 2, zoom: 1 };
  } else {
    view = fitView(b, r.width, r.height);
  }
  applyView();
}

// ---------------------------------------------------------------- rendering

function render(): void {
  emptyHint.hidden = data.nodes.length > 0;
  renderNodes();
  renderEdges();
  updateSelectionBox();
  updateColorbar();
  updateCanvasStyleButton();
}

function renderNodes(): void {
  groupsLayer.replaceChildren();
  nodesLayer.replaceChildren();
  const missing: string[] = [];
  for (const node of data.nodes) {
    const el = document.createElement("div");
    el.className = `node type-${node.type}`;
    el.dataset.id = node.id;
    el.classList.toggle("selected", selection.has(node.id));
    el.classList.toggle("locked", isLocked(node));
    const color = cssColor(node.color);
    if (color) el.style.setProperty("--node-color", color);
    el.classList.toggle("colored", !!color);
    placeNode(el, node);

    if (node.type === "group") {
      renderGroup(el, node);
      groupsLayer.append(el);
    } else {
      const body = document.createElement("div");
      body.className = "content";
      el.append(body);
      if (node.type === "text" || node.type === "file") {
        const look = nodeLook(node);
        if (look.fontSize) el.classList.add(`font-${look.fontSize}`);
        if (look.fontFamily !== "sans") el.classList.add(`ff-${look.fontFamily}`);
        if (look.strokeWidth !== "normal") el.classList.add(`stroke-${look.strokeWidth}`);
      }
      if (node.type === "text") {
        const look = nodeLook(node);
        if (look.shape === "text") el.classList.add("free-text");
        else if (look.shape !== "card") el.classList.add("shape", `fill-${look.fill}`);
        const empty = look.shape === "card" ? '<p class="placeholder">Double-click to write</p>' : "";
        body.innerHTML = renderMarkdown(node.text) || empty;
      } else if (node.type === "file") {
        renderFile(el, body, node, missing);
      } else {
        renderLink(el, body, node.url);
      }
      nodesLayer.append(el);
    }
    drawOutline(el, node);
    if (isLocked(node)) el.insertAdjacentHTML("beforeend", `<div class="lock-badge" title="Locked">${icon("lock")}</div>`);

    for (const side of SIDES) {
      const h = document.createElement("div");
      h.className = `connect side-${side}`;
      h.dataset.side = side;
      el.append(h);
    }
    for (const [dir, dx, dy] of RESIZE_HANDLES) {
      const h = document.createElement("div");
      h.className = `resize resize-${dir}`;
      h.dataset.dx = String(dx);
      h.dataset.dy = String(dy);
      el.append(h);
    }
    if (canRotate(node)) {
      const turn = document.createElement("div");
      turn.className = "rotate";
      turn.title = "Drag to turn (Shift: 15° steps)";
      el.append(turn);
    }
  }
  if (missing.length) post({ type: "resolve", paths: missing });
  if (editing) startEditing(editing);
}

function placeNode(el: HTMLElement, node: CanvasNode): void {
  el.style.left = `${node.x}px`;
  el.style.top = `${node.y}px`;
  el.style.width = `${node.width}px`;
  el.style.height = `${node.height}px`;
  const turn = rotationOf(node);
  el.style.transform = turn ? `rotate(${turn}deg)` : "";
  const scale = isFreeText(node) ? textScaleOf(node) : 1;
  if (scale !== 1) el.style.setProperty("--text-scale", String(scale));
  else el.style.removeProperty("--text-scale");
  if (el.dataset.drawn) drawOutline(el, node);
}

/** The hand-drawn outline of a card or shape, redrawn when its size changes. Free text has none. */
function drawOutline(el: HTMLElement, node: CanvasNode): void {
  if (el.classList.contains("free-text")) return;
  const shaped = el.classList.contains("shape");
  const shape = (shaped ? nodeLook(node).shape : "rectangle") as ShapeKind;
  const { width: w, height: h } = node;
  const style = styleOf(node);
  const key = `${shape} ${w} ${h} ${style}`;
  if (el.dataset.drawn === key) return;
  el.dataset.drawn = key;
  const seed = seedOf(node.id);
  const outline = shapePath(shape, w, h, 2);
  const marks = shapeMarks(shape, w, h, 2);
  const svg = `<svg class="shape-outline" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
    ${shaped ? `<path class="outline" d="${outline}"/>` : ""}<path class="sketch" d="${sketchPath(outline, seed, style)}"/>${
      marks ? `<path class="marks" d="${sketchPath(marks, seed + 1, style)}"/>` : ""
    }</svg>`;
  el.querySelector(".shape-outline")?.remove();
  el.insertAdjacentHTML("afterbegin", svg);
}

/** The resize handles: four corners and four sides, with the way each one pulls. */
const RESIZE_HANDLES: [string, Pull, Pull][] = [
  ["nw", -1, -1], ["n", 0, -1], ["ne", 1, -1], ["e", 1, 0],
  ["se", 1, 1], ["s", 0, 1], ["sw", -1, 1], ["w", -1, 0],
];

selectionBox.innerHTML = RESIZE_HANDLES.map(([dir, dx, dy]) => `<div class="resize resize-${dir}" data-dx="${dx}" data-dy="${dy}"></div>`).join("");

/** Two or more selected cards share one box with eight handles, instead of the handles of each card. */
function updateSelectionBox(): void {
  const nodes = selectedNodes();
  const b = nodes.length >= 2 && editing === null ? boundsOf(nodes.map(outlineOf)) : undefined;
  viewport.classList.toggle("multi", !!b);
  selectionBox.hidden = !b;
  if (!b) return;
  selectionBox.classList.toggle("locked", nodes.some(isLocked));
  Object.assign(selectionBox.style, { left: `${b.x}px`, top: `${b.y}px`, width: `${b.width}px`, height: `${b.height}px` });
}

/** Free text is as big as its text, as in Excalidraw. Once resized by hand it keeps its width and wraps. */
const measurer = document.createElement("div");
measurer.className = "node free-text measure";

function measureText(node: CanvasNode, html: string, width?: number): { width: number; height: number } {
  const look = nodeLook(node);
  measurer.className = `node free-text measure font-${look.fontSize} ff-${look.fontFamily}`;
  measurer.style.setProperty("--text-scale", String(textScaleOf(node)));
  measurer.innerHTML = `<div class="content">${html || "&#8203;"}</div>`;
  if (!measurer.isConnected) nodesLayer.append(measurer);
  const content = measurer.firstElementChild as HTMLElement;
  if (width !== undefined) content.style.cssText = `width: ${width - 2}px; max-width: none`;
  return { width: Math.ceil(content.offsetWidth) + 2, height: Math.ceil(content.offsetHeight) + 2 };
}

function isFreeText(node: CanvasNode): node is TextNode {
  return node.type === "text" && nodeLook(node).shape === "text";
}

/** Free text whose width was set by hand: it wraps instead of growing. */
function hasFixedWidth(node: CanvasNode): boolean {
  return node.autoSize === false;
}

function fitFreeText(node: CanvasNode): void {
  if (!isFreeText(node)) return;
  if (hasFixedWidth(node)) {
    node.height = Math.max(20, node.height, measureText(node, renderMarkdown(node.text), node.width).height);
    return;
  }
  const size = measureText(node, renderMarkdown(node.text));
  node.width = Math.max(30, size.width);
  node.height = Math.max(20, size.height);
}

function renderGroup(el: HTMLElement, node: GroupNode): void {
  const label = document.createElement("div");
  label.className = "group-label";
  label.textContent = node.label ?? "";
  label.title = "Double-click to rename";
  el.append(label);
}

function renderFile(el: HTMLElement, body: HTMLElement, node: FileNode, missing: string[]): void {
  const name = node.file.split("/").pop() ?? node.file;
  const header = document.createElement("div");
  header.className = "file-name";
  header.textContent = name.replace(/\.md$/i, "") + (node.subpath ?? "");
  header.title = `${node.file}\nDouble-click to open`;
  el.prepend(header);

  const info = files.get(node.file);
  if (!info) {
    if (!requestedFiles.has(node.file)) {
      requestedFiles.add(node.file);
      missing.push(node.file);
    }
    body.innerHTML = '<p class="placeholder">Loading…</p>';
    return;
  }
  switch (info.kind) {
    case "image": {
      el.classList.add("image");
      const img = document.createElement("img");
      img.src = info.src;
      img.draggable = false;
      body.append(img);
      break;
    }
    case "text": {
      if (!/\.(md|markdown)$/i.test(node.file)) {
        body.innerHTML = `<pre><code>${escapeHtml(info.text.slice(0, PREVIEW_CHARS))}</code></pre>`;
        break;
      }
      // "Note.md#Heading" or "#^block" shows only that part of the note, as in Obsidian.
      const text = sectionText(info.text, node.subpath);
      body.innerHTML =
        text === undefined
          ? `<p class="placeholder">No ${escapeHtml(node.subpath!)} in this note.</p>`
          : renderMarkdown(stripFrontMatter(text).slice(0, PREVIEW_CHARS));
      break;
    }
    case "other":
      body.innerHTML = `<p class="placeholder">${escapeHtml(node.file)}</p>`;
      break;
    case "missing":
      el.classList.add("missing");
      body.innerHTML = `<p class="placeholder">File not found: ${escapeHtml(node.file)}</p>`;
      break;
  }
}

function renderLink(el: HTMLElement, body: HTMLElement, url: string): void {
  let host = url;
  try {
    host = new URL(url).host || url;
  } catch {
    // Keep the text as it is.
  }
  body.innerHTML = `
    <div class="link-host">${escapeHtml(host)}</div>
    <div class="link-url">${escapeHtml(url) || '<span class="placeholder">Double-click to enter a URL</span>'}</div>
    ${url ? `<button class="link-open" data-href="${escapeHtml(url)}" title="Open in browser">${icon("open")} Open</button>` : ""}
  `;
}

/** Where an edge starts and ends, and how it bends. */
function edgeGeometry(edge: CanvasEdge) {
  const from = nodeById(edge.fromNode);
  const to = nodeById(edge.toNode);
  if (!from || !to) return undefined;
  const fromSide = edge.fromSide ?? facingSide(from, center(to));
  const toSide = edge.toSide ?? facingSide(to, center(from));
  return edgePath(
    nodeAnchor(from, fromSide),
    turnedSide(fromSide, rotationOf(from)),
    nodeAnchor(to, toSide),
    turnedSide(toSide, rotationOf(to)),
    edgeStyle(edge).pathStyle,
  );
}

// A turned card keeps its box in the file; its sides turn with it.

/** Where an edge meets a side of a card, turned with the card. */
function nodeAnchor(node: CanvasNode, side: Side): Point {
  return rotatePoint(anchor(node, side), center(node), rotationOf(node));
}

/** The side of a card, in its own turned frame, that faces the point `p`. */
function facingSide(node: CanvasNode, p: Point): Side {
  return sideFacing(node, rotatePoint(p, center(node), -rotationOf(node)));
}

/** Every card can be turned by its handle, as in tldraw. Groups stay upright, so what they hold stays inside. */
function canRotate(node: CanvasNode): boolean {
  return node.type !== "group";
}

function renderEdges(): void {
  edgesLayer.replaceChildren();
  labelsLayer.replaceChildren();
  for (const edge of data.edges) drawEdge(edge);
}

/** Redraws only the connections of the given cards, so a drag on a big canvas stays smooth. */
function redrawEdgesOf(ids: Set<string>): void {
  for (const edge of data.edges) {
    if (!ids.has(edge.fromNode) && !ids.has(edge.toNode)) continue;
    world.querySelectorAll(`#edges [data-id="${CSS.escape(edge.id)}"], #labels [data-id="${CSS.escape(edge.id)}"]`).forEach((el) => el.remove());
    drawEdge(edge);
  }
}

function drawEdge(edge: CanvasEdge): void {
  const geo = edgeGeometry(edge);
  if (!geo) return;
  const g = document.createElementNS(SVG_NS, "g");
  g.classList.add("edge");
  g.dataset.id = edge.id;
  if (selection.has(edge.id)) g.classList.add("selected");
  const color = cssColor(edge.color);
  if (color) g.style.setProperty("--edge-color", color);
  const style = edgeStyle(edge);
  const { width, dash } = strokeOf(style);
  g.style.setProperty("--edge-width", `${width}px`);

  const hit = document.createElementNS(SVG_NS, "path");
  hit.setAttribute("d", geo.d);
  hit.classList.add("hit");
  const path = document.createElementNS(SVG_NS, "path");
  const drawing = styleOf(edge);
  const seed = seedOf(edge.id);
  path.setAttribute("d", sketchPath(geo.d, seed, drawing));
  path.classList.add("line");
  if (dash) path.setAttribute("stroke-dasharray", dash);
  g.append(hit, path);

  const size = 8 + width * 2;
  // Heads are sketched like the line: a filled head gets a plain fill under its sketched outline.
  for (const [k, head] of [headPath(style.toHead, geo.end, geo.endDir, size), headPath(style.fromHead, geo.start, geo.startDir, size)].entries()) {
    if (!head) continue;
    if (head.filled) g.insertAdjacentHTML("beforeend", `<path class="fill" d="${head.d}"/>`);
    g.insertAdjacentHTML("beforeend", `<path class="stroke head" d="${sketchPath(head.d, seed + 1 + k, drawing)}"/>`);
  }
  edgesLayer.append(g);

  if (isLocked(edge)) {
    const badge = document.createElement("div");
    badge.className = "lock-badge edge-lock";
    badge.dataset.id = edge.id;
    badge.classList.toggle("selected", selection.has(edge.id));
    badge.innerHTML = icon("lock");
    badge.style.left = `${geo.mid.x}px`;
    badge.style.top = `${geo.mid.y + (edge.label ? 22 : 0)}px`;
    g.addEventListener("pointerenter", () => badge.classList.add("hover"));
    g.addEventListener("pointerleave", () => badge.classList.remove("hover"));
    labelsLayer.append(badge);
  }

  if (edge.label) {
    const label = document.createElement("div");
    label.className = "edge-label";
    label.dataset.id = edge.id;
    label.classList.toggle("selected", selection.has(edge.id));
    if (color) label.style.setProperty("--edge-color", color);
    label.textContent = edge.label;
    label.style.left = `${geo.mid.x}px`;
    label.style.top = `${geo.mid.y}px`;
    labelsLayer.append(label);
  }
}


/** Shows a changed selection without redrawing, so the elements under the pointer stay the same (a double-click needs that). */
function showSelection(): void {
  world.querySelectorAll<HTMLElement>(".node, .edge, .edge-label, .edge-lock").forEach((el) => {
    el.classList.toggle("selected", selection.has(el.dataset.id!));
  });
  updateColorbar();
  updateSelectionBox();
}

function updateColorbar(): void {
  props.hidden = selection.size === 0 || editing !== null;
  const items = [...selection].map((id) => nodeById(id) ?? edgeById(id)).filter(Boolean);
  // A locked selection shows its look, but only the lock can be changed.
  const locked = selectionLocked();
  props.classList.toggle("locked", locked);
  props.querySelectorAll<HTMLButtonElement | HTMLInputElement>("button, input").forEach((b) => {
    b.disabled = locked && b.dataset.action !== "lock";
  });
  const lockButton = props.querySelector<HTMLElement>('[data-action="lock"]')!;
  lockButton.innerHTML = `${icon(locked ? "unlock" : "lock")}<span>${locked ? "Unlock" : "Lock"}</span>`;
  lockButton.title = tooltip("lock", locked ? "Unlock" : "Lock");
  const colors = new Set(items.map((i) => i!.color ?? ""));
  const current = colors.size === 1 ? [...colors][0]! : null;
  props.querySelectorAll<HTMLElement>("[data-color]").forEach((b) => {
    b.classList.toggle("active", b.dataset.color === current);
  });

  // The edge properties show when edges are selected. A value all of them share is marked.
  const styles = [...selection].map(edgeById).filter((e): e is CanvasEdge => !!e).map(edgeStyle);
  props.classList.toggle("has-edges", styles.length > 0);
  const cardCount = selectedNodes().length;
  props.classList.toggle("can-align", cardCount >= 2);
  props.classList.toggle("can-distribute", cardCount >= 3);
  const shared = <K extends keyof EdgeStyle>(key: K): EdgeStyle[K] | undefined =>
    styles.every((s) => s[key] === styles[0]?.[key]) ? styles[0]?.[key] : undefined;
  props.querySelectorAll<HTMLElement>("[data-style]").forEach((b) => {
    b.classList.toggle("active", shared(b.dataset.style as keyof EdgeStyle) === b.dataset.value);
  });
  // Text, border and shape properties, for the text and file cards they apply to. Pictures have no text to set.
  const styled = [...selection].map(nodeById).filter((n): n is CanvasNode => n?.type === "text" || n?.type === "file");
  const looks = styled.filter((n) => !(n.type === "file" && isImagePath(n.file))).map(nodeLook);
  const shapes = looks.filter((l) => l.shape !== "card" && l.shape !== "text");
  const bordered = styled.map(nodeLook).filter((l) => l.shape !== "text");
  props.classList.toggle("has-shapes", shapes.length > 0);
  props.classList.toggle("has-text", looks.length > 0);
  props.classList.toggle("has-border", bordered.length > 0);
  const sharedLook = <K extends keyof NodeLook>(list: NodeLook[], key: K): NodeLook[K] | undefined =>
    list.every((l) => l[key] === list[0]?.[key]) ? list[0]?.[key] : undefined;
  const lookList: Record<keyof NodeLook, NodeLook[]> = {
    shape: shapes,
    fill: shapes,
    strokeWidth: bordered,
    fontSize: looks,
    fontFamily: looks,
  };
  props.querySelectorAll<HTMLElement>("[data-look]").forEach((b) => {
    const key = b.dataset.look as keyof NodeLook;
    b.classList.toggle("active", sharedLook(lookList[key], key) === b.dataset.value);
  });
  const drawings = new Set(items.map((i) => styleOf(i!)));
  const sharedDrawing = drawings.size === 1 ? [...drawings][0] : undefined;
  props.querySelectorAll<HTMLElement>("[data-drawing]").forEach((b) => {
    b.classList.toggle("active", b.dataset.drawing === sharedDrawing);
  });
  const shapePicker = props.querySelector<HTMLElement>('[data-menu="shape"]')!;
  const sharedShape = sharedLook(shapes, "shape");
  shapePicker.innerHTML = `${sharedShape ? shapeIcon(sharedShape as ShapeKind) : "<span>Mixed</span>"}<span class="caret"></span>`;

  for (const key of ["fromHead", "toHead"] as const) {
    const value = shared(key);
    const picker = props.querySelector<HTMLElement>(`[data-menu="${key}"]`)!;
    picker.innerHTML = `${styleIcon({ [key]: value ?? "arrow" })}<span class="caret"></span>`;
    picker.title = `${key === "fromHead" ? "Start" : "End"}: ${value ? title(value) : "mixed"}`;
  }
  if ((!styles.length && !shapes.length) || props.hidden) closeHeadMenu();
}

/** The small menu of arrowheads beside the panel, as tldraw's dropdown pickers. */
function toggleHeadMenu(picker: HTMLElement): void {
  const key = picker.dataset.menu as "fromHead" | "toHead" | "shape";
  if (!headMenu.hidden && headMenu.dataset.for === key) return closeHeadMenu();
  headMenu.dataset.for = key;
  headMenu.classList.toggle("wide", key === "shape");
  headMenu.innerHTML =
    key === "shape"
      ? SHAPES.map((v) => `<button data-look="shape" data-value="${v}" title="${title(v.replace("-", " "))}">${shapeIcon(v)}</button>`).join("")
      : HEAD_SHAPES.map(
          (v) => `<button data-style="${key}" data-value="${v}" title="${title(v)}">${styleIcon({ [key]: v })}</button>`,
        ).join("");
  headMenu.style.top = `${picker.offsetTop}px`;
  headMenu.hidden = false;
  props.querySelectorAll(".picker").forEach((p) => p.classList.toggle("open", p === picker));
  updateColorbar();
}

function closeHeadMenu(): void {
  headMenu.hidden = true;
  props.querySelectorAll(".picker.open").forEach((p) => p.classList.remove("open"));
}

/** Gives a new card the color and look picked last, as far as they fit it. */
function applyNodeDefaults(node: CanvasNode): CanvasNode {
  const { color, ...look } = pickNodeDefaults(nodeDefaults, nodeLook(node).shape);
  if (color) node.color = color;
  setNodeLook(node, look);
  return node;
}

/** Sets part of the look of the selected shapes and free text. */
function setSelectedNodeLook(look: Partial<NodeLook>): void {
  const { shape: _shape, ...sticky } = look;
  nodeDefaults = { ...nodeDefaults, ...sticky };
  saveState();
  for (const id of selection) {
    const node = nodeById(id);
    if (node?.type !== "text" && node?.type !== "file") continue;
    if (isLocked(node)) continue;
    const kind = nodeLook(node).shape;
    // Text settings fit every text card and note; a border not free text; shape and fill only shapes.
    const part: Partial<NodeLook> = node.type === "file" && isImagePath(node.file) ? {} : { fontSize: look.fontSize, fontFamily: look.fontFamily };
    if (kind !== "text") part.strokeWidth = look.strokeWidth;
    if (kind !== "text" && kind !== "card") Object.assign(part, { shape: look.shape, fill: look.fill });
    const given = Object.fromEntries(Object.entries(part).filter(([, v]) => v !== undefined));
    if (!Object.keys(given).length) continue;
    setNodeLook(node, given);
    fitFreeText(node);
  }
  commit();
}

/** Sets the drawing style of the selected nodes and edges. */
function setSelectedDrawingStyle(name: DrawingStyleName): void {
  for (const id of selection) {
    const element = nodeById(id) ?? edgeById(id);
    if (element && !isLocked(element)) setDrawingStyle(element, name, canvasStyle());
  }
  commit();
}

/** Switches the canvas to the next drawing style. Its elements with a style of their own keep theirs. */
function cycleCanvasStyle(): void {
  const names = DRAWING_STYLE_NAMES;
  data.style = names[(names.indexOf(canvasStyle()) + 1) % names.length];
  commit();
}

function updateCanvasStyleButton(): void {
  const button = document.getElementById("canvas-style")!;
  const style = canvasStyle();
  button.innerHTML = drawingStyleIcon(style);
  button.title = `Drawing style of this canvas: ${title(style)} (click to change)`;
}

/** Sets part of the look of the selected edges, and of new ones. */
function setSelectedEdgeStyle(style: Partial<EdgeStyle>): void {
  edgeDefaults = { ...edgeDefaults, ...style };
  saveState();
  for (const id of selection) {
    const edge = edgeById(id);
    if (edge && !isLocked(edge)) setEdgeStyle(edge, style);
  }
  commit();
}

// ---------------------------------------------------------------- creating

function addNode(node: CanvasNode, edit = false): void {
  data.nodes.push(node);
  selection.clear();
  selection.add(node.id);
  if (edit) editing = node.id;
  commit();
}

function textNodeAt(p: Point, text = ""): CanvasNode {
  return applyNodeDefaults({ id: newId(), type: "text", text, x: snap(p.x - 125, GRID), y: snap(p.y - 30, GRID), width: 260, height: 80 });
}

/** Empty free text whose first line starts at `p`, as in Excalidraw. Left empty, it disappears again. */
function freeTextAt(p: Point): CanvasNode {
  const node: CanvasNode = { id: newId(), type: "text", text: "", x: p.x - 6, y: p.y - 14, width: 40, height: 28 };
  setNodeLook(node, { shape: "text" });
  return applyNodeDefaults(node);
}

function fileNodeAt(p: Point, file: string): CanvasNode {
  const image = isImagePath(file);
  const width = image ? 400 : 400;
  const height = image ? 300 : 400;
  return { id: newId(), type: "file", file, x: snap(p.x - width / 2, GRID), y: snap(p.y - height / 2, GRID), width, height };
}

function linkNodeAt(p: Point, url: string): CanvasNode {
  return { id: newId(), type: "link", url, x: snap(p.x - 200, GRID), y: snap(p.y - 60, GRID), width: 400, height: 120 };
}

function addGroup(): void {
  const selected = selectedNodes();
  const b = boundsOf(selected);
  const pad = 40;
  const rect: Rect = b
    ? { x: b.x - pad, y: b.y - pad - 20, width: b.width + 2 * pad, height: b.height + 2 * pad + 20 }
    : { ...viewportCenter(), width: 500, height: 400 };
  if (!b) {
    rect.x -= 250;
    rect.y -= 200;
  }
  const group: GroupNode = { id: newId(), type: "group", label: "Group", ...rect };
  // Groups go first, so they lie under the cards they hold.
  data.nodes.unshift(group);
  selection.clear();
  selection.add(group.id);
  commit();
  renameGroup(group.id);
}

/**
 * Deletes the selection, with the connections of the deleted cards. Locked elements stay, and so does
 * a card with a locked connection: the connection cannot outlive it.
 */
function deleteSelection(): void {
  const held = new Set(data.edges.filter(isLocked).flatMap((e) => [e.fromNode, e.toNode]));
  const gone = new Set(selectedNodes().filter((n) => !isLocked(n) && !held.has(n.id)).map((n) => n.id));
  const goneEdges = new Set(
    data.edges.filter((e) => !isLocked(e) && (selection.has(e.id) || gone.has(e.fromNode) || gone.has(e.toNode))).map((e) => e.id),
  );
  if (!gone.size && !goneEdges.size) return;
  data.nodes = data.nodes.filter((n) => !gone.has(n.id));
  data.edges = data.edges.filter((e) => !goneEdges.has(e.id));
  for (const id of [...gone, ...goneEdges]) selection.delete(id);
  commit();
}

/** True when everything selected is locked. */
function selectionLocked(): boolean {
  const items = [...selection].map((id) => nodeById(id) ?? edgeById(id));
  return items.length > 0 && items.every((i) => i && isLocked(i));
}

/** Locks the selection, or unlocks it when all of it is locked. */
function toggleLock(): void {
  if (selection.size === 0) return;
  const on = !selectionLocked();
  for (const id of selection) {
    const item = nodeById(id) ?? edgeById(id);
    if (item) setLocked(item, on);
  }
  commit();
}

/** The upright box around a card as drawn, turned or not. Align, distribute and snap use it. */
function outlineOf(node: CanvasNode): Rect {
  return turnedBounds(node, rotationOf(node));
}

/** Moves the selected cards to their rects in `place`, given in the order of `cards`. A group takes its cards along. */
function moveCardsTo(cards: CanvasNode[], place: Rect[]): void {
  const moved = new Set<string>();
  cards.forEach((n, i) => {
    const before = outlineOf(n);
    const dx = place[i]!.x - before.x;
    const dy = place[i]!.y - before.y;
    if (isLocked(n) || (!dx && !dy)) return;
    const carried = n.type === "group" ? childrenOf(n).filter((c) => !selection.has(c.id)) : [];
    for (const m of [n, ...carried]) {
      if (moved.has(m.id)) continue;
      moved.add(m.id);
      m.x += dx;
      m.y += dy;
    }
  });
  if (moved.size) commit();
}

/** Lines up the selected cards; locked ones stay where they are. */
function alignSelection(edge: AlignEdge): void {
  const cards = selectedNodes();
  moveCardsTo(cards, align(cards.map(outlineOf), edge));
}

function distributeSelection(axis: "horizontal" | "vertical"): void {
  const cards = selectedNodes();
  moveCardsTo(cards, distribute(cards.map(outlineOf), axis));
}

/** Moves the selected cards in the layer order. Groups move only among groups. */
function reorderSelection(op: LayerOp): void {
  const next = reorder(data.nodes, selection, op);
  if (next.every((n, i) => n === data.nodes[i])) return;
  data.nodes = next;
  commit();
}

function setColor(color: string): void {
  if (selection.size === 0) return;
  if (selectedNodes().length) {
    nodeDefaults = { ...nodeDefaults, color: color || undefined };
    saveState();
  }
  for (const id of selection) {
    const item = nodeById(id) ?? edgeById(id);
    if (!item || isLocked(item)) continue;
    if (color) item.color = color;
    else delete item.color;
  }
  commit();
}

// ---------------------------------------------------------------- copy and paste

function copySelection(): string | undefined {
  const nodes = selectedNodes();
  if (nodes.length === 0) return undefined;
  const ids = new Set(nodes.map((n) => n.id));
  const edges = data.edges.filter((e) => ids.has(e.fromNode) && ids.has(e.toNode));
  clipboard = structuredClone({ nodes, edges });
  return serializeCanvas({ nodes, edges });
}

function paste(fragment: { nodes: CanvasNode[]; edges: CanvasEdge[] }, at: Point): void {
  const b = boundsOf(fragment.nodes);
  if (!b) return;
  const dx = snap(at.x - (b.x + b.width / 2), GRID);
  const dy = snap(at.y - (b.y + b.height / 2), GRID);
  const map = new Map<string, string>();
  selection.clear();
  for (const n of fragment.nodes) {
    const copy = { ...structuredClone(n), id: newId(), x: n.x + dx, y: n.y + dy };
    setLocked(copy, false);
    map.set(n.id, copy.id);
    if (copy.type === "group") data.nodes.unshift(copy);
    else data.nodes.push(copy);
    selection.add(copy.id);
  }
  for (const e of fragment.edges) {
    const from = map.get(e.fromNode);
    const to = map.get(e.toNode);
    if (!from || !to) continue;
    const copy = { ...structuredClone(e), id: newId(), fromNode: from, toNode: to };
    setLocked(copy, false);
    data.edges.push(copy);
  }
  commit();
}

function pasteText(text: string, at: Point): void {
  const trimmed = text.trim();
  if (!trimmed) return;
  if (trimmed.startsWith("{")) {
    try {
      const fragment = parseCanvas(trimmed);
      if (fragment.nodes.length) return paste(fragment, at);
    } catch {
      // Not a canvas fragment: paste it as text.
    }
  }
  if (/^https?:\/\/\S+$/.test(trimmed)) return addNode(linkNodeAt(at, trimmed));
  addNode(textNodeAt(at, trimmed));
}

// ---------------------------------------------------------------- inline editing

function nodeElement(id: string): HTMLElement | null {
  return world.querySelector<HTMLElement>(`.node[data-id="${CSS.escape(id)}"]`);
}

function startEditing(id: string): void {
  const node = nodeById(id);
  const el = nodeElement(id);
  if (!node || !el || isLocked(node)) return;
  if (node.type === "group") return renameGroup(id);
  if (node.type === "file") return;
  editing = id;
  updateColorbar();
  const field = document.createElement("textarea");
  field.className = "editor";
  field.spellcheck = true;
  field.value = node.type === "text" ? node.text : node.url;
  if (node.type === "link") field.placeholder = "https://…";
  el.classList.add("editing");
  el.querySelector(".content")?.replaceChildren(field);
  field.focus();
  field.setSelectionRange(field.value.length, field.value.length);

  const freeText = node.type === "text" && nodeLook(node).shape === "text";
  if (freeText) {
    // Grow with the text while typing.
    const grow = () => {
      const html = `<div class="raw">${escapeHtml(field.value)}&#8203;</div>`;
      if (hasFixedWidth(node)) {
        el.style.height = `${Math.max(20, node.height, measureText(node, html, node.width).height)}px`;
        return;
      }
      const size = measureText(node, html);
      el.style.width = `${Math.max(30, size.width + 8)}px`;
      el.style.height = `${Math.max(20, size.height)}px`;
    };
    field.addEventListener("input", grow);
    grow();
  }

  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    editing = null;
    const value = node.type === "text" ? field.value : field.value.trim();
    const old = node.type === "text" ? node.text : node.url;
    if (freeText && value.trim() === "") {
      // Empty text is dropped, as in Excalidraw.
      data.nodes = data.nodes.filter((n) => n.id !== node.id);
      data.edges = data.edges.filter((e) => e.fromNode !== node.id && e.toNode !== node.id);
      selection.delete(node.id);
      commit();
    } else if (value !== old) {
      if (node.type === "text") node.text = value;
      else node.url = value;
      fitFreeText(node);
      commit();
    } else {
      render();
    }
    viewport.focus();
  };
  field.addEventListener("blur", finish);
  field.addEventListener("keydown", (e) => {
    e.stopPropagation();
    if (e.key === "Escape" || (e.key === "Enter" && (e.ctrlKey || e.metaKey || node.type === "link"))) {
      e.preventDefault();
      finish();
    }
  });
  field.addEventListener("pointerdown", (e) => e.stopPropagation());
  field.addEventListener("wheel", (e) => e.stopPropagation());
}

/** A small text field over the canvas, for a group's name or an edge's label. */
function inlineInput(at: Point, value: string, onDone: (value: string) => void): void {
  const input = document.createElement("input");
  input.className = "inline-input";
  input.value = value;
  input.style.left = `${at.x}px`;
  input.style.top = `${at.y}px`;
  labelsLayer.append(input);
  input.focus();
  input.select();
  let done = false;
  const finish = (save: boolean) => {
    if (done) return;
    done = true;
    input.remove();
    if (save && input.value !== value) onDone(input.value);
    viewport.focus();
  };
  input.addEventListener("blur", () => finish(true));
  input.addEventListener("pointerdown", (e) => e.stopPropagation());
  input.addEventListener("keydown", (e) => {
    e.stopPropagation();
    if (e.key === "Enter") finish(true);
    if (e.key === "Escape") finish(false);
  });
}

function renameGroup(id: string): void {
  const group = nodeById(id);
  if (!group || group.type !== "group" || isLocked(group)) return;
  inlineInput({ x: group.x, y: group.y - 34 }, group.label ?? "", (label) => {
    if (label) group.label = label;
    else delete group.label;
    commit();
  });
}

function editEdgeLabel(id: string): void {
  const edge = edgeById(id);
  const geo = edge && edgeGeometry(edge);
  if (!edge || !geo || isLocked(edge)) return;
  inlineInput({ x: geo.mid.x - 80, y: geo.mid.y - 14 }, edge.label ?? "", (label) => {
    if (label) edge.label = label;
    else delete edge.label;
    commit();
  });
}

// ---------------------------------------------------------------- pointer interaction

type Drag =
  | { kind: "pan"; start: Point; view: View }
  | { kind: "marquee"; start: Point; additive: Set<string> }
  | { kind: "move"; start: Point; nodes: { node: CanvasNode; x: number; y: number }[]; moved: boolean; clickedId: string; bounds: Rect; others: Rect[] }
  | { kind: "resize"; start: Point; node: CanvasNode; x: number; y: number; width: number; height: number; dx: Pull; dy: Pull; anchor: Point; scale: number; others: Rect[] }
  | { kind: "resize-many"; from: Rect; dx: Pull; dy: Pull; items: { node: CanvasNode; rect: Rect; scale: number }[]; others: Rect[]; changed: boolean }
  | { kind: "rotate"; node: CanvasNode; center: Point; startAngle: number; rotation: number }
  | { kind: "connect"; from: CanvasNode; side: Side; preview: SVGPathElement }
  | { kind: "draw"; start: Point; shape: ShapeKind; preview: HTMLElement }
  | { kind: "text"; start: Point };

let drag: Drag | null = null;

viewport.addEventListener("pointerdown", (e) => {
  if (!loaded) return;
  const target = e.target as HTMLElement;
  if (target.closest(".editor, .inline-input")) return;
  if (editing) (document.activeElement as HTMLElement | null)?.blur();
  viewport.focus();
  const p = toWorld(e.clientX, e.clientY);

  if (e.button === 1 || (e.button === 0 && (spaceHeld || tool.kind === "hand"))) {
    e.preventDefault();
    drag = { kind: "pan", start: { x: e.clientX, y: e.clientY }, view: { ...view } };
    viewport.classList.add("panning");
    viewport.setPointerCapture(e.pointerId);
    return;
  }
  if (e.button !== 0) return;

  if (tool.kind !== "select") {
    startPlacing(e, p);
    return;
  }

  const boxHandle = target.closest<HTMLElement>("#selection-box > .resize");
  if (boxHandle) {
    // Every selected card scales, and the cards inside a selected group with it.
    const scaled = new Map<string, CanvasNode>();
    for (const n of selectedNodes()) {
      scaled.set(n.id, n);
      if (n.type === "group") for (const c of childrenOf(n)) scaled.set(c.id, c);
    }
    if ([...scaled.values()].some(isLocked)) return;
    const items = [...scaled.values()].map((node) => ({ node, rect: { x: node.x, y: node.y, width: node.width, height: node.height }, scale: textScaleOf(node) }));
    drag = {
      kind: "resize-many",
      from: boundsOf(selectedNodes().map(outlineOf))!,
      dx: Number(boxHandle.dataset.dx) as Pull,
      dy: Number(boxHandle.dataset.dy) as Pull,
      items,
      others: snapCandidates(new Set(scaled.keys())),
      changed: false,
    };
    viewport.setPointerCapture(e.pointerId);
    return;
  }

  const linkButton = target.closest<HTMLElement>(".link-open");
  if (linkButton) {
    post({ type: "openLink", href: linkButton.dataset.href! });
    return;
  }
  const anchorEl = target.closest<HTMLElement>("a[data-href]");
  if (anchorEl && (e.ctrlKey || e.metaKey || !target.closest(".selected"))) {
    e.preventDefault();
    post({ type: "openLink", href: anchorEl.dataset.href! });
    return;
  }

  const nodeEl = target.closest<HTMLElement>(".node");
  const node = nodeEl && nodeById(nodeEl.dataset.id!);

  if (node && target.classList.contains("connect")) {
    const preview = document.createElementNS(SVG_NS, "path");
    preview.classList.add("preview");
    edgesLayer.append(preview);
    drag = { kind: "connect", from: node, side: target.dataset.side as Side, preview };
    viewport.setPointerCapture(e.pointerId);
    return;
  }

  if (node && !isLocked(node) && target.classList.contains("resize")) {
    // The corner or side opposite the handle stays where it is, also on a turned card.
    const dx = Number(target.dataset.dx) as Pull;
    const dy = Number(target.dataset.dy) as Pull;
    const anchor = resizeAnchor(node, dx, dy, rotationOf(node));
    const scale = textScaleOf(node);
    const others = snapCandidates(new Set([node.id]));
    drag = { kind: "resize", start: p, node, x: node.x, y: node.y, width: node.width, height: node.height, dx, dy, anchor, scale, others };
    viewport.setPointerCapture(e.pointerId);
    return;
  }

  if (node && !isLocked(node) && target.classList.contains("rotate")) {
    const c = center(node);
    drag = { kind: "rotate", node, center: c, startAngle: angleTo(c, p), rotation: rotationOf(node) };
    viewport.setPointerCapture(e.pointerId);
    return;
  }

  if (node) {
    // A group is grabbed by its label or its edge, so a drag inside it can still draw a selection box.
    if (node.type === "group" && !target.closest(".group-label") && insideGroupBody(node, p)) {
      startMarquee(e, p);
      return;
    }
    if (e.shiftKey) {
      if (selection.has(node.id)) selection.delete(node.id);
      else selection.add(node.id);
    } else if (!selection.has(node.id)) {
      selection.clear();
      selection.add(node.id);
    }
    // Locked cards stay put; a group that moves carries every card inside it, locked or not.
    const moving = new Map<string, CanvasNode>();
    for (const n of selectedNodes()) {
      if (isLocked(n)) continue;
      moving.set(n.id, n);
      if (n.type === "group") for (const c of childrenOf(n)) moving.set(c.id, c);
    }
    const movingNodes = [...moving.values()];
    drag = {
      kind: "move",
      start: p,
      nodes: movingNodes.map((n) => ({ node: n, x: n.x, y: n.y })),
      moved: false,
      clickedId: node.id,
      bounds: boundsOf(movingNodes.map(outlineOf)) ?? { ...p, width: 0, height: 0 },
      others: snapCandidates(new Set(moving.keys())),
    };
    viewport.setPointerCapture(e.pointerId);
    showSelection();
    return;
  }

  const edgeEl = target.closest<HTMLElement | SVGElement>(".edge, .edge-label");
  if (edgeEl) {
    const id = (edgeEl as HTMLElement).dataset.id!;
    if (!e.shiftKey) selection.clear();
    selection.add(id);
    showSelection();
    return;
  }

  startMarquee(e, p);
});

// ---------------------------------------------------------------- tools: text and shapes

let tool: Tool = SELECT;

function setTool(next: Tool): void {
  tool = next;
  showTool(toolbar, viewport, tool);
}

/** With a tool picked, a click places text; a click or a drag places a shape. */
function startPlacing(e: PointerEvent, p: Point): void {
  if (tool.kind === "text") {
    // The text box opens on release: opening it now would lose the focus the press gives the canvas.
    drag = { kind: "text", start: p };
    viewport.setPointerCapture(e.pointerId);
    return;
  }
  if (tool.kind !== "shape") return;
  const preview = document.createElement("div");
  preview.className = "draw-preview";
  nodesLayer.append(preview);
  drag = { kind: "draw", start: p, shape: tool.shape, preview };
  viewport.setPointerCapture(e.pointerId);
}

/** The direction from `c` to `p`, in degrees clockwise from straight up. */
function angleTo(c: Point, p: Point): number {
  return (Math.atan2(p.y - c.y, p.x - c.x) * 180) / Math.PI + 90;
}

function drawRect(start: Point, p: Point, free: boolean): Rect {
  if (free) return rectFromPoints(start, p);
  return rectFromPoints({ x: snap(start.x, GRID), y: snap(start.y, GRID) }, { x: snap(p.x, GRID), y: snap(p.y, GRID) });
}

function insideGroupBody(group: CanvasNode, p: Point): boolean {
  const edge = 12 / view.zoom;
  return p.x > group.x + edge && p.x < group.x + group.width - edge && p.y > group.y + edge && p.y < group.y + group.height - edge;
}

// ---------------------------------------------------------------- snap guides

/** How near, in screen pixels, an edge or center must come to another card's to snap to it. */
const SNAP_PX = 6;

function shifted(r: Rect, dx: number, dy: number): Rect {
  return { ...r, x: r.x + dx, y: r.y + dy };
}

/** The outlines a drag can snap to: the cards in view, or within one viewport of it, except the ones that move. */
function snapCandidates(moving: Set<string>): Rect[] {
  const r = viewport.getBoundingClientRect();
  const area = rectFromPoints(toWorld(r.left - r.width, r.top - r.height), toWorld(r.right + r.width, r.bottom + r.height));
  return data.nodes.filter((n) => !moving.has(n.id)).map(outlineOf).filter((b) => rectsIntersect(b, area));
}

function showGuides(guides: Guide[]): void {
  guidesLayer.innerHTML = guides
    .map((g) =>
      g.axis === "x"
        ? `<line x1="${g.at}" y1="${g.from}" x2="${g.at}" y2="${g.to}"/>`
        : `<line x1="${g.from}" y1="${g.at}" x2="${g.to}" y2="${g.at}"/>`,
    )
    .join("");
  guidesLayer.style.setProperty("--guide-width", `${1 / view.zoom}px`);
}

function startMarquee(e: PointerEvent, p: Point): void {
  if (!e.shiftKey) selection.clear();
  drag = { kind: "marquee", start: p, additive: new Set(selection) };
  viewport.setPointerCapture(e.pointerId);
  showSelection();
}

viewport.addEventListener("pointermove", (e) => {
  lastPointer = { x: e.clientX, y: e.clientY };
  if (!drag) return;
  const p = toWorld(e.clientX, e.clientY);
  switch (drag.kind) {
    case "pan":
      view = { ...drag.view, x: drag.view.x + e.clientX - drag.start.x, y: drag.view.y + e.clientY - drag.start.y };
      applyView();
      break;
    case "marquee": {
      const r = rectFromPoints(drag.start, p);
      Object.assign(marquee.style, {
        left: `${r.x * view.zoom + view.x}px`,
        top: `${r.y * view.zoom + view.y}px`,
        width: `${r.width * view.zoom}px`,
        height: `${r.height * view.zoom}px`,
      });
      marquee.hidden = false;
      selection.clear();
      drag.additive.forEach((id) => selection.add(id));
      for (const n of data.nodes) {
        if (!isLocked(n) && rectsIntersect(r, n) && (n.type !== "group" || containsRect(r, n))) selection.add(n.id);
      }
      showSelection();
      break;
    }
    case "move": {
      let dx = p.x - drag.start.x;
      let dy = p.y - drag.start.y;
      if (!drag.nodes.length || (!drag.moved && Math.hypot(dx, dy) * view.zoom < 3)) return;
      drag.moved = true;
      if (!e.altKey) {
        // Snap to the cards nearby; on an axis with none, snap the clicked card to the grid and keep the others' offsets to it.
        const s = snapGuides(shifted(drag.bounds, dx, dy), drag.others, SNAP_PX / view.zoom);
        const clicked = drag.clickedId;
        const lead = drag.nodes.find((m) => m.node.id === clicked) ?? drag.nodes[0]!;
        dx = s.dx !== undefined ? dx + s.dx : snap(lead.x + dx, GRID) - lead.x;
        dy = s.dy !== undefined ? dy + s.dy : snap(lead.y + dy, GRID) - lead.y;
        showGuides(snapGuides(shifted(drag.bounds, dx, dy), drag.others, 0.01).guides);
      } else {
        showGuides([]);
      }
      for (const m of drag.nodes) {
        m.node.x = m.x + dx;
        m.node.y = m.y + dy;
        const el = nodeElement(m.node.id);
        if (el) placeNode(el, m.node);
      }
      redrawEdgesOf(new Set(drag.nodes.map((m) => m.node.id)));
      updateSelectionBox();
      break;
    }
    case "resize-many": {
      const { from, dx, dy } = drag;
      const pointer = { ...p };
      const guides: Guide[] = [];
      if (!e.altKey) {
        // The moving sides land on an edge or center of a card nearby, else on the grid.
        const tolerance = SNAP_PX / view.zoom;
        if (dx) {
          const s = snapGuides({ x: p.x, y: from.y, width: 0, height: from.height }, drag.others, tolerance);
          pointer.x = s.dx !== undefined ? p.x + s.dx : snap(p.x, GRID);
          guides.push(...snapGuides({ x: pointer.x, y: from.y, width: 0, height: from.height }, drag.others, 0.01).guides.filter((g) => g.axis === "x"));
        }
        if (dy) {
          const s = snapGuides({ x: from.x, y: p.y, width: from.width, height: 0 }, drag.others, tolerance);
          pointer.y = s.dy !== undefined ? p.y + s.dy : snap(p.y, GRID);
          guides.push(...snapGuides({ x: from.x, y: pointer.y, width: from.width, height: 0 }, drag.others, 0.01).guides.filter((g) => g.axis === "y"));
        }
      }
      showGuides(guides);
      const { box, rects } = scaleRects(drag.items.map((i) => i.rect), from, dx, dy, pointer, e.shiftKey);
      const sx = box.width / from.width;
      const sy = box.height / from.height;
      drag.items.forEach((item, i) => {
        const r = rects[i]!;
        Object.assign(item.node, { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) });
        // Free text scales its text with the box; stretched one way only, it keeps its size and wraps.
        if (isFreeText(item.node)) setTextScale(item.node, item.scale * Math.min(sx, sy));
        const el = nodeElement(item.node.id);
        if (el) placeNode(el, item.node);
      });
      drag.changed = true;
      redrawEdgesOf(new Set(drag.items.map((i) => i.node.id)));
      updateSelectionBox();
      break;
    }
    case "resize": {
      const { node: n, dx, dy } = drag;
      const freeText = isFreeText(n);
      const turn = rotationOf(n);
      // Measure the drag along the card's own turned sides.
      const local = rotatePoint({ x: p.x - drag.start.x, y: p.y - drag.start.y }, { x: 0, y: 0 }, -turn);
      let w = drag.width + dx * local.x;
      let h = drag.height + dy * local.y;
      if (freeText && dx && dy) {
        // A corner of free text scales it, text and all, as in Excalidraw.
        let ratio = Math.max(w / drag.width, h / drag.height);
        ratio = Math.min(MAX_TEXT_SCALE, Math.max(MIN_TEXT_SCALE, drag.scale * ratio)) / drag.scale;
        w = drag.width * ratio;
        h = drag.height * ratio;
        setTextScale(n, drag.scale * ratio);
        const corner = resizedCorner(drag.anchor, w, h, dx, dy, turn);
        Object.assign(n, { width: w, height: h, x: corner.x, y: corner.y });
        const el = nodeElement(n.id);
        if (el) placeNode(el, n);
        redrawEdgesOf(new Set([n.id]));
        break;
      }
      const guides: Guide[] = [];
      if (!turn && !e.altKey) {
        // The moving side lands on an edge or center of a card nearby, else on the grid.
        const tolerance = SNAP_PX / view.zoom;
        if (dx) {
          const side = dx === 1 ? drag.x + w : drag.x + drag.width - w;
          const s = snapGuides({ x: side, y: drag.y, width: 0, height: drag.height }, drag.others, tolerance);
          const to = s.dx !== undefined ? side + s.dx : snap(side, GRID);
          w = dx === 1 ? to - drag.x : drag.x + drag.width - to;
          guides.push(...snapGuides({ x: to, y: drag.y, width: 0, height: drag.height }, drag.others, 0.01).guides.filter((g) => g.axis === "x"));
        }
        if (dy) {
          const side = dy === 1 ? drag.y + h : drag.y + drag.height - h;
          const s = snapGuides({ x: drag.x, y: side, width: drag.width, height: 0 }, drag.others, tolerance);
          const to = s.dy !== undefined ? side + s.dy : snap(side, GRID);
          h = dy === 1 ? to - drag.y : drag.y + drag.height - to;
          guides.push(...snapGuides({ x: drag.x, y: to, width: drag.width, height: 0 }, drag.others, 0.01).guides.filter((g) => g.axis === "y"));
        }
      }
      showGuides(guides);
      w = Math.max(freeText ? 30 : 60, w);
      // Free text is never cut off: it is at least as tall as its wrapped text.
      const minH = isFreeText(n) ? measureText(n, renderMarkdown(n.text), w).height : 40;
      h = Math.max(minH, h);
      const corner = resizedCorner(drag.anchor, w, h, dx, dy, turn);
      Object.assign(n, { width: w, height: h, x: corner.x, y: corner.y });
      const el = nodeElement(n.id);
      if (el) placeNode(el, n);
      redrawEdgesOf(new Set([n.id]));
      break;
    }
    case "rotate": {
      let turn = drag.rotation + angleTo(drag.center, p) - drag.startAngle;
      if (e.shiftKey) turn = Math.round(turn / 15) * 15;
      setRotation(drag.node, turn);
      const el = nodeElement(drag.node.id);
      if (el) placeNode(el, drag.node);
      redrawEdgesOf(new Set([drag.node.id]));
      break;
    }
    case "draw": {
      const r = drawRect(drag.start, p, e.altKey);
      Object.assign(drag.preview.style, { left: `${r.x}px`, top: `${r.y}px`, width: `${r.width}px`, height: `${r.height}px` });
      drag.preview.innerHTML =
        r.width > 4 && r.height > 4
          ? `<svg viewBox="0 0 ${r.width} ${r.height}" width="${r.width}" height="${r.height}"><path d="${shapePath(drag.shape, r.width, r.height, 2)}"/></svg>`
          : "";
      break;
    }
    case "connect": {
      const a = nodeAnchor(drag.from, drag.side);
      const over = nodeUnder(e.clientX, e.clientY);
      const toSide = over && over.id !== drag.from.id ? facingSide(over, nearCenter(over, p) ? a : p) : null;
      const b = over && toSide ? nodeAnchor(over, toSide) : p;
      const fromDir = turnedSide(drag.side, rotationOf(drag.from));
      const toDir = over && toSide ? turnedSide(toSide, rotationOf(over)) : null;
      drag.preview.setAttribute("d", edgePath(a, fromDir, b, toDir, edgeDefaults.pathStyle).d);
      world.querySelectorAll(".node.drop-target").forEach((el) => el.classList.remove("drop-target"));
      if (over && over.id !== drag.from.id) nodeElement(over.id)?.classList.add("drop-target");
      break;
    }
  }
});

/** Dropped in the middle of a card: join it by the side that faces the edge's start instead. */
function nearCenter(node: CanvasNode, p: Point): boolean {
  return Math.abs(p.x - (node.x + node.width / 2)) < node.width / 4 && Math.abs(p.y - (node.y + node.height / 2)) < node.height / 4;
}

function nodeUnder(clientX: number, clientY: number): CanvasNode | undefined {
  for (const el of document.elementsFromPoint(clientX, clientY)) {
    const nodeEl = (el as HTMLElement).closest?.(".node") as HTMLElement | null;
    if (nodeEl) return nodeById(nodeEl.dataset.id!);
  }
  return undefined;
}

function endDrag(e: PointerEvent): void {
  if (!drag) return;
  const d = drag;
  drag = null;
  showGuides([]);
  const p = toWorld(e.clientX, e.clientY);
  switch (d.kind) {
    case "pan":
      viewport.classList.remove("panning");
      break;
    case "marquee":
      marquee.hidden = true;
      showSelection();
      break;
    case "move":
      if (d.moved) {
        commit();
      } else if (!e.shiftKey && selection.size > 1) {
        selection.clear();
        selection.add(d.clickedId);
        showSelection();
      }
      break;
    case "resize":
      if (textScaleOf(d.node) !== d.scale) {
        // Scaled text keeps its wrapping; fit the box to the text at its new size.
        const n = d.node;
        const before = resizeAnchor(n, d.dx, d.dy, rotationOf(n));
        fitFreeText(n);
        const corner = resizedCorner(before, n.width, n.height, d.dx, d.dy, rotationOf(n));
        Object.assign(n, { x: corner.x, y: corner.y });
        commit();
      } else if (d.node.width !== d.width || d.node.height !== d.height) {
        if (isFreeText(d.node) && d.node.width !== d.width) d.node.autoSize = false;
        commit();
      }
      break;
    case "text": {
      setTool(SELECT);
      addNode(freeTextAt(d.start), true);
      break;
    }
    case "rotate":
      if (rotationOf(d.node) !== d.rotation) commit();
      break;
    case "resize-many":
      if (!d.changed) break;
      for (const { node, rect } of d.items) {
        if (!isFreeText(node)) continue;
        // Stretched more one way than the other, it keeps its new width and wraps, as after a single resize.
        if (Math.abs(node.width / rect.width - node.height / rect.height) > 0.01) node.autoSize = false;
        fitFreeText(node);
      }
      commit();
      break;
    case "draw": {
      d.preview.remove();
      let r = drawRect(d.start, p, e.altKey);
      // A click, not a drag: the shape's usual size, centred on the click.
      if (r.width * view.zoom < 10 && r.height * view.zoom < 10) {
        const size = defaultShapeSize(d.shape);
        r = { x: snap(d.start.x - size.width / 2, GRID), y: snap(d.start.y - size.height / 2, GRID), ...size };
      }
      const node: CanvasNode = {
        id: newId(),
        type: "text",
        text: "",
        x: r.x,
        y: r.y,
        width: Math.max(20, r.width),
        height: Math.max(20, r.height),
      };
      setNodeLook(node, { shape: d.shape });
      applyNodeDefaults(node);
      setTool(SELECT);
      addNode(node);
      break;
    }
    case "connect": {
      d.preview.remove();
      world.querySelectorAll(".node.drop-target").forEach((el) => el.classList.remove("drop-target"));
      const over = nodeUnder(e.clientX, e.clientY);
      if (over && over.id === d.from.id) break;
      let target = over;
      if (!target) {
        // Dropped on the empty canvas: a new card there, as in Obsidian.
        target = textNodeAt(p);
        data.nodes.push(target);
        editing = target.id;
      }
      const edge: CanvasEdge = {
        id: newId(),
        fromNode: d.from.id,
        fromSide: d.side,
        toNode: target.id,
        toSide: facingSide(target, over && !nearCenter(over, p) ? p : nodeAnchor(d.from, d.side)),
      };
      setEdgeStyle(edge, edgeDefaults);
      data.edges.push(edge);
      selection.clear();
      selection.add(over ? edge.id : target.id);
      commit();
      break;
    }
  }
}

viewport.addEventListener("pointerup", endDrag);
viewport.addEventListener("pointercancel", endDrag);

viewport.addEventListener("dblclick", (e) => {
  if (tool.kind !== "select") return;
  // Pointer capture makes the event's own target the viewport: look at what is under the pointer.
  const target = (document.elementFromPoint(e.clientX, e.clientY) ?? e.target) as HTMLElement;
  if (target.closest(".editor, .inline-input, .link-open")) return;
  const p = toWorld(e.clientX, e.clientY);
  const nodeEl = target.closest<HTMLElement>(".node");
  const node = nodeEl && nodeById(nodeEl.dataset.id!);
  if (node) {
    if (node.type === "file") post({ type: "openFile", path: node.file, subpath: node.subpath });
    else if (node.type === "group" && insideGroupBody(node, p) && !target.closest(".group-label")) addNode(freeTextAt(p), true);
    else startEditing(node.id);
    return;
  }
  const edgeEl = target.closest<HTMLElement | SVGElement>(".edge, .edge-label");
  if (edgeEl) {
    editEdgeLabel((edgeEl as HTMLElement).dataset.id!);
    return;
  }
  addNode(freeTextAt(p), true);
});

viewport.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    const r = viewport.getBoundingClientRect();
    if (e.ctrlKey || e.metaKey) {
      // Pinch on a trackpad, or Ctrl + wheel.
      const delta = Math.max(-25, Math.min(25, e.deltaMode === 1 ? e.deltaY * 20 : e.deltaY));
      zoomBy(Math.exp(-delta * 0.01), { x: e.clientX - r.left, y: e.clientY - r.top });
    } else {
      const scale = e.deltaMode === 1 ? 20 : 1;
      const dx = e.shiftKey && e.deltaX === 0 ? e.deltaY : e.deltaX;
      const dy = e.shiftKey && e.deltaX === 0 ? 0 : e.deltaY;
      view = { ...view, x: view.x - dx * scale, y: view.y - dy * scale };
      applyView();
    }
  },
  { passive: false },
);

// ---------------------------------------------------------------- keyboard

document.addEventListener("keydown", (e) => {
  if (!loaded || (e.target as HTMLElement).closest?.("input, textarea, [contenteditable]")) return;
  const is = (id: string) => matchesShortcut(id, e);
  const key = e.key.toLowerCase();
  if (key === " " && !spaceHeld) {
    spaceHeld = true;
    viewport.classList.add("can-pan");
    e.preventDefault();
  } else if (is("delete")) {
    e.preventDefault();
    deleteSelection();
  } else if (is("selectAll")) {
    e.preventDefault();
    selectAll();
  } else if (is("duplicate")) {
    e.preventDefault();
    duplicateSelection();
  } else if (is("forward") || is("backward") || is("toFront") || is("toBack")) {
    e.preventDefault();
    reorderSelection(is("forward") ? "forward" : is("backward") ? "backward" : is("toFront") ? "front" : "back");
  } else if (is("lock")) {
    e.preventDefault();
    toggleLock();
  } else if (is("escape")) {
    escape();
  } else if (is("help")) {
    toggleShortcutPanel();
  } else if (is("select")) {
    setTool(SELECT);
  } else if (is("hand")) {
    setTool({ kind: "hand" });
  } else if (is("text")) {
    setTool({ kind: "text" });
  } else if (is("rectangle") || is("ellipse")) {
    setTool({ kind: "shape", shape: is("rectangle") ? "rectangle" : "ellipse" });
  } else if (is("card")) {
    addNode(textNodeAt(viewportCenter()), true);
  } else if (is("group")) {
    addGroup();
  } else if (is("edit") && selection.size === 1) {
    e.preventDefault();
    startEditing([...selection][0]!);
  } else if (is("fit")) {
    fitToContent();
  } else if (is("fitSelection") && selection.size) {
    fitToContent(selectedNodes());
  } else if (is("zoomIn")) {
    e.preventDefault();
    zoomBy(1.2);
  } else if (is("zoomOut")) {
    e.preventDefault();
    zoomBy(1 / 1.2);
  } else if (is("zoomReset")) {
    e.preventDefault();
    zoomBy(1 / view.zoom);
  } else if (key.startsWith("arrow") && selection.size) {
    e.preventDefault();
    nudge(key, e.shiftKey ? GRID * 5 : GRID);
  } else if (e.ctrlKey || e.metaKey) {
    // Save, undo and redo are VS Code's: write a waiting nudge first, so they see it.
    if (key === "s" || key === "z" || key === "y") nudges.flush();
  }
});

// ---------------------------------------------------------------- context menu

// A right-click selects what is under the pointer, unless it is selected already, and opens the menu for the selection.
// VS Code's own webview menu stays away, except in text fields.
document.addEventListener("contextmenu", (e) => {
  const target = e.target as HTMLElement;
  if (target.closest?.("input, textarea")) return;
  e.preventDefault();
  if (!loaded || !viewport.contains(target)) return;
  const p = toWorld(e.clientX, e.clientY);
  const nodeEl = target.closest<HTMLElement>(".node");
  const node = nodeEl && nodeById(nodeEl.dataset.id!);
  const onGroupBody = node?.type === "group" && !target.closest(".group-label") && insideGroupBody(node, p);
  const edgeEl = target.closest<HTMLElement | SVGElement>(".edge, .edge-label");
  const id = node && !onGroupBody ? node.id : (edgeEl as HTMLElement | null)?.dataset.id;
  if (!id) {
    selection.clear();
  } else if (!selection.has(id)) {
    selection.clear();
    selection.add(id);
  }
  showSelection();
  const selected = [...selection].map((id) => nodeById(id) ?? edgeById(id)).filter((i): i is CanvasNode | CanvasEdge => !!i);
  openContextMenu(menuItems(selected, !!clipboard), e.clientX, e.clientY, (action) => runMenuAction(action, p));
});

function runMenuAction(action: string, at: Point): void {
  switch (action) {
    case "cut":
    case "copy": {
      const text = copySelection();
      if (text) void navigator.clipboard?.writeText(text).catch(() => undefined);
      if (action === "cut") deleteSelection();
      return;
    }
    case "paste":
      if (clipboard) paste(clipboard, at);
      return;
    case "duplicate":
      return duplicateSelection();
    case "delete":
      return deleteSelection();
    case "toFront":
      return reorderSelection("front");
    case "forward":
      return reorderSelection("forward");
    case "backward":
      return reorderSelection("backward");
    case "toBack":
      return reorderSelection("back");
    case "group":
      return addGroup();
    case "lock":
      return toggleLock();
    case "fitSelection":
      return fitToContent(selectedNodes());
    case "selectAll":
      return selectAll();
    case "fit":
      return fitToContent();
  }
}

function selectAll(): void {
  data.nodes.forEach((n) => isLocked(n) || selection.add(n.id));
  showSelection();
}

/** Moves the selection by an arrow key. Shown at once, written to the document when the nudges stop. */
function nudge(key: string, step: number): void {
  const dx = key === "arrowleft" ? -step : key === "arrowright" ? step : 0;
  const dy = key === "arrowup" ? -step : key === "arrowdown" ? step : 0;
  const moved = selectedNodes().filter((n) => !isLocked(n));
  if (!moved.length) return;
  for (const n of moved) {
    n.x += dx;
    n.y += dy;
    const el = nodeElement(n.id);
    if (el) placeNode(el, n);
  }
  redrawEdgesOf(new Set(moved.map((n) => n.id)));
  updateSelectionBox();
  nudged = snapshot();
  nudges.schedule();
}

/** Escape closes an open menu first, then goes back to the select tool, then clears the selection. */
function escape(): void {
  if (isContextMenuOpen()) return closeContextMenu();
  if (isShortcutPanelOpen()) return toggleShortcutPanel(false);
  if (!headMenu.hidden) return closeHeadMenu();
  if (!shapeMenu.hidden) {
    shapeMenu.hidden = true;
    return;
  }
  if (tool.kind !== "select") return setTool(SELECT);
  selection.clear();
  showSelection();
}

function duplicateSelection(): void {
  const fragment = copySelection() && clipboard;
  if (!fragment) return;
  const b = boundsOf(fragment.nodes)!;
  paste(fragment, { x: b.x + b.width / 2 + GRID * 2, y: b.y + b.height / 2 + GRID * 2 });
}

document.addEventListener("keyup", (e) => {
  if (e.key === " ") {
    spaceHeld = false;
    viewport.classList.remove("can-pan");
  }
});

document.addEventListener("copy", (e) => {
  if (editing || (e.target as HTMLElement).closest?.("input, textarea")) return;
  const text = copySelection();
  if (text) {
    e.clipboardData?.setData("text/plain", text);
    e.preventDefault();
  }
});

document.addEventListener("cut", (e) => {
  if (editing || (e.target as HTMLElement).closest?.("input, textarea")) return;
  const text = copySelection();
  if (text) {
    e.clipboardData?.setData("text/plain", text);
    e.preventDefault();
    deleteSelection();
  }
});

document.addEventListener("paste", (e) => {
  if (editing || (e.target as HTMLElement).closest?.("input, textarea")) return;
  e.preventDefault();
  const at = pointerOrCenter();
  const images = [...(e.clipboardData?.files ?? [])].filter((f) => isImageFile(f.type, f.name));
  if (images.length) return void saveImages(images, at);
  const text = e.clipboardData?.getData("text/plain");
  if (text) pasteText(text, at);
  else if (clipboard) paste(clipboard, at);
});

function pointerOrCenter(): Point {
  const r = viewport.getBoundingClientRect();
  const { x, y } = lastPointer;
  return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom ? toWorld(x, y) : viewportCenter();
}

// ---------------------------------------------------------------- drop files and notes

// VS Code hands a webview a drop only while Shift is held.
viewport.addEventListener("dragover", (e) => {
  e.preventDefault();
  if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
  viewport.classList.add("drop-over");
});

viewport.addEventListener("dragleave", (e) => {
  if (!viewport.contains(e.relatedTarget as Node | null)) viewport.classList.remove("drop-over");
});

viewport.addEventListener("drop", (e) => {
  e.preventDefault();
  viewport.classList.remove("drop-over");
  const p = toWorld(e.clientX, e.clientY);
  const dt = e.dataTransfer;
  if (!dt) return;
  const uris = droppedUris(dt);
  if (uris.length) {
    post({ type: "dropUris", uris, x: p.x, y: p.y });
    return;
  }
  if (dt.files.length) {
    void dropOsFiles([...dt.files], p);
    return;
  }
  const text = dt.getData("text/plain");
  if (text) pasteText(text, p);
});

/** The files in a drop from VS Code (Explorer, editor tabs) or another app, in the first format that has them. */
function droppedUris(dt: DataTransfer): string[] {
  for (const type of ["application/vnd.code.uri-list", "text/uri-list"]) {
    const list = dt.getData(type).split(/\r?\n/).filter((u) => u.trim() && !u.startsWith("#"));
    if (list.length) return list;
  }
  // Older VS Code versions give JSON arrays of URIs or file system paths.
  for (const type of ["ResourceURLs", "CodeFiles"]) {
    try {
      const list = JSON.parse(dt.getData(type) || "[]") as unknown;
      if (Array.isArray(list) && list.length) return list.filter((u): u is string => typeof u === "string");
    } catch {
      // Not this format.
    }
  }
  return [];
}

/** Files from the operating system without a path: images are saved next to the canvas, notes come in as text cards. */
async function dropOsFiles(list: File[], at: Point): Promise<void> {
  const images = list.filter((f) => isImageFile(f.type, f.name));
  const notes = list.filter((f) => !images.includes(f) && (isTextPath(f.name) || f.type.startsWith("text/")));
  if (images.length) await saveImages(images, at);
  const items: DroppedItem[] = await Promise.all(notes.map(async (f) => ({ kind: "text" as const, text: await f.text() })));
  if (items.length) placeDropped(items, at);
  const skipped = list.length - images.length - notes.length;
  if (skipped) {
    post({
      type: "notify",
      text: `${skipped} dropped ${skipped === 1 ? "file" : "files"} could not be added. Put other files in the workspace first, then drag them from the Explorer.`,
    });
  }
}

const MAX_IMAGE_BYTES = 50_000_000;

/** Sends pasted or dropped images to the host, which saves them and answers with file cards. */
async function saveImages(list: File[], at: Point): Promise<void> {
  const fitting = list.filter((f) => f.size <= MAX_IMAGE_BYTES);
  if (fitting.length < list.length) post({ type: "notify", text: "Images over 50 MB are not added." });
  const images: ImageData[] = await Promise.all(
    fitting.map(async (f) => ({ name: f.name, mime: f.type, base64: toBase64(new Uint8Array(await f.arrayBuffer())) })),
  );
  if (images.length) post({ type: "saveImages", images, x: at.x, y: at.y });
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

function droppedNodeAt(p: Point, item: DroppedItem): CanvasNode {
  if (item.kind === "file") return fileNodeAt(p, item.path);
  return { ...textNodeAt(p, item.text.trim()), width: 400, height: 400 };
}

/** Puts dropped cards in a grid around the drop point and selects them. */
function placeDropped(items: DroppedItem[], at: Point): void {
  const nodes = items.map((item) => droppedNodeAt(at, item));
  const spots = gridAround(at, nodes, GRID * 2);
  selection.clear();
  nodes.forEach((node, i) => {
    node.x = snap(spots[i]!.x, GRID);
    node.y = snap(spots[i]!.y, GRID);
    data.nodes.push(node);
    selection.add(node.id);
  });
  commit();
}

// ---------------------------------------------------------------- toolbars

app.addEventListener("click", (e) => {
  const button = (e.target as HTMLElement).closest<HTMLElement>("button");
  if (!button || viewport.contains(button)) return;
  if (button.dataset.color !== undefined) return setColor(button.dataset.color);
  if (button.dataset.shape) return setTool({ kind: "shape", shape: button.dataset.shape as ShapeKind });
  if (button.dataset.look) {
    if (button.parentElement === headMenu) closeHeadMenu();
    return setSelectedNodeLook({ [button.dataset.look]: button.dataset.value });
  }
  if (button.dataset.menu) return toggleHeadMenu(button);
  if (button.dataset.align) return alignSelection(button.dataset.align as AlignEdge);
  if (button.dataset.distribute) return distributeSelection(button.dataset.distribute as "horizontal" | "vertical");
  if (isDrawingStyle(button.dataset.drawing)) return setSelectedDrawingStyle(button.dataset.drawing);
  if (button.dataset.style) {
    if (button.parentElement === headMenu) closeHeadMenu();
    return setSelectedEdgeStyle({ [button.dataset.style]: button.dataset.value });
  }
  switch (button.dataset.action) {
    case "text":
      return addNode(textNodeAt(viewportCenter()), true);
    case "text-tool":
      return setTool(tool.kind === "text" ? SELECT : { kind: "text" });
    case "select":
      return setTool(SELECT);
    case "hand":
      return setTool(tool.kind === "hand" ? SELECT : { kind: "hand" });
    case "shapes":
      if (tool.kind === "shape") return setTool(SELECT);
      shapeMenu.hidden = !shapeMenu.hidden;
      return;
    case "file":
      return post({ type: "pickFile" });
    case "image":
      return post({ type: "pickImages" });
    case "link":
      return addNode(linkNodeAt(viewportCenter(), ""), true);
    case "group":
      return addGroup();
    case "delete":
      return deleteSelection();
    case "lock":
      return toggleLock();
    case "zoom-in":
      return zoomBy(1.2);
    case "zoom-out":
      return zoomBy(1 / 1.2);
    case "zoom-reset":
      return zoomBy(1 / view.zoom);
    case "fit":
      return fitToContent();
    case "canvas-style":
      return cycleCanvasStyle();
    case "undo":
      nudges.flush();
      return post({ type: "undo" });
    case "redo":
      nudges.flush();
      return post({ type: "redo" });
    case "help":
      return toggleShortcutPanel();
    case "source":
      return post({ type: "showSource" });
  }
});

// The arrowhead and shape menus close on a click elsewhere, or on Escape (see `escape`).
document.addEventListener("pointerdown", (e) => {
  const t = e.target as HTMLElement;
  if (!headMenu.hidden && !t.closest("#head-menu, .picker")) closeHeadMenu();
  if (!shapeMenu.hidden && !t.closest('#shape-menu, [data-action="shapes"]')) shapeMenu.hidden = true;
});

props.querySelector<HTMLInputElement>("input[type=color]")!.addEventListener("change", (e) => {
  setColor((e.target as HTMLInputElement).value);
});

window.addEventListener("resize", () => applyView());

// ---------------------------------------------------------------- messages from the host

window.addEventListener("message", (e: MessageEvent<HostMessage>) => {
  const msg = e.data;
  switch (msg.type) {
    case "load": {
      nudges.flush();
      try {
        data = parseCanvas(msg.text);
      } catch (err) {
        loaded = false;
        errorBox.hidden = false;
        errorBox.querySelector("p")!.textContent = `This canvas file cannot be read: ${(err as Error).message}`;
        return;
      }
      errorBox.hidden = true;
      for (const id of [...selection]) if (!nodeById(id) && !edgeById(id)) selection.delete(id);
      // The files on the canvas may have changed too: ask for them again, keeping what shows until the answer comes.
      const paths = [...new Set(data.nodes.flatMap((n) => (n.type === "file" ? [n.file] : [])))];
      paths.forEach((p) => requestedFiles.add(p));
      if (paths.length) post({ type: "resolve", paths });
      const first = !loaded;
      loaded = true;
      render();
      if (first && !saved?.view) fitToContent();
      else applyView();
      break;
    }
    case "files":
      for (const [path, info] of Object.entries(msg.files)) files.set(path, info);
      render();
      break;
    case "picked":
      placeDropped(msg.paths.map((path) => ({ kind: "file", path })), viewportCenter());
      break;
    case "dropped":
      placeDropped(msg.items, msg);
      break;
    case "settings":
      settingsStyle = resolveDrawingStyle(msg.drawingStyle);
      themeSetting = msg.theme;
      applyPaper();
      if (loaded) render();
      else updateCanvasStyleButton();
      break;
  }
});

applyView();
applyPaper();
updateCanvasStyleButton();
showTool(toolbar, viewport, tool);
post({ type: "ready" });
