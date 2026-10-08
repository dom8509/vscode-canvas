import * as vscode from "vscode";
import { imageFileName, isImagePath, isTextPath, mimeOf, uniqueFileName } from "./jsonCanvas";
import { findSection } from "./subpath";
import type { DroppedItem, ExportFormat, FileInfo, HostMessage, ImageData, WebviewMessage } from "./protocol";

const MAX_DROPPED_FILES = 50;
const EXCLUDED = "{**/node_modules/**,**/.git/**,**/*.canvas}";
const MAX_PREVIEW_BYTES = 1_000_000;
const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "gif", "bmp", "svg", "webp", "avif"];

/** Opens .canvas files in the canvas webview. The file stays a text document, so save, undo on disk and dirty state come from VS Code. */
export class CanvasEditorProvider implements vscode.CustomTextEditorProvider {
  static readonly viewType = "canvas.editor";
  static activeUri: vscode.Uri | undefined;
  /** How to send a message to the webview of the canvas editor that was active last. Two editors on one file each have their own. */
  private static activePost: ((msg: HostMessage) => void) | undefined;

  /**
   * Asks for the export options, then the active canvas for its picture. The paper starts on `paper`,
   * the one the canvas shows; background and scale start on the ones picked last.
   */
  async exportActive(format: ExportFormat, paper: Paper = shownPaper()): Promise<void> {
    const post = CanvasEditorProvider.activePost;
    if (!post) {
      void vscode.window.showInformationMessage("Open a canvas first.");
      return;
    }
    const saved = this.context.globalState.get<Partial<ExportChoices>>(EXPORT_STATE) ?? {};
    const choices = await pickExportOptions(format, { background: saved.background ?? true, paper, scale: saved.scale ?? 2 });
    if (!choices) return;
    await this.context.globalState.update(EXPORT_STATE, { background: choices.background, scale: choices.scale });
    post({ type: "export", format, ...choices });
  }

  constructor(private readonly context: vscode.ExtensionContext) {}

