import * as vscode from "vscode";
import { isImagePath } from "./jsonCanvas";
import type { FileInfo, HostMessage, WebviewMessage } from "./protocol";

const TEXT_EXTENSIONS = new Set([
  "md", "markdown", "txt", "json", "yaml", "yml", "toml", "csv", "js", "ts", "tsx", "jsx",
  "py", "rs", "go", "java", "c", "cpp", "h", "cs", "rb", "php", "sh", "css", "html", "xml", "sql",
]);
const MAX_PREVIEW_BYTES = 1_000_000;
const PREVIEW_CHARS = 4000;

/** Opens .canvas files in the canvas webview. The file stays a text document, so save, undo on disk and dirty state come from VS Code. */
export class CanvasEditorProvider implements vscode.CustomTextEditorProvider {
  static readonly viewType = "canvas.editor";
  static activeUri: vscode.Uri | undefined;

  constructor(private readonly context: vscode.ExtensionContext) {}

  async resolveCustomTextEditor(document: vscode.TextDocument, panel: vscode.WebviewPanel): Promise<void> {
    const webview = panel.webview;
    const root = vscode.workspace.getWorkspaceFolder(document.uri)?.uri ?? vscode.Uri.joinPath(document.uri, "..");
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

    const track = () => {
      if (panel.active) CanvasEditorProvider.activeUri = document.uri;
    };
    track();

    const subs: vscode.Disposable[] = [
      panel.onDidChangeViewState(track),
      vscode.workspace.onDidChangeTextDocument((e) => {
        if (e.document.uri.toString() === document.uri.toString() && e.contentChanges.length > 0) sendDocument();
      }),
      webview.onDidReceiveMessage(async (msg: WebviewMessage) => {
        switch (msg.type) {
          case "ready":
            shown = undefined;
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
            await vscode.commands.executeCommand("vscode.open", this.fileUri(root, msg.path), {
              viewColumn: vscode.ViewColumn.Beside,
            });
            break;
          case "openLink":
            await this.openLink(root, msg.href);
            break;
          case "pickFile": {
            const path = await this.pickFile(root);
            if (path) post({ type: "picked", path });
            break;
          }
          case "dropUris": {
            const paths = msg.uris
              .map((u) => {
                try {
                  return relativeTo(root, vscode.Uri.parse(u.trim()));
                } catch {
                  return undefined;
                }
              })
              .filter((p): p is string => !!p);
            if (paths.length) post({ type: "dropped", paths, x: msg.x, y: msg.y });
            break;
          }
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
      if (CanvasEditorProvider.activeUri?.toString() === document.uri.toString()) {
        CanvasEditorProvider.activeUri = undefined;
      }
    });
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
    const ext = path.split(".").pop()?.toLowerCase() ?? "";
    if (!TEXT_EXTENSIONS.has(ext) || stat.size > MAX_PREVIEW_BYTES) return { kind: "other" };
    const bytes = await vscode.workspace.fs.readFile(uri);
    return { kind: "text", text: new TextDecoder().decode(bytes).slice(0, PREVIEW_CHARS) };
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
      "{**/node_modules/**,**/.git/**,**/*.canvas}",
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

/** The path of a file relative to the canvas root, with forward slashes, or undefined when it lies outside. */
function relativeTo(root: vscode.Uri, uri: vscode.Uri): string | undefined {
  const base = root.path.endsWith("/") ? root.path : `${root.path}/`;
  if (uri.scheme !== root.scheme || !uri.path.startsWith(base)) return undefined;
  return uri.path.slice(base.length);
}
