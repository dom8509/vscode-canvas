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
export type LineWidth = "thin" | "normal" | "bold";
export type PathStyle = "curved" | "straight" | "elbow";

export const HEAD_SHAPES: HeadShape[] = ["none", "arrow", "open", "dot", "bar", "diamond"];
export const LINE_STYLES: LineStyle[] = ["solid", "dashed", "dotted"];
export const LINE_WIDTHS: LineWidth[] = ["thin", "normal", "bold"];
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