  async resolveCustomTextEditor(document: vscode.TextDocument, panel: vscode.WebviewPanel): Promise<void> {
    const webview = panel.webview;
    // Images from outside the workspace are saved next to the canvas.
    const folder = vscode.Uri.joinPath(document.uri, "..");
    const root = vscode.workspace.getWorkspaceFolder(document.uri)?.uri ?? folder;
    webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.context.extensionUri, "dist"),
        vscode.Uri.joinPath(this.context.extensionUri, "webview"),
        root,
        ...(vscode.workspace.workspaceFolders ?? []).map((f) => f.uri),
      ],
    };
    webview.html = this.html(webview);

    // The text the webview shows. A document change to other text (undo, redo, an edit as text) is sent to it.
    let shown: string | undefined;
    const post = (msg: HostMessage) => void webview.postMessage(msg);

    const sendDocument = () => {
      const text = document.getText();
      if (text === shown) return;
      shown = text;
      post({ type: "load", text });
    };

    const sendSettings = () => {
      const config = vscode.workspace.getConfiguration("canvas");
      post({ type: "settings", drawingStyle: config.get("drawingStyle", "artist"), theme: config.get("theme", "auto") });
    };

    const track = () => {
      if (!panel.active) return;
      CanvasEditorProvider.activeUri = document.uri;
      CanvasEditorProvider.activePost = post;
    };
    track();

    const subs: vscode.Disposable[] = [
      panel.onDidChangeViewState(track),
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration("canvas.drawingStyle") || e.affectsConfiguration("canvas.theme")) sendSettings();
      }),
      vscode.workspace.onDidChangeTextDocument((e) => {
        if (e.document.uri.toString() === document.uri.toString() && e.contentChanges.length > 0) sendDocument();
      }),
      webview.onDidReceiveMessage(async (msg: WebviewMessage) => {
        switch (msg.type) {
          case "ready":
            shown = undefined;
            sendSettings();
            sendDocument();
            break;
          case "edit": {
            shown = msg.text;
            if (msg.text === document.getText()) break;
            const edit = new vscode.WorkspaceEdit();
            edit.replace(document.uri, new vscode.Range(0, 0, document.lineCount, 0), msg.text);
            await vscode.workspace.applyEdit(edit);
            break;
          }
          case "resolve": {
            const files: Record<string, FileInfo> = {};
            await Promise.all(msg.paths.map(async (p) => (files[p] = await this.resolveFile(root, p, webview))));
            post({ type: "files", files });
            break;
          }
          case "openFile":
            await this.openFile(root, msg.path, msg.subpath);
            break;
          case "openLink":
            await this.openLink(root, msg.href);
            break;
          case "pickFile": {
            const path = await this.pickFile(root);
            if (path) post({ type: "picked", paths: [path] });
            break;
          }
          case "pickImages": {
            const paths = await this.pickImages(root, folder);
            if (paths.length) post({ type: "picked", paths });
            break;
          }
          case "saveImages": {
            const items = await this.saveImages(root, folder, msg.images);
            if (items.length) post({ type: "dropped", items, x: msg.x, y: msg.y });
            break;
          }
          case "dropUris": {
            const items = await this.dropItems(root, folder, msg.uris);
            if (items.length) post({ type: "dropped", items, x: msg.x, y: msg.y });
            break;
          }
          case "notify":
            void vscode.window.showInformationMessage(msg.text);
            break;
          case "inline":
            post({ type: "inlined", data: await this.inline(root, msg.paths) });
            break;
          case "exportRequest":
            await vscode.commands.executeCommand(msg.format === "png" ? "canvas.exportPng" : "canvas.exportSvg", { paper: msg.paper });
            break;
          case "exported":
            await this.saveExport(document.uri, msg.format, msg.base64);
            break;
          case "undo":
          case "redo":
            await vscode.commands.executeCommand(msg.type);
            break;
          case "showSource":
            await vscode.commands.executeCommand("vscode.openWith", document.uri, "default");
            break;
        }
      }),
    ];

    panel.onDidDispose(() => {
      subs.forEach((s) => s.dispose());
      if (CanvasEditorProvider.activePost === post) CanvasEditorProvider.activePost = undefined;
      if (CanvasEditorProvider.activeUri?.toString() === document.uri.toString()) {
        CanvasEditorProvider.activeUri = undefined;
      }
    });
  }

  /** Files as data URIs: workspace files by their path, the extension's own by "extension:" and theirs. Unreadable ones are left out. */
  private async inline(root: vscode.Uri, paths: string[]): Promise<Record<string, string>> {
    const data: Record<string, string> = {};
    await Promise.all(
      paths.map(async (path) => {
        const own = path.startsWith("extension:");
        const uri = own ? vscode.Uri.joinPath(this.context.extensionUri, ...path.slice("extension:".length).split("/")) : this.fileUri(root, path);
        try {
          const bytes = await vscode.workspace.fs.readFile(uri);
          data[path] = `data:${mimeOf(path)};base64,${Buffer.from(bytes).toString("base64")}`;
        } catch {
          // The export shows it missing, as the canvas does.
        }
      }),
    );
    return data;
  }

  /** Saves an export through the save dialog, which starts next to the canvas with its name. */
  private async saveExport(canvas: vscode.Uri, format: ExportFormat, base64: string): Promise<void> {
    const name = canvas.path.split("/").pop()!.replace(/\.canvas$/i, "");
    const target = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.joinPath(canvas, "..", `${name}.${format}`),
      filters: format === "png" ? { "PNG image": ["png"] } : { "SVG image": ["svg"] },
    });
    if (!target) return;
    try {
      await vscode.workspace.fs.writeFile(target, Buffer.from(base64, "base64"));
    } catch (err) {
      void vscode.window.showErrorMessage(`Could not save ${target.path.split("/").pop()}: ${(err as Error).message}`);
    }
  }

  private fileUri(root: vscode.Uri, path: string): vscode.Uri {
    return vscode.Uri.joinPath(root, ...path.split("/"));
  }

  private async resolveFile(root: vscode.Uri, path: string, webview: vscode.Webview): Promise<FileInfo> {
    const uri = this.fileUri(root, path);
    let stat: vscode.FileStat;
    try {
      stat = await vscode.workspace.fs.stat(uri);
    } catch {
      return { kind: "missing" };
    }
    if (isImagePath(path)) return { kind: "image", src: webview.asWebviewUri(uri).toString() };
    if (!isTextPath(path) || stat.size > MAX_PREVIEW_BYTES) return { kind: "other" };
    const bytes = await vscode.workspace.fs.readFile(uri);
    // The whole text: a card with a subpath shows a section from anywhere in it.
    return { kind: "text", text: new TextDecoder().decode(bytes) };
  }

  /** What to put on the canvas for dropped files and folders. A folder brings the files in it. */
  private async dropItems(root: vscode.Uri, folder: vscode.Uri, uris: string[]): Promise<DroppedItem[]> {
    const items: DroppedItem[] = [];
    let skipped = 0;
    for (const raw of uris) {
      const uri = toUri(raw.trim());
      if (!uri) continue;
      let stat: vscode.FileStat;
      try {
        stat = await vscode.workspace.fs.stat(uri);
      } catch {
        skipped++;
        continue;
      }
      const found =
        stat.type & vscode.FileType.Directory
          ? (await vscode.workspace.findFiles(new vscode.RelativePattern(uri, "**/*"), EXCLUDED, MAX_DROPPED_FILES))
              .sort((a, b) => a.path.localeCompare(b.path))
          : [uri];
      for (const file of found) {
        if (items.length >= MAX_DROPPED_FILES) break;
        const path = relativeTo(root, file);
        if (path) {
          items.push({ kind: "file", path });
          continue;
        }
        // Outside the workspace a file card could not find it again: copy an image in, bring a note's text.
        const size = file === uri ? stat.size : (await vscode.workspace.fs.stat(file)).size;
        const copied = isImagePath(file.path) ? await this.copyImage(root, folder, file) : undefined;
        if (copied) {
          items.push({ kind: "file", path: copied });
        } else if (isTextPath(file.path) && size <= MAX_PREVIEW_BYTES) {
          items.push({ kind: "text", text: new TextDecoder().decode(await vscode.workspace.fs.readFile(file)) });
        } else {
          skipped++;
        }
      }
    }
    if (skipped) {
      void vscode.window.showInformationMessage(
        `${skipped} dropped ${skipped === 1 ? "file" : "files"} could not be added. From outside the workspace only images and text notes come in.`,
      );
    }
    return items;
  }

  /** Lets the user choose images anywhere. Ones outside the workspace are copied next to the canvas. */
  private async pickImages(root: vscode.Uri, folder: vscode.Uri): Promise<string[]> {
    const uris = await vscode.window.showOpenDialog({
      canSelectMany: true,
      defaultUri: folder,
      filters: { Images: IMAGE_EXTENSIONS },
      openLabel: "Add to canvas",
    });
    const paths: string[] = [];
    for (const uri of uris ?? []) {
      const path = relativeTo(root, uri) ?? (await this.copyImage(root, folder, uri));
      if (path) paths.push(path);
    }
    return paths;
  }

  /** Saves pasted or dropped image data next to the canvas, as file cards. */
  private async saveImages(root: vscode.Uri, folder: vscode.Uri, images: ImageData[]): Promise<DroppedItem[]> {
    const items: DroppedItem[] = [];
    for (const image of images) {
      const bytes = Buffer.from(image.base64, "base64");
      const path = await this.writeImage(root, folder, imageFileName(image.mime, image.name, new Date()), bytes);
      if (path) items.push({ kind: "file", path });
    }
    return items;
  }

  private async copyImage(root: vscode.Uri, folder: vscode.Uri, uri: vscode.Uri): Promise<string | undefined> {
    try {
      const bytes = await vscode.workspace.fs.readFile(uri);
      return await this.writeImage(root, folder, imageFileName("", uri.path, new Date()), bytes);
    } catch {
      return undefined;
    }
  }

  /** Writes an image into the canvas folder under a free name. Returns its path for a file card. */
  private async writeImage(root: vscode.Uri, folder: vscode.Uri, name: string, bytes: Uint8Array): Promise<string | undefined> {
    const existing = new Set((await vscode.workspace.fs.readDirectory(folder)).map(([n]) => n.toLowerCase()));
    const target = vscode.Uri.joinPath(folder, uniqueFileName(name, (n) => existing.has(n.toLowerCase())));
    try {
      await vscode.workspace.fs.writeFile(target, bytes);
    } catch (err) {
      void vscode.window.showErrorMessage(`Could not save ${name}: ${(err as Error).message}`);
      return undefined;
    }
    return relativeTo(root, target);
  }

  /** Opens a file beside the canvas, at the heading or block a subpath names. */
  private async openFile(root: vscode.Uri, path: string, subpath?: string): Promise<void> {
    const uri = this.fileUri(root, path);
    let selection: vscode.Range | undefined;
    if (subpath && isTextPath(path)) {
      try {
        const section = findSection(new TextDecoder().decode(await vscode.workspace.fs.readFile(uri)), subpath);
        if (section) selection = new vscode.Range(section.start, 0, section.start, 0);
      } catch {
        // Open it anyway; VS Code shows why it cannot.
      }
    }
    await vscode.commands.executeCommand("vscode.open", uri, { viewColumn: vscode.ViewColumn.Beside, selection });
  }

  private async openLink(root: vscode.Uri, href: string): Promise<void> {
    if (/^(https?:|mailto:)/i.test(href)) {
      await vscode.env.openExternal(vscode.Uri.parse(href));
      return;
    }
    // A [[wikilink]]: a path, or a note name found anywhere in the workspace.
    const target = href.replace(/#.*$/, "").trim();
    if (!target) return;
    const candidates = [target, `${target}.md`];
    for (const c of candidates) {
      const uri = this.fileUri(root, c);
      try {
        await vscode.workspace.fs.stat(uri);
        await vscode.commands.executeCommand("vscode.open", uri, { viewColumn: vscode.ViewColumn.Beside });
        return;
      } catch {
        // Try the next one.
      }
    }
    const name = target.split("/").pop()!;
    const found = await vscode.workspace.findFiles(
      new vscode.RelativePattern(root, `**/${name}{,.md}`),
      "**/node_modules/**",
      1,
    );
    if (found[0]) {
      await vscode.commands.executeCommand("vscode.open", found[0], { viewColumn: vscode.ViewColumn.Beside });
    } else {
      void vscode.window.showInformationMessage(`No file named "${target}" in the workspace.`);
    }
  }

  private async pickFile(root: vscode.Uri): Promise<string | undefined> {
    const files = await vscode.workspace.findFiles(
      new vscode.RelativePattern(root, "**/*"),
      EXCLUDED,
      5000,
    );
    const items = files
      .map((f) => relativeTo(root, f))
      .filter((p): p is string => !!p)
      .sort()
      .map((p) => ({ label: p.split("/").pop()!, description: p, path: p }));
    const pick = await vscode.window.showQuickPick(items, {
      placeHolder: "Add a file to the canvas",
      matchOnDescription: true,
    });
    return pick?.path;
  }

  private html(webview: vscode.Webview): string {
    const nonce = [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, "0")).join("");
    const script = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, "dist", "webview.js"));
    const style = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, "webview", "style.css"));
    const csp = [
      "default-src 'none'",
      `img-src ${webview.cspSource} https: data:`,
      `style-src ${webview.cspSource} 'unsafe-inline'`,
      `font-src ${webview.cspSource}`,
      `script-src 'nonce-${nonce}'`,
    ].join("; ");
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="stylesheet" href="${style}">
<title>Canvas</title>
</head>
<body>
<div id="app"></div>
<script nonce="${nonce}" src="${script}"></script>
</body>
</html>`;
  }
}

type Paper = "light" | "dark";
type ExportChoices = { background: boolean; paper: Paper; scale: 1 | 2 | 3 };
const EXPORT_STATE = "canvas.export";

/** The paper canvases show now, by the `canvas.theme` setting and the color theme. */
function shownPaper(): Paper {
  const setting = vscode.workspace.getConfiguration("canvas").get<string>("theme", "auto");
  if (setting === "light" || setting === "dark") return setting;
  const kind = vscode.window.activeColorTheme.kind;
  return kind === vscode.ColorThemeKind.Dark || kind === vscode.ColorThemeKind.HighContrast ? "dark" : "light";
}

/**
 * One quick pick for the export options: picking a line switches it, picking *Export* saves.
 * Scale is only for PNG.
 */
function pickExportOptions(format: ExportFormat, start: ExportChoices): Promise<ExportChoices | undefined> {
  const choices = { ...start };
  type Item = vscode.QuickPickItem & { key: "save" | "background" | "paper" | "scale" };
  const pick = vscode.window.createQuickPick<Item>();
  pick.title = `Export as ${format.toUpperCase()}`;
  pick.placeholder = "Pick a line to change it, then Export";
  const items = (): Item[] => [
    { key: "save", label: "$(save) Export…", description: "choose where to save it" },
    { key: "background", label: `Background: ${choices.background ? "on" : "off"}`, description: choices.background ? "the paper's color" : "transparent" },
    { key: "paper", label: `Paper: ${choices.paper}`, description: choices.paper === "light" ? "dark ink on white" : "light ink on dark" },
    ...(format === "png" ? [{ key: "scale" as const, label: `Scale: ${choices.scale}×`, description: "1×, 2× or 3× the size on the canvas" }] : []),
  ];
  pick.items = items();
  return new Promise((resolve) => {
    pick.onDidAccept(() => {
      const key = pick.selectedItems[0]?.key ?? "save";
      if (key === "save") {
        resolve(choices);
        pick.hide();
        return;
      }
      if (key === "background") choices.background = !choices.background;
      if (key === "paper") choices.paper = choices.paper === "light" ? "dark" : "light";
      if (key === "scale") choices.scale = choices.scale === 3 ? 1 : ((choices.scale + 1) as 2 | 3);
      pick.items = items();
      pick.activeItems = pick.items.filter((i) => i.key === key);
    });
    pick.onDidHide(() => {
      resolve(undefined);
      pick.dispose();
    });
    pick.show();
  });
}

/** The path of a file relative to the canvas root, with forward slashes, or undefined when it lies outside. */
function relativeTo(root: vscode.Uri, uri: vscode.Uri): string | undefined {
  const base = root.path.endsWith("/") ? root.path : `${root.path}/`;
  if (uri.scheme !== root.scheme || !uri.path.startsWith(base)) return undefined;
  return uri.path.slice(base.length);
}

/** A dropped entry: a URI, or a plain file system path as some drag sources give. */
function toUri(raw: string): vscode.Uri | undefined {
  if (!raw) return undefined;
  if (raw.startsWith("/") || /^[a-zA-Z]:[\\/]/.test(raw)) return vscode.Uri.file(raw);
  try {
    return vscode.Uri.parse(raw, true);
  } catch {
    return undefined;
  }
}
