import * as vscode from "vscode";
import { CanvasEditorProvider } from "./canvasEditor";

const EMPTY_CANVAS = '{\n\t"nodes":[],\n\t"edges":[]\n}';

export function activate(context: vscode.ExtensionContext): void {
  const provider = new CanvasEditorProvider(context);
  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(
      CanvasEditorProvider.viewType,
      provider,
      { webviewOptions: { retainContextWhenHidden: true } },
    ),

    vscode.commands.registerCommand("canvas.newCanvas", async (folder?: vscode.Uri) => {
      const base = folder ?? vscode.workspace.workspaceFolders?.[0]?.uri;
      if (!base) {
        void vscode.window.showErrorMessage("Open a folder first: a canvas is saved as a file in it.");
        return;
      }
      const name = await vscode.window.showInputBox({
        prompt: "Name of the new canvas",
        value: "Untitled",
        validateInput: (v) => (/[\\/:*?"<>|]/.test(v) ? "A name cannot hold \\ / : * ? \" < > |" : undefined),
      });
      if (!name) return;
      const uri = vscode.Uri.joinPath(base, name.endsWith(".canvas") ? name : `${name}.canvas`);
      try {
        await vscode.workspace.fs.stat(uri);
        void vscode.window.showErrorMessage(`${vscode.workspace.asRelativePath(uri)} exists already.`);
        return;
      } catch {
        // Does not exist yet: good.
      }
      await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(EMPTY_CANVAS));
      await vscode.commands.executeCommand("vscode.openWith", uri, CanvasEditorProvider.viewType);
    }),

    vscode.commands.registerCommand("canvas.showSource", (uri?: vscode.Uri) => {
      const target = uri ?? CanvasEditorProvider.activeUri;
      if (target) void vscode.commands.executeCommand("vscode.openWith", target, "default");
    }),

    // The zoom bar buttons and the context menu run these too, with the paper the canvas shows.
    vscode.commands.registerCommand("canvas.exportPng", (args?: { paper?: "light" | "dark" }) => provider.exportActive("png", args?.paper)),
    vscode.commands.registerCommand("canvas.exportSvg", (args?: { paper?: "light" | "dark" }) => provider.exportActive("svg", args?.paper)),

    vscode.commands.registerCommand("canvas.showCanvas", (uri?: vscode.Uri) => {
      const target = uri ?? vscode.window.activeTextEditor?.document.uri;
      if (target) void vscode.commands.executeCommand("vscode.openWith", target, CanvasEditorProvider.viewType);
    }),
  );
}

export function deactivate(): void {}
