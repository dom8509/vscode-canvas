# Canvas for VS Code

A VS Code extension that opens JSON Canvas (`.canvas`) files on an infinite board, as Obsidian Canvas does. Name every concept with its term from [`CONTEXT.md`](CONTEXT.md); read it before naming anything new, and add the term there when you coin one.

## Check

`npm run check` is the gate: typecheck, `vitest`, build. A change is done when it passes.

The SDLC skills in `.claude/skills` come from another repository and name its paths. Read them as:

- `./scripts/check.sh` (with or without `--integration`) → `npm run check`
- `tests/unit`, `tests/integration` → `test/`
- `docs/adr/`, `docs/architecture.md`, `docs/agents/domain.md` → not written yet; create one only when a change needs it.

## Code

- **Two runtimes.** `src/` runs in the extension host (Node, `vscode` API); `webview/` runs in the browser and talks to the host only through the messages in `src/protocol.ts`. `src/jsonCanvas.ts` is bundled into both, so it stays free of `vscode` and DOM imports.
- **The document is the state.** Every change in the webview ends in `commit()`, which sends the whole canvas as text to the host. Undo and redo are VS Code's own on that document; the webview keeps no history.
- **Obsidian round-trip.** A canvas must open in Obsidian and come back unchanged:
  - properties the extension does not know are kept;
  - looks JSON Canvas lacks go into extra properties, with a plain fallback Obsidian understands (an arrow where there is a head, a text card where there is a shape);
  - a value equal to its default is left out of the file; write through the `set*` helpers (`setEdgeStyle`, `setNodeLook`, `setRotation`, `setTextScale`, `setDrawingStyle`), which do this.
- **Deterministic drawing.** Rough.js takes its seed from the element id (`seedOf`), so a redraw looks the same. New sketchy marks use that seed too.
- **Testable logic lives outside `webview/main.ts`.** Geometry, parsing and styles sit in their own modules with a test in `test/`; `main.ts` is the DOM glue and has no tests. Write the test first, through the module's exports.

## Documentation

`README.md` is the user guide. A change people can see updates its _Using it_ section in the same commit, in the same voice: short plain sentences, keys in bold, commands in italics. A new setting or command also goes into `package.json` `contributes`.

## Commits

One change per commit. The subject says what a person can now do, in plain words, with no prefix: `Double-click on the empty canvas adds free text`, `Line and arrow styles for connections, as in Excalidraw`.
