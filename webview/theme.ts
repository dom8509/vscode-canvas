// The paper the canvas is drawn on: light or dark. Only how it looks; the file stays the same.

export type Paper = "light" | "dark";

/**
 * The paper for the `canvas.theme` setting ("auto", "light" or "dark") and the classes VS Code puts on the
 * webview's body (vscode-light, vscode-dark, vscode-high-contrast, vscode-high-contrast-light). Auto follows VS Code.
 */
export function resolveTheme(setting: unknown, bodyClass: string): Paper {
  if (setting === "light" || setting === "dark") return setting;
  const classes = bodyClass.split(/\s+/);
  if (classes.includes("vscode-light") || classes.includes("vscode-high-contrast-light")) return "light";
  if (classes.includes("vscode-dark") || classes.includes("vscode-high-contrast")) return "dark";
  return "light";
}
