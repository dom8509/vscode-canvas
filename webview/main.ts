import {
  type CanvasData,
  type CanvasEdge,
  type CanvasNode,
  type EdgeStyle,
  type FileNode,
  type GroupNode,
  type Side,
  HEAD_SHAPES,
  LINE_STYLES,
  LINE_WIDTHS,
  PATH_STYLES,
  cssColor,
  edgeStyle,
  isImageFile,
  isImagePath,
  isTextPath,
  newId,
  parseCanvas,
  serializeCanvas,
  setEdgeStyle,
} from "../src/jsonCanvas";
import type { DroppedItem, FileInfo, HostMessage, ImageData, WebviewMessage } from "../src/protocol";
import {
  type Point,
  type Rect,
  type View,
  anchor,
  autoSides,
  boundsOf,
  containsRect,
  edgePath,
  fitView,
  gridAround,
  headSvg,
  rectFromPoints,
  rectsIntersect,
  sideFacing,
  snap,
  zoomAt,
} from "./geometry";
import { escapeHtml, renderMarkdown, stripFrontMatter } from "./markdown";

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
const WIDTHS: Record<EdgeStyle["lineWidth"], number> = { thin: 1.5, normal: 2.5, bold: 4.5 };

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

const saved = vscode.getState() as { view?: View; edgeDefaults?: Partial<EdgeStyle> } | undefined;
if (saved?.view) view = saved.view;
/** The look last picked in the style bar. New edges get it, as in Excalidraw. */
let edgeDefaults: Partial<EdgeStyle> = saved?.edgeDefaults ?? {};

// ---------------------------------------------------------------- DOM

const app = document.getElementById("app")!;
app.innerHTML = `
  <div id="viewport" tabindex="0">
    <div id="world">
      <div id="groups"></div>
      <svg id="edges"></svg>
      <div id="nodes"></div>
      <div id="labels"></div>
    </div>
    <div id="marquee" hidden></div>
  </div>
  <div id="error" hidden>
    <p></p>
    <button data-action="source">Open as text</button>
  </div>
  <div id="toolbar">
    <button data-action="text" title="Add card (or double-click the canvas)">${icon("card")}</button>
    <button data-action="file" title="Add note or media from the workspace">${icon("file")}</button>
    <button data-action="image" title="Add image (or paste one with Ctrl+V)">${icon("image")}</button>
    <button data-action="link" title="Add web page">${icon("link")}</button>
    <button data-action="group" title="Add group (around the selection, if any)">${icon("group")}</button>
  </div>
  <div id="colorbar" hidden>
    <button data-color="" title="No color" class="swatch none"></button>
    ${["1", "2", "3", "4", "5", "6"].map((c) => `<button data-color="${c}" class="swatch" style="--swatch: ${cssColor(c)}"></button>`).join("")}
    <label class="swatch custom" title="Custom color"><input type="color"></label>
    <span class="sep"></span>
    <span class="edge-tools">
      <span class="sep"></span>
      ${LINE_STYLES.map((v) => `<button data-style="lineStyle" data-value="${v}" title="${v[0]!.toUpperCase() + v.slice(1)} line">${styleIcon({ lineStyle: v })}</button>`).join("")}
      <span class="sep"></span>
      ${LINE_WIDTHS.map((v) => `<button data-style="lineWidth" data-value="${v}" title="${v[0]!.toUpperCase() + v.slice(1)}">${styleIcon({ lineWidth: v })}</button>`).join("")}
      <span class="sep"></span>
      ${PATH_STYLES.map((v) => `<button data-style="pathStyle" data-value="${v}" title="${v[0]!.toUpperCase() + v.slice(1)}">${styleIcon({ pathStyle: v })}</button>`).join("")}
      <span class="sep"></span>
      <button data-menu="fromHead" title="Start of the line"></button>
      <button data-menu="toHead" title="End of the line"></button>
    </span>
    <span class="sep"></span>
    <button data-action="delete" title="Delete (Del)">${icon("trash")}</button>
    <div id="head-menu" hidden></div>
  </div>
  <div id="zoombar">
    <button data-action="zoom-in" title="Zoom in">${icon("plus")}</button>
    <button data-action="zoom-reset" id="zoom-level" title="Reset zoom">100%</button>
    <button data-action="zoom-out" title="Zoom out">${icon("minus")}</button>
    <button data-action="fit" title="Zoom to fit (Shift+1)">${icon("fit")}</button>
    <button data-action="undo" title="Undo (Ctrl+Z)">${icon("undo")}</button>
    <button data-action="redo" title="Redo (Ctrl+Shift+Z)">${icon("redo")}</button>
  </div>
`;

