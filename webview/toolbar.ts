// The bottom toolbar: the tools and the buttons that add cards.

import { SHAPES, type ShapeKind } from "../src/jsonCanvas";
import { icon, shapeIcon, title } from "./icons";
import { shortcutText, tooltip } from "./shortcuts";

/** What a press on the canvas does. The select tool selects and moves; the others place or pan. */
export type Tool =
  | { kind: "select" }
  | { kind: "hand" }
  | { kind: "text" }
  | { kind: "shape"; shape: ShapeKind }
  /** The arrow tool and the line tool: they draw connections, with an arrow head or none. */
  | { kind: "connection"; heads: "arrow" | "line" }
  | { kind: "pen" }
  | { kind: "eraser" };

export const SELECT: Tool = { kind: "select" };

export interface ToolbarButton {
  action: string;
  icon: string;
  label: string;
  /** The shortcuts this button stands for. The first one's key is shown on the button. */
  shortcuts: string[];
}

export const TOOLBAR_BUTTONS: ToolbarButton[] = [
  { action: "select", icon: "select", label: "Select", shortcuts: ["select"] },
  { action: "hand", icon: "hand", label: "Hand: drag to pan", shortcuts: ["hand"] },
  { action: "text-tool", icon: "type", label: "Text: click on the canvas to write", shortcuts: ["text"] },
  { action: "shapes", icon: "shapes", label: "Shapes: pick one, then click or drag on the canvas", shortcuts: ["rectangle", "ellipse"] },
  { action: "arrow-tool", icon: "arrow", label: "Arrow: drag between cards or anywhere", shortcuts: ["arrow"] },
  { action: "line-tool", icon: "line", label: "Line: drag between cards or anywhere", shortcuts: ["line"] },
  { action: "pen-tool", icon: "pen", label: "Pen: draw freehand", shortcuts: ["pen"] },
  { action: "eraser-tool", icon: "eraser", label: "Eraser: wipe strokes away", shortcuts: ["eraser"] },
  { action: "text", icon: "card", label: "Add card (or double-click the canvas)", shortcuts: ["card"] },
  { action: "file", icon: "file", label: "Add note or media from the workspace", shortcuts: [] },
  { action: "image", icon: "image", label: "Add image (or paste one)", shortcuts: [] },
  { action: "link", icon: "link", label: "Add web page", shortcuts: [] },
  { action: "group", icon: "group", label: "Add group (around the selection, if any)", shortcuts: ["group"] },
];

function buttonHtml(b: ToolbarButton): string {
  const keys = b.shortcuts.map((id) => shortcutText(id));
  const tip = keys.length ? `${b.label} (${keys.join(", ")})` : b.label;
  const hint = keys[0] ? `<kbd class="key-hint">${keys[0]}</kbd>` : "";
  return `<button data-action="${b.action}" title="${tip}">${icon(b.icon)}${hint}</button>`;
}

export function toolbarHtml(): string {
  return `<div id="toolbar">
    ${TOOLBAR_BUTTONS.map(buttonHtml).join("")}
    <div id="shape-menu" hidden>
      ${SHAPES.map((k) => {
        const label = title(k.replace("-", " "));
        const tip = k === "rectangle" || k === "ellipse" ? tooltip(k, label) : label;
        return `<button data-shape="${k}" title="${tip}">${shapeIcon(k)}</button>`;
      }).join("")}
    </div>
  </div>`;
}

/** Marks the tool's button and sets the canvas cursor for it. */
export function showTool(toolbar: HTMLElement, viewport: HTMLElement, tool: Tool): void {
  viewport.classList.toggle("placing", tool.kind === "text" || tool.kind === "shape" || tool.kind === "connection" || tool.kind === "pen" || tool.kind === "eraser");
  viewport.classList.toggle("hand", tool.kind === "hand");
  const active: Record<string, boolean> = {
    select: tool.kind === "select",
    hand: tool.kind === "hand",
    "text-tool": tool.kind === "text",
    shapes: tool.kind === "shape",
    "arrow-tool": tool.kind === "connection" && tool.heads === "arrow",
    "line-tool": tool.kind === "connection" && tool.heads === "line",
    "pen-tool": tool.kind === "pen",
    "eraser-tool": tool.kind === "eraser",
  };
  for (const [action, on] of Object.entries(active)) {
    toolbar.querySelector(`[data-action="${action}"]`)!.classList.toggle("active", on);
  }
  toolbar.querySelector<HTMLElement>("#shape-menu")!.hidden = true;
}
