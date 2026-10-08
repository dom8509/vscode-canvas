// The JSON Canvas format (https://jsoncanvas.org), as Obsidian writes it.
// Shared by the extension host and the webview.

export type Side = "top" | "right" | "bottom" | "left";
export type EndShape = "none" | "arrow";

/** "1" to "6" (Obsidian's preset colors) or a hex color like "#ff8800". */
export type CanvasColor = string;

interface NodeBase {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color?: CanvasColor;
  /** Properties this extension does not know are kept as they are. */
  [key: string]: unknown;
}

export interface TextNode extends NodeBase {
  type: "text";
  text: string;
}

export interface FileNode extends NodeBase {
  type: "file";
  file: string;
  subpath?: string;
}

export interface LinkNode extends NodeBase {
  type: "link";
  url: string;
}

export interface GroupNode extends NodeBase {
  type: "group";
  label?: string;
  background?: string;
  backgroundStyle?: "cover" | "ratio" | "repeat";
}

export type CanvasNode = TextNode | FileNode | LinkNode | GroupNode;

export interface CanvasEdge {
  id: string;
  fromNode: string;
  fromSide?: Side;
  fromEnd?: EndShape;
  toNode: string;
  toSide?: Side;
  toEnd?: EndShape;
  color?: CanvasColor;
  label?: string;
  [key: string]: unknown;
}

export interface CanvasData {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  [key: string]: unknown;
}

const NODE_TYPES = new Set(["text", "file", "link", "group"]);
const SIDES = new Set(["top", "right", "bottom", "left"]);

export const PRESET_COLORS: Record<string, string> = {
  "1": "#fb464c",
  "2": "#e9973f",
  "3": "#e0de71",
  "4": "#44cf6e",
  "5": "#53dfdd",
  "6": "#a882ff",
};

/** The CSS color of a canvas color, or undefined for none. */
export function cssColor(color: CanvasColor | undefined): string | undefined {
  if (!color) return undefined;
  return PRESET_COLORS[color] ?? (/^#[0-9a-f]{3,8}$/i.test(color) ? color : undefined);
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function num(v: unknown, fallback: number): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Reads a .canvas file. An empty file is an empty canvas. Throws on text that
 * is not JSON. Nodes and edges that are broken beyond repair are dropped.
 */
export function parseCanvas(text: string): CanvasData {
  if (text.trim() === "") return { nodes: [], edges: [] };
  const raw: unknown = JSON.parse(text);
  if (!isObject(raw)) throw new Error("A canvas file must hold a JSON object.");

  const nodes: CanvasNode[] = [];
  const ids = new Set<string>();
  for (const n of Array.isArray(raw.nodes) ? raw.nodes : []) {
    if (!isObject(n) || typeof n.id !== "string" || !NODE_TYPES.has(n.type as string)) continue;
    if (ids.has(n.id)) continue;
    ids.add(n.id);
    const node = {
      ...n,
      x: num(n.x, 0),
      y: num(n.y, 0),
      width: Math.max(1, num(n.width, 250)),
      height: Math.max(1, num(n.height, 60)),
    } as CanvasNode;
    if (node.type === "text" && typeof node.text !== "string") node.text = "";
    if (node.type === "file" && typeof node.file !== "string") node.file = "";
    if (node.type === "link" && typeof node.url !== "string") node.url = "";
    nodes.push(node);
  }

  const edges: CanvasEdge[] = [];
  const edgeIds = new Set<string>();
  for (const e of Array.isArray(raw.edges) ? raw.edges : []) {
    if (!isObject(e) || typeof e.id !== "string" || edgeIds.has(e.id)) continue;
    if (typeof e.fromNode !== "string" || typeof e.toNode !== "string") continue;
    if (!ids.has(e.fromNode) || !ids.has(e.toNode)) continue;
    edgeIds.add(e.id);
    const edge = { ...e } as CanvasEdge;
    if (edge.fromSide && !SIDES.has(edge.fromSide)) delete edge.fromSide;
    if (edge.toSide && !SIDES.has(edge.toSide)) delete edge.toSide;
    edges.push(edge);
  }

  return { ...raw, nodes, edges };
}

/** Writes a canvas the way Obsidian does: tab-indented JSON. */
export function serializeCanvas(data: CanvasData): string {
  return JSON.stringify(data, null, "\t");
}

/** A random 16-digit hex id, the shape Obsidian uses. */
export function newId(): string {
  let id = "";
  for (let i = 0; i < 16; i++) id += Math.floor(Math.random() * 16).toString(16);
  return id;
}

const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "bmp", "svg", "webp", "avif"]);