const viewport = document.getElementById("viewport")!;
const world = document.getElementById("world")!;
const groupsLayer = document.getElementById("groups")!;
const nodesLayer = document.getElementById("nodes")!;
const edgesLayer = document.getElementById("edges") as unknown as SVGSVGElement;
const labelsLayer = document.getElementById("labels")!;
const marquee = document.getElementById("marquee")!;
const errorBox = document.getElementById("error")!;
const colorbar = document.getElementById("colorbar")!;
const zoomLevel = document.getElementById("zoom-level")!;
const headMenu = document.getElementById("head-menu")!;


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
  return `<svg class="style-icon" viewBox="0 0 32 22" width="32" height="22" style="--edge-width: ${Math.min(width, 3.5)}px">
    <path class="stroke" d="${d}" stroke-dasharray="${dash}"/>${heads}</svg>`;
}

function icon(name: string): string {
  const paths: Record<string, string> = {
    card: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9h10M7 13h7"/>',
    file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1"/><path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1"/>',
    group: '<rect x="3" y="3" width="18" height="18" rx="2" stroke-dasharray="3 3"/><rect x="7" y="8" width="6" height="5" rx="1"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    fit: '<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/>',
    undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
    redo: '<path d="m15 14 5-5-5-5"/><path d="M20 9H9a5 5 0 0 0 0 10h3"/>',
    open: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  };
  return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths[name]}</svg>`;
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
  post({ type: "edit", text: snapshot() });
  render();
}

// ---------------------------------------------------------------- view

function applyView(): void {
  world.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`;
  viewport.style.backgroundPosition = `${view.x}px ${view.y}px`;
  viewport.style.backgroundSize = `${GRID * view.zoom}px ${GRID * view.zoom}px`;
  viewport.classList.toggle("far", view.zoom < 0.5);
  zoomLevel.textContent = `${Math.round(view.zoom * 100)}%`;
  vscode.setState({ view, edgeDefaults });
}

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
  renderNodes();
  renderEdges();
  updateColorbar();
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
      if (node.type === "text") {
        body.innerHTML = renderMarkdown(node.text) || '<p class="placeholder">Double-click to write</p>';
      } else if (node.type === "file") {
        renderFile(el, body, node, missing);
      } else {
        renderLink(el, body, node.url);
      }
      nodesLayer.append(el);
    }

    for (const side of SIDES) {
      const h = document.createElement("div");
      h.className = `connect side-${side}`;
      h.dataset.side = side;
      el.append(h);
    }
    const resize = document.createElement("div");
    resize.className = "resize";
    el.append(resize);
  }
  if (missing.length) post({ type: "resolve", paths: missing });
  if (editing) startEditing(editing);
}

function placeNode(el: HTMLElement, node: CanvasNode): void {
  el.style.left = `${node.x}px`;
  el.style.top = `${node.y}px`;
  el.style.width = `${node.width}px`;
  el.style.height = `${node.height}px`;
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
    case "text":
      body.innerHTML = /\.(md|markdown)$/i.test(node.file)
        ? renderMarkdown(stripFrontMatter(info.text))
        : `<pre><code>${escapeHtml(info.text)}</code></pre>`;
      break;
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
  const [autoFrom, autoTo] = autoSides(from, to);
  const fromSide = edge.fromSide ?? autoFrom;
  const toSide = edge.toSide ?? autoTo;
  return edgePath(anchor(from, fromSide), fromSide, anchor(to, toSide), toSide, edgeStyle(edge).pathStyle);
}

