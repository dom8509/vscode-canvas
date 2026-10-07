// Messages between the extension host and the canvas webview.

export type FileInfo =
  | { kind: "image"; src: string }
  | { kind: "text"; text: string }
  | { kind: "other" }
  | { kind: "missing" };

export type HostMessage =
  | { type: "load"; text: string }
  | { type: "files"; files: Record<string, FileInfo> }
  | { type: "picked"; path: string }
  | { type: "dropped"; items: DroppedItem[]; x: number; y: number };

/** A dropped file becomes a file card when it lies in the workspace, otherwise a text card with its contents. */
export type DroppedItem = { kind: "file"; path: string } | { kind: "text"; text: string };

export type WebviewMessage =
  | { type: "ready" }
  | { type: "edit"; text: string }
  | { type: "resolve"; paths: string[] }
  | { type: "openFile"; path: string }
  | { type: "openLink"; href: string }
  | { type: "pickFile" }
  | { type: "dropUris"; uris: string[]; x: number; y: number }
  | { type: "notify"; text: string }
  | { type: "showSource" }
  | { type: "undo" }
  | { type: "redo" };
