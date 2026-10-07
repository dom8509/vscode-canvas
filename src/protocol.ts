// Messages between the extension host and the canvas webview.

export type FileInfo =
  | { kind: "image"; src: string }
  | { kind: "text"; text: string }
  | { kind: "other" }
  | { kind: "missing" };

export type HostMessage =
  | { type: "load"; text: string }
  | { type: "files"; files: Record<string, FileInfo> }
  | { type: "picked"; paths: string[] }
  | { type: "dropped"; items: DroppedItem[]; x: number; y: number };

/** A dropped file becomes a file card when it lies in the workspace, otherwise a text card with its contents. */
export type DroppedItem = { kind: "file"; path: string } | { kind: "text"; text: string };

/** An image pasted or dropped from outside VS Code, as base64. The host saves it next to the canvas. */
export interface ImageData {
  name: string;
  mime: string;
  base64: string;
}

export type WebviewMessage =
  | { type: "ready" }
  | { type: "edit"; text: string }
  | { type: "resolve"; paths: string[] }
  | { type: "openFile"; path: string; subpath?: string }
  | { type: "openLink"; href: string }
  | { type: "pickFile" }
  | { type: "pickImages" }
  | { type: "saveImages"; images: ImageData[]; x: number; y: number }
  | { type: "dropUris"; uris: string[]; x: number; y: number }
  | { type: "notify"; text: string }
  | { type: "showSource" }
  | { type: "undo" }
  | { type: "redo" };
