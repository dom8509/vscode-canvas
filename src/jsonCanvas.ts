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