function renderEdges(): void {
  edgesLayer.replaceChildren();
  labelsLayer.replaceChildren();
  for (const edge of data.edges) {
    const geo = edgeGeometry(edge);
    if (!geo) continue;
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
    path.setAttribute("d", geo.d);
    path.classList.add("line");
    if (dash) path.setAttribute("stroke-dasharray", dash);
    g.append(hit, path);

    const size = 8 + width * 2;
    g.insertAdjacentHTML(
      "beforeend",
      headSvg(style.toHead, geo.end, geo.endDir, size) + headSvg(style.fromHead, geo.start, geo.startDir, size),
    );
    edgesLayer.append(g);

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
}


/** Shows a changed selection without redrawing, so the elements under the pointer stay the same (a double-click needs that). */
function showSelection(): void {
  world.querySelectorAll<HTMLElement>(".node, .edge, .edge-label").forEach((el) => {
    el.classList.toggle("selected", selection.has(el.dataset.id!));
  });
  updateColorbar();
}

function updateColorbar(): void {
  colorbar.hidden = selection.size === 0 || editing !== null;
  const items = [...selection].map((id) => nodeById(id) ?? edgeById(id)).filter(Boolean);
  const colors = new Set(items.map((i) => i!.color ?? ""));
  const current = colors.size === 1 ? [...colors][0]! : null;
  colorbar.querySelectorAll<HTMLElement>("[data-color]").forEach((b) => {
    b.classList.toggle("active", b.dataset.color === current);
  });

  // The edge tools show when edges are selected. A value all of them share is marked.
  const styles = [...selection].map(edgeById).filter((e): e is CanvasEdge => !!e).map(edgeStyle);
  colorbar.classList.toggle("has-edges", styles.length > 0);
  if (!styles.length) headMenu.hidden = true;
  const shared = <K extends keyof EdgeStyle>(key: K): EdgeStyle[K] | undefined =>
    styles.every((s) => s[key] === styles[0]?.[key]) ? styles[0]?.[key] : undefined;
  colorbar.querySelectorAll<HTMLElement>("[data-style]").forEach((b) => {
    b.classList.toggle("active", shared(b.dataset.style as keyof EdgeStyle) === b.dataset.value);
  });
  for (const key of ["fromHead", "toHead"] as const) {
    const button = colorbar.querySelector<HTMLElement>(`[data-menu="${key}"]`)!;
    button.innerHTML = styleIcon({ [key]: shared(key) ?? "arrow" });
  }
}

/** Sets part of the look of the selected edges, and of new ones. */
function setSelectedEdgeStyle(style: Partial<EdgeStyle>): void {
  edgeDefaults = { ...edgeDefaults, ...style };
  for (const id of selection) {
    const edge = edgeById(id);
    if (edge) setEdgeStyle(edge, style);
  }
  commit();
}

function toggleHeadMenu(button: HTMLElement): void {
  const key = button.dataset.menu as "fromHead" | "toHead";
  if (!headMenu.hidden && headMenu.dataset.for === key) {
    headMenu.hidden = true;
    return;
  }
  headMenu.dataset.for = key;
  headMenu.innerHTML = HEAD_SHAPES.map(
    (v) => `<button data-style="${key}" data-value="${v}" title="${v[0]!.toUpperCase() + v.slice(1)}">${styleIcon({ [key]: v })}</button>`,
  ).join("");
  // Under the button, kept inside the bar so it does not run off the edge.
  headMenu.style.right = `${Math.max(0, colorbar.clientWidth - button.offsetLeft - button.offsetWidth - 40)}px`;
  headMenu.hidden = false;
  updateColorbar();
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
  return { id: newId(), type: "text", text, x: snap(p.x - 125, GRID), y: snap(p.y - 30, GRID), width: 260, height: 80 };
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

function deleteSelection(): void {
  if (selection.size === 0) return;
  data.nodes = data.nodes.filter((n) => !selection.has(n.id));
  const ids = new Set(data.nodes.map((n) => n.id));
  data.edges = data.edges.filter((e) => !selection.has(e.id) && ids.has(e.fromNode) && ids.has(e.toNode));
  selection.clear();
  commit();
}

function setColor(color: string): void {
  if (selection.size === 0) return;
  for (const id of selection) {
    const item = nodeById(id) ?? edgeById(id);
    if (!item) continue;
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
    map.set(n.id, copy.id);
    if (copy.type === "group") data.nodes.unshift(copy);
    else data.nodes.push(copy);
    selection.add(copy.id);
  }
  for (const e of fragment.edges) {
    const from = map.get(e.fromNode);
    const to = map.get(e.toNode);
    if (from && to) data.edges.push({ ...structuredClone(e), id: newId(), fromNode: from, toNode: to });
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
  if (!node || !el) return;
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

  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    editing = null;
    const value = node.type === "text" ? field.value : field.value.trim();
    const old = node.type === "text" ? node.text : node.url;
    if (value !== old) {
      if (node.type === "text") node.text = value;
      else node.url = value;
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
  if (!group || group.type !== "group") return;
  inlineInput({ x: group.x, y: group.y - 34 }, group.label ?? "", (label) => {
    if (label) group.label = label;
    else delete group.label;
    commit();
  });
}

function editEdgeLabel(id: string): void {
  const edge = edgeById(id);
  const geo = edge && edgeGeometry(edge);
  if (!edge || !geo) return;
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
  | { kind: "move"; start: Point; nodes: { node: CanvasNode; x: number; y: number }[]; moved: boolean; clickedId: string }
  | { kind: "resize"; start: Point; node: CanvasNode; width: number; height: number }
  | { kind: "connect"; from: CanvasNode; side: Side; preview: SVGPathElement };

let drag: Drag | null = null;

viewport.addEventListener("pointerdown", (e) => {
  if (!loaded) return;
  const target = e.target as HTMLElement;
  if (target.closest(".editor, .inline-input")) return;
  if (editing) (document.activeElement as HTMLElement | null)?.blur();
  viewport.focus();
  const p = toWorld(e.clientX, e.clientY);

  if (e.button === 1 || (e.button === 0 && spaceHeld)) {
    e.preventDefault();
    drag = { kind: "pan", start: { x: e.clientX, y: e.clientY }, view: { ...view } };
    viewport.classList.add("panning");
    viewport.setPointerCapture(e.pointerId);
    return;
  }
  if (e.button !== 0) return;

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

  if (node && target.classList.contains("resize")) {
    drag = { kind: "resize", start: p, node, width: node.width, height: node.height };
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
    const moving = new Map<string, CanvasNode>();
    for (const n of selectedNodes()) {
      moving.set(n.id, n);
      if (n.type === "group") for (const c of childrenOf(n)) moving.set(c.id, c);
    }
    drag = {
      kind: "move",
      start: p,
      nodes: [...moving.values()].map((n) => ({ node: n, x: n.x, y: n.y })),
      moved: false,
      clickedId: node.id,
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

function insideGroupBody(group: CanvasNode, p: Point): boolean {
  const edge = 12 / view.zoom;
  return p.x > group.x + edge && p.x < group.x + group.width - edge && p.y > group.y + edge && p.y < group.y + group.height - edge;
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
      for (const n of data.nodes) if (rectsIntersect(r, n) && (n.type !== "group" || containsRect(r, n))) selection.add(n.id);
      showSelection();
      break;
    }
    case "move": {
      let dx = p.x - drag.start.x;
      let dy = p.y - drag.start.y;
      if (!drag.moved && Math.hypot(dx, dy) * view.zoom < 3) return;
      drag.moved = true;
      if (!e.altKey) {
        // Snap the clicked card to the grid; the others keep their offsets to it.
        const clicked = drag.clickedId;
        const lead = drag.nodes.find((m) => m.node.id === clicked) ?? drag.nodes[0]!;
        dx = snap(lead.x + dx, GRID) - lead.x;
        dy = snap(lead.y + dy, GRID) - lead.y;
      }
      for (const m of drag.nodes) {
        m.node.x = m.x + dx;
        m.node.y = m.y + dy;
        const el = nodeElement(m.node.id);
        if (el) placeNode(el, m.node);
      }
      renderEdges();
      break;
    }
    case "resize": {
      const n = drag.node;
      const minW = 60;
      const minH = 40;
      n.width = Math.max(minW, e.altKey ? drag.width + p.x - drag.start.x : snap(n.x + drag.width + p.x - drag.start.x, GRID) - n.x);
      n.height = Math.max(minH, e.altKey ? drag.height + p.y - drag.start.y : snap(n.y + drag.height + p.y - drag.start.y, GRID) - n.y);
      const el = nodeElement(n.id);
      if (el) placeNode(el, n);
      renderEdges();
      break;
    }
    case "connect": {
      const a = anchor(drag.from, drag.side);
      const over = nodeUnder(e.clientX, e.clientY);
      const toSide = over && over.id !== drag.from.id ? sideFacing(over, nearCenter(over, p) ? a : p) : null;
      const b = over && toSide ? anchor(over, toSide) : p;
      drag.preview.setAttribute("d", edgePath(a, drag.side, b, toSide, edgeDefaults.pathStyle).d);
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
      if (d.node.width !== d.width || d.node.height !== d.height) {
        commit();
      }
      break;
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
        toSide: sideFacing(target, over && !nearCenter(over, p) ? p : anchor(d.from, d.side)),
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
  // Pointer capture makes the event's own target the viewport: look at what is under the pointer.
  const target = (document.elementFromPoint(e.clientX, e.clientY) ?? e.target) as HTMLElement;
  if (target.closest(".editor, .inline-input, .link-open")) return;
  const p = toWorld(e.clientX, e.clientY);
  const nodeEl = target.closest<HTMLElement>(".node");
  const node = nodeEl && nodeById(nodeEl.dataset.id!);
  if (node) {
    if (node.type === "file") post({ type: "openFile", path: node.file });
    else if (node.type === "group" && insideGroupBody(node, p) && !target.closest(".group-label")) addNode(textNodeAt(p), true);
    else startEditing(node.id);
    return;
  }
  const edgeEl = target.closest<HTMLElement | SVGElement>(".edge, .edge-label");
  if (edgeEl) {
    editEdgeLabel((edgeEl as HTMLElement).dataset.id!);
    return;
  }
  addNode(textNodeAt(p), true);
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
  if (!loaded || (e.target as HTMLElement).closest?.("input, textarea")) return;
  const mod = e.ctrlKey || e.metaKey;
  const key = e.key.toLowerCase();
  if (key === " " && !spaceHeld) {
    spaceHeld = true;
    viewport.classList.add("can-pan");
    e.preventDefault();
  } else if (key === "delete" || key === "backspace") {
    e.preventDefault();
    deleteSelection();
  } else if (mod && key === "a") {
    e.preventDefault();
    data.nodes.forEach((n) => selection.add(n.id));
    showSelection();
  } else if (mod && key === "d") {
    e.preventDefault();
    const fragment = copySelection() && clipboard;
    if (fragment) {
      const b = boundsOf(fragment.nodes)!;
      paste(fragment, { x: b.x + b.width / 2 + GRID * 2, y: b.y + b.height / 2 + GRID * 2 });
    }
  } else if (key === "escape") {
    selection.clear();
    showSelection();
  } else if (key === "enter" && selection.size === 1) {
    e.preventDefault();
    startEditing([...selection][0]!);
  } else if (e.shiftKey && (key === "1" || key === "!")) {
    fitToContent();
  } else if (e.shiftKey && (key === "2" || key === "@") && selection.size) {
    fitToContent(selectedNodes());
  } else if (mod && (key === "=" || key === "+")) {
    e.preventDefault();
    zoomBy(1.2);
  } else if (mod && key === "-") {
    e.preventDefault();
    zoomBy(1 / 1.2);
  } else if (mod && key === "0") {
    e.preventDefault();
    zoomBy(1 / view.zoom);
  } else if (key.startsWith("arrow") && selection.size) {
    e.preventDefault();
    const step = e.shiftKey ? GRID * 5 : GRID;
    const dx = key === "arrowleft" ? -step : key === "arrowright" ? step : 0;
    const dy = key === "arrowup" ? -step : key === "arrowdown" ? step : 0;
    for (const n of selectedNodes()) {
      n.x += dx;
      n.y += dy;
    }
    commit();
  }
});

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
  if (button.dataset.menu) return toggleHeadMenu(button);
  if (button.dataset.style) {
    if (button.parentElement === headMenu) headMenu.hidden = true;
    return setSelectedEdgeStyle({ [button.dataset.style]: button.dataset.value });
  }
  switch (button.dataset.action) {
    case "text":
      return addNode(textNodeAt(viewportCenter()), true);
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
    case "zoom-in":
      return zoomBy(1.2);
    case "zoom-out":
      return zoomBy(1 / 1.2);
    case "zoom-reset":
      return zoomBy(1 / view.zoom);
    case "fit":
      return fitToContent();
    case "undo":
      return post({ type: "undo" });
    case "redo":
      return post({ type: "redo" });
    case "source":
      return post({ type: "showSource" });
  }
});

colorbar.querySelector<HTMLInputElement>("input[type=color]")!.addEventListener("change", (e) => {
  setColor((e.target as HTMLInputElement).value);
});

window.addEventListener("resize", () => applyView());

// ---------------------------------------------------------------- messages from the host

window.addEventListener("message", (e: MessageEvent<HostMessage>) => {
  const msg = e.data;
  switch (msg.type) {
    case "load": {
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
  }
});

applyView();
post({ type: "ready" });
