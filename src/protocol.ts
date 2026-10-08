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
  | { type: "dropped"; items: DroppedItem[]; x: number; y: number }
  /**
   * The extension's settings. `drawingStyle` is the style canvases use unless they name their own;
   * `theme` is the paper: "auto" (follow VS Code), "light" or "dark".
   */
  | { type: "settings"; drawingStyle: string; theme: string }
  /** Export the canvas, or its selection, as a picture; the webview answers with `exported`. */
  | { type: "export"; format: ExportFormat; background: boolean; paper: "light" | "dark"; scale: 1 | 2 | 3 }
  /** The files an `inline` message asked for, as data URIs by path. */
  | { type: "inlined"; data: Record<string, string> };

export type ExportFormat = "png" | "svg";

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
  /**
   * Files to send back as data URIs, for an export that needs nothing outside itself. A path is relative
   * to the workspace root, or starts with "extension:" for a file of the extension, such as its fonts.
   */
  | { type: "inline"; paths: string[] }
  /** The exported picture, as base64, for the host to save. */
  | { type: "exported"; format: ExportFormat; base64: string }
  | { type: "undo" }
  | { type: "redo" };