export function isImagePath(path: string): boolean {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return IMAGE_EXTENSIONS.has(ext);
}

const TEXT_EXTENSIONS = new Set([
  "md", "markdown", "txt", "json", "yaml", "yml", "toml", "csv", "js", "ts", "tsx", "jsx",
  "py", "rs", "go", "java", "c", "cpp", "h", "cs", "rb", "php", "sh", "css", "html", "xml", "sql",
]);

export function isTextPath(path: string): boolean {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return TEXT_EXTENSIONS.has(ext);
}

const IMAGE_MIME_EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/bmp": "bmp",
  "image/svg+xml": "svg",
  "image/webp": "webp",
  "image/avif": "avif",
};

/** True for an image the canvas can show, by MIME type or file name. */
export function isImageFile(mime: string, name = ""): boolean {
  return mime in IMAGE_MIME_EXTENSIONS || isImagePath(name);
}

/**
 * The file name for an image saved into the workspace. A named file keeps its
 * name; a pasted one is called "Pasted image 20240131154500.png", as in Obsidian.
 */
export function imageFileName(mime: string, name: string, date: Date): string {
  const clean = name.split(/[\\/]/).pop()!.replace(/[:*?"<>|]/g, "-").trim();
  if (clean && isImagePath(clean)) return clean;
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp =
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  return `Pasted image ${stamp}.${IMAGE_MIME_EXTENSIONS[mime] ?? "png"}`;
}

/** "name.png", or "name 1.png", "name 2.png", … when that is taken. */
export function uniqueFileName(name: string, taken: (name: string) => boolean): string {
  if (!taken(name)) return name;
  const dot = name.lastIndexOf(".");
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : "";
  for (let i = 1; ; i++) {
    const candidate = `${stem} ${i}${ext}`;
    if (!taken(candidate)) return candidate;
  }
}

// ---------------------------------------------------------------- edge styles
// JSON Canvas knows only "none" and "arrow" ends. The other looks are kept in
// extra properties, so Obsidian still shows an arrow where there is a head.

export type HeadShape = "none" | "arrow" | "open" | "dot" | "bar" | "diamond";
export type LineStyle = "solid" | "dashed" | "dotted";
export type LineWidth = "thin" | "normal" | "bold" | "extra";
export type PathStyle = "curved" | "straight" | "elbow";

export const HEAD_SHAPES: HeadShape[] = ["none", "arrow", "open", "dot", "bar", "diamond"];
export const LINE_STYLES: LineStyle[] = ["solid", "dashed", "dotted"];
export const LINE_WIDTHS: LineWidth[] = ["thin", "normal", "bold", "extra"];
export const PATH_STYLES: PathStyle[] = ["curved", "straight", "elbow"];

/** The look of an edge, with the defaults filled in. */
export interface EdgeStyle {
  fromHead: HeadShape;
  toHead: HeadShape;
  lineStyle: LineStyle;
  lineWidth: LineWidth;
  pathStyle: PathStyle;
}

function oneOf<T extends string>(list: T[], v: unknown, fallback: T): T {
  return list.includes(v as T) ? (v as T) : fallback;
}

export function edgeStyle(edge: CanvasEdge): EdgeStyle {
  const head = (end: EndShape | undefined, shape: unknown, fallback: EndShape): HeadShape =>
    (end ?? fallback) === "none" ? "none" : oneOf(HEAD_SHAPES, shape, "arrow");
  return {
    fromHead: head(edge.fromEnd, edge.fromHead, "none"),
    toHead: head(edge.toEnd, edge.toHead, "arrow"),
    lineStyle: oneOf(LINE_STYLES, edge.lineStyle, "solid"),
    lineWidth: oneOf(LINE_WIDTHS, edge.lineWidth, "normal"),
    pathStyle: oneOf(PATH_STYLES, edge.pathStyle, "curved"),
  };
}

const STYLE_DEFAULTS: Record<"lineStyle" | "lineWidth" | "pathStyle", string> = {
  lineStyle: "solid",
  lineWidth: "normal",
  pathStyle: "curved",
};

/** Sets part of an edge's look. Defaults are left out of the file. */
export function setEdgeStyle(edge: CanvasEdge, style: Partial<EdgeStyle>): void {
  for (const [key, value] of Object.entries(style) as [keyof EdgeStyle, string][]) {
    if (key === "fromHead" || key === "toHead") {
      const end = key === "fromHead" ? "fromEnd" : "toEnd";
      const defaultEnd = key === "fromHead" ? "none" : "arrow";
      const plain = value === "none" ? "none" : "arrow";
      if (plain === defaultEnd) delete edge[end];
      else edge[end] = plain;
      if (value === "none" || value === "arrow") delete edge[key];
      else edge[key] = value;
    } else if (value === STYLE_DEFAULTS[key]) {
      delete edge[key];
    } else {
      edge[key] = value;
    }
  }
}

// ---------------------------------------------------------------- shapes and free text
// Text cards can be drawn as a shape, as in tldraw, or as bare text, as in
// Excalidraw. Obsidian shows both as ordinary text cards.

export type ShapeKind =
  | "rectangle" | "ellipse" | "triangle" | "diamond" | "pentagon" | "hexagon"
  | "octagon" | "star" | "rhombus" | "trapezoid" | "cloud" | "heart"
  | "arrow-right" | "arrow-left" | "arrow-up" | "arrow-down" | "x-box" | "check-box";
export type Fill = "none" | "semi" | "solid";
export type FontSize = "s" | "m" | "l" | "xl";
export type FontFamily = "sans" | "serif" | "mono" | "hand";

export const SHAPES: ShapeKind[] = [
  "rectangle", "ellipse", "triangle", "diamond", "pentagon", "hexagon",
  "octagon", "star", "rhombus", "trapezoid", "cloud", "heart",
  "arrow-right", "arrow-left", "arrow-up", "arrow-down", "x-box", "check-box",
];
export const FILLS: Fill[] = ["none", "semi", "solid"];
export const FONT_SIZES: FontSize[] = ["s", "m", "l", "xl"];
export const FONT_FAMILIES: FontFamily[] = ["sans", "serif", "mono", "hand"];

/**
 * How a text card is drawn, with the defaults filled in. "card" is a plain
 * Obsidian card. Its font size is undefined until set: it keeps the editor's size.
 */
export interface NodeLook {
  /** "point" is the hidden node of a free end; it has no look to set. "draw" is a pen stroke. */
  shape: ShapeKind | "text" | "card" | "point" | "draw";
  fill: Fill;
  fontSize: FontSize | undefined;
  fontFamily: FontFamily;
  /** The border of a card or the outline of a shape. */
  strokeWidth: LineWidth;
}

export function nodeLook(node: CanvasNode): NodeLook {
  const shape =
    node.type !== "text" ? "card" : node.shape === "text" || node.shape === "point" || node.shape === "draw" ? node.shape : oneOf(SHAPES, node.shape, "card" as ShapeKind);
  const size = FONT_SIZES.includes(node.fontSize as FontSize) ? (node.fontSize as FontSize) : undefined;
  return {
    shape: shape as NodeLook["shape"],
    // A stroke closed into a custom shape starts unfilled, so it does not hide what it is drawn around.
    fill: oneOf(FILLS, node.fill, isStroke(node) ? "none" : "semi"),
    fontSize: size ?? (shape === "card" ? undefined : "m"),
    fontFamily: oneOf(FONT_FAMILIES, node.fontFamily, "sans"),
    strokeWidth: oneOf(LINE_WIDTHS, node.strokeWidth, "normal"),
  };
}

const LOOK_DEFAULTS: Record<keyof NodeLook, string> = {
  shape: "card",
  fill: "semi",
  fontSize: "",
  fontFamily: "sans",
  strokeWidth: "normal",
};

/** Sets part of the look of a text card or a file card. Defaults are left out of the file. */
export function setNodeLook(node: CanvasNode, look: Partial<NodeLook>): void {
  if ((node.type !== "text" && node.type !== "file") || isPoint(node)) return;
  for (const [key, value] of Object.entries(look) as [keyof NodeLook, string | undefined][]) {
    const fallback = key === "fill" && isStroke(node) ? "none" : LOOK_DEFAULTS[key];
    if (!value || value === fallback) delete node[key];
    else node[key] = value;
  }
}

/** How much bigger free text is drawn than its font size, after being scaled by a corner handle. 1 is its normal size. */
export function textScaleOf(node: CanvasNode): number {
  const s = node.textScale;
  return typeof s === "number" && Number.isFinite(s) && s > 0 ? s : 1;
}

export function setTextScale(node: CanvasNode, scale: number): void {
  const s = Math.round(Math.min(MAX_TEXT_SCALE, Math.max(MIN_TEXT_SCALE, scale)) * 1000) / 1000;
  if (s === 1) delete node.textScale;
  else node.textScale = s;
}

export const MIN_TEXT_SCALE = 0.25;
export const MAX_TEXT_SCALE = 20;

/** An angle in degrees, brought into (-180, 180]. */
export function normalizeAngle(deg: number): number {
  let r = ((deg % 360) + 360) % 360;
  if (r > 180) r -= 360;
  return Math.round(r * 100) / 100 || 0;
}

/** How far a card is turned, clockwise in degrees. Not part of JSON Canvas: Obsidian shows it upright. */
export function rotationOf(node: CanvasNode): number {
  return typeof node.rotation === "number" && Number.isFinite(node.rotation) ? normalizeAngle(node.rotation) : 0;
}

export function setRotation(node: CanvasNode, deg: number): void {
  const r = normalizeAngle(deg);
  if (r === 0) delete node.rotation;
  else node.rotation = r;
}

// ---------------------------------------------------------------- lock
// A locked card, group or connection cannot be moved, resized, turned, edited,
// restyled or deleted. Not part of JSON Canvas: Obsidian ignores it.

export function isLocked(element: CanvasNode | CanvasEdge): boolean {
  return element.locked === true;
}

export function setLocked(element: CanvasNode | CanvasEdge, on: boolean): void {
  if (on) element.locked = true;
  else delete element.locked;
}

// ---------------------------------------------------------------- free ends
// JSON Canvas edges always join two nodes. A free end joins a point: a tiny,
// empty text node the canvas never shows. Obsidian shows it as a tiny card.

/** The node that holds a free end. */
export function isPoint(node: CanvasNode): boolean {
  return node.type === "text" && node.shape === "point";
}

/** A new point centered on `p`. */
export function pointNodeAt(p: { x: number; y: number }): TextNode {
  const round = (v: number) => Math.round(v * 10) / 10;
  return { id: newId(), type: "text", text: "", shape: "point", x: round(p.x - 0.5), y: round(p.y - 0.5), width: 1, height: 1 };
}

/** Removes the points no connection names any more. */
export function prunePoints(data: CanvasData): void {
  const named = new Set(data.edges.flatMap((e) => [e.fromNode, e.toNode]));
  data.nodes = data.nodes.filter((n) => !isPoint(n) || named.has(n.id));
}

/** The points at the ends of the given connections, for a move (`skipLocked`: a locked one stays put) or a copy. */
export function pointsOfEdges(data: CanvasData, edgeIds: Iterable<string>, skipLocked = false): CanvasNode[] {
  const ids = new Set(edgeIds);
  const ends = new Set(data.edges.filter((e) => ids.has(e.id) && !(skipLocked && isLocked(e))).flatMap((e) => [e.fromNode, e.toNode]));
  return data.nodes.filter((n) => isPoint(n) && ends.has(n.id));
}

/** Where a dragged end lands: a card at one of its sides, or a free end at a spot. */
export type EndTarget = { node: string; side: Side } | { at: { x: number; y: number } };

/**
 * Moves one end of a connection to a card or to empty space, where it gets a new point. Returns
 * false when nothing changes: a locked connection, or the card at its other end.
 */
export function rebind(data: CanvasData, edgeId: string, end: "from" | "to", target: EndTarget): boolean {
  const edge = data.edges.find((e) => e.id === edgeId);
  if (!edge || isLocked(edge)) return false;
  const [node, side, other] = end === "from" ? (["fromNode", "fromSide", edge.toNode] as const) : (["toNode", "toSide", edge.fromNode] as const);
  if ("node" in target) {
    if (target.node === other || (target.node === edge[node] && target.side === edge[side])) return false;
    edge[node] = target.node;
    edge[side] = target.side;
  } else {
    const point = pointNodeAt(target.at);
    data.nodes.push(point);
    edge[node] = point.id;
    delete edge[side];
  }
  return true;
}

// ---------------------------------------------------------------- bends
// A connection can bend through points pinned while drawing it. Saved as a flat
// list `"bends": [x1, y1, x2, y2, …]` in canvas coordinates; Obsidian draws the
// connection straight from end to end.

/** The bends of a connection, or none when the list is missing or broken. */
export function bendsOf(edge: CanvasEdge): { x: number; y: number }[] {
  return pairs(edge.bends);
}

export function setBends(edge: CanvasEdge, points: { x: number; y: number }[]): void {
  if (points.length) edge.bends = flat(points);
  else delete edge.bends;
}

/** A flat list `[x1, y1, x2, y2, …]` as points, or none when it is missing or broken. */
function pairs(list: unknown): { x: number; y: number }[] {
  if (!Array.isArray(list) || list.length % 2 !== 0 || !list.every((v) => typeof v === "number" && Number.isFinite(v))) return [];
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i < list.length; i += 2) out.push({ x: list[i] as number, y: list[i + 1] as number });
  return out;
}

/** Points as a flat list, rounded to one decimal. */
function flat(points: { x: number; y: number }[]): number[] {
  const round = (v: number) => Math.round(v * 10) / 10 || 0;
  return points.flatMap((p) => [round(p.x), round(p.y)]);
}

// ---------------------------------------------------------------- strokes
// A pen stroke is an empty text node with `"shape": "draw"`, its bounding box,
// and its points relative to the box's top left. Obsidian shows an empty card.

export function isStroke(node: CanvasNode): boolean {
  return node.type === "text" && node.shape === "draw";
}

export function strokePoints(node: CanvasNode): { x: number; y: number }[] {
  return pairs(node.points);
}

export function setStrokePoints(node: CanvasNode, points: { x: number; y: number }[]): void {
  node.points = flat(points);
}

/** A stroke whose ends met: a custom shape, with a fill and text. */
export function isClosed(node: CanvasNode): boolean {
  return isStroke(node) && node.closed === true;
}

export function setClosed(node: CanvasNode, on: boolean): void {
  if (on) node.closed = true;
  else delete node.closed;
}
