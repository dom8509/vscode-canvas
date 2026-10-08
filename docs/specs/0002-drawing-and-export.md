---
title: Drawing, free arrows and export
intent: docs/intents/0002-drawing-and-export.md
intent_commit: 19bf2a2
status: draft
created: 2026-10-08
policies:
  - CONTEXT.md@9e2ec77
  - AGENTS.md@2084ef7
  - README.md@9e2ec77
  - package.json@1f4453d
  - src/jsonCanvas.ts@9ca5a0d
  - src/protocol.ts@1f4453d
  - src/canvasEditor.ts@1f4453d
  - src/extension.ts@008f101
  - webview/main.ts@9e2ec77
  - webview/geometry.ts@70c5965
  - webview/sketch.ts@89623d9
  - webview/drawingStyles.ts@89623d9
  - webview/style.css@1f4453d
  - webview/shortcuts.ts@9e2ec77
  - webview/toolbar.ts@bcaa009
  - webview/contextMenuItems.ts@bbcdde6
  - webview/nodeDefaults.ts@c381925
  - webview/arrange.ts@9615d47
  - webview/theme.ts@1f4453d
  - docs/adr/0001-lock-and-groups.md@9ca5a0d
  - docs/specs/0001-usability-polish.md@dec8cac
  - docs/plans/0001-usability-polish.md@dec8cac
---

# Spec: Drawing, free arrows and export

## Problem

A connection needs two cards, there is no pen or eraser, and a board cannot
leave VS Code as a picture. These are the biggest gaps to Excalidraw and
tldraw. See [Intent 0002, _Problem_](../intents/0002-drawing-and-export.md#problem).

## Requirements

Each requirement is observable in the Extension Development Host. "Card",
"connection", "end" and "head" are used as in `CONTEXT.md`.

**Arrow and line tool**

R1. The bottom toolbar gains an arrow tool (**A**) and a line tool (**L**). With
either, a drag on the canvas draws a new connection from the pointer-down
point to the pointer-up point. The arrow tool makes a connection with an arrow
head at its end; the line tool one with no heads. (intent: R1)

R2. An end dropped on a card binds to that card, on the side under the pointer
(the side facing the other end when dropped near the card's center, as today).
An end on empty space is a **free end** at that point. (intent: R1)

R3. Holding Shift while drawing snaps the angle between the two ends to 15°
steps. Alt turns off the grid, as for cards. (intent: R1)

R4. The new connection takes the edge style picked last (line style, line
width, path style), as a connection drawn from a card's dot does today. The
arrow tool keeps the arrow head at the end; the line tool sets both heads to
none. (intent: R1)

R5. A drag shorter than 10 screen pixels makes nothing. After drawing, the
select tool comes back and the new connection is selected. One undo step.
(intent: R1)

**Edit connection ends**

R6. A selected connection shows a round handle at each end. (intent: R2)

R7. Dragging a handle onto a card binds that end to the card (side as in R2);
dropping it on empty space makes the end free at that point. One undo step.
Dropping it on the card at its other end does nothing. A locked connection
shows no handles. (intent: R2)

R8. Moving a bound card moves the end, as today. A free end moves when its
connection is in the selection and the selection is moved, unless the
connection is locked. Dragging a selected connection by its line moves the
whole selection. (intent: R2)

**Storage of free ends**

R9. A free end is stored as a **point**: a text node with `"shape": "point"`,
`"text": ""`, `"width": 1`, `"height": 1`, centered on the end. The edge's
`fromNode` or `toNode` names it, with no `fromSide` or `toSide`. (intent: R3)

R10. The canvas never draws, selects, connects to, edits or exports a point on
its own. A marquee, select all, snap guides, align, distribute and layer order
all pass it by. (intent: R3)

R11. When the last connection on a point is deleted, the point is deleted in the
same commit. A locked connection is not deleted (as today), so its points
stay. A point already without a connection when a canvas is opened is
left in the file until the next commit removes it. (intent: R3)

R12. Copy, cut, duplicate and paste of a selected connection bring its points.
Copying a card brings a connection from it whose other end is a point, with the
point. As for every copy, a copy of a locked connection is not locked.
(intent: R3, acceptance criteria)

**Pen**

R13. The bottom toolbar gains a pen tool (**P**). A drag draws a **stroke**,
smoothed while drawing and after release. The pen stays active after a stroke;
Escape brings back the select tool, as for every tool. Each stroke is its own
node and its own undo step. (intent: R4)

R14. With strokes selected, the properties panel shows color, stroke width
(thin, normal, bold, extra) and drawing style, and nothing that does not apply
(fill, font, text size, shape). A new stroke takes the color and width picked
last, as a new card takes its sticky style. (intent: R4)

R15. A stroke is stored as a text node with `"shape": "draw"`, `"text": ""`, its
bounding box as `x`, `y`, `width`, `height`, and `"points"`: a flat list `[x1,
y1, x2, y2, …]` relative to the box's top left, rounded to one decimal, after
simplification. Color, width and drawing style use the existing `color`,
`strokeWidth` and `style` properties. (intent: R4, _Risks_)

R16. A stroke is selected by a click on its line (within 6 screen pixels) or by
a marquee touching its box. Like any card it can be moved, resized alone or in
a multi-selection (its points scale with the box), turned, grouped, reordered,
aligned, snapped to guides, locked, copied and deleted. Double-click does
nothing; a stroke has no text and no connection dots. (intent: R4)

**Eraser**

R17. The bottom toolbar gains an eraser tool (**E**). While dragging, every
stroke the pointer passes within 8 screen pixels of fades; on release those
strokes are deleted in one undo step. Escape during the drag cancels it.
(intent: R5)

R18. The eraser touches only strokes: never cards, shapes, free text, groups or
connections, and never a locked stroke. (intent: R5)

**Export**

R19. The commands *Canvas: Export as PNG*, *Canvas: Export as SVG* and *Canvas:
Copy as PNG* act on the active canvas. Export as PNG and SVG are also buttons
in the zoom bar. The context menu offers all three, for the selection and for
the empty canvas. (intent: R6)

R20. An export holds the selection if there is one, else every card,
connection and stroke, inside a margin of 32 pixels. Selection outlines,
handles, the grid and the empty-canvas hint are left out. (intent: R6)

R21. Before saving, a quick pick offers: background on or off, light or dark
paper, and for PNG a scale of 1×, 2× or 3×. The paper starts on the one the
canvas shows now; the other choices are remembered. (intent: R6)

R22. *Copy as PNG* (**Ctrl/Cmd+Shift+C** on the canvas) puts a PNG at 2× on the
clipboard, with the last background, on the paper the canvas shows, with no
dialog. (intent: R6)

R23. An export looks like the canvas: the same fonts (the handwriting font
embedded in an SVG), the same Rough.js lines from the same seeds, images, note
previews, shapes, free text, strokes and heads. The SVG file and the PNG need
nothing outside themselves. (intent: R6, _Risks_)

R24. The file is saved through VS Code's save dialog, which starts in the
folder of the canvas with the canvas's name and `.png` or `.svg`. (intent: R6)

**Done**

R25. Free ends, rebound ends, strokes and erased strokes survive a save, a
reload and Undo/Redo through VS Code. A canvas with points and strokes opens in
Obsidian without errors, and its other cards and connections look as before.
(intent: acceptance criteria)

R26. The new keys (**A**, **L**, **P**, **E**, **Ctrl/Cmd+Shift+C**) show in the
toolbar tooltips and hints, the context menu and the `?` overview.
(intent: R1, R4, R5, R6)

R27. `README.md`, section _Using it_, describes the arrow and line tools, end
handles, free ends, the pen, the eraser, export and copy, and how points and
strokes look in Obsidian. `package.json` `contributes.commands` lists the three
commands. `npm run check` passes. (intent: acceptance criteria)

## Design

### Where the code goes

`webview/main.ts` stays the DOM glue. Pure logic goes into modules with a test
in `test/`, written first (`AGENTS.md`, _Code_):

| Module | New? | Holds | Test |
| --- | --- | --- | --- |
| `src/jsonCanvas.ts` | existing | `isPoint(node)`, `pointNodeAt(p)` (R9), `prunePoints(data)` (R11), `pointsOfEdges(data, edgeIds)` for copy and move (R8, R12), `isStroke(node)`, `strokePoints(node)` and `setStrokePoints(node, points)` (R15) | `test/jsonCanvas.test.ts` |
| `webview/strokes.ts` | new | `simplify(points, tolerance)` (Ramer–Douglas–Peucker), `smoothPath(points)` (Catmull-Rom to cubic Bézier, SVG path data), `strokeBox(points)` → box and relative points, `scalePoints(points, from, to)` (R16), `hitStroke(node, p, tolerance)` with turn (R16, R17), `strokesTouched(nodes, path, tolerance)` (R17) | `test/strokes.test.ts` |
| `webview/geometry.ts` | existing | `snapAngle(from, to, step)` (R3); `edgePath` and `edgeCurve` accept a null start side, as they already do for the end side; `exportBounds(rects, margin)` (R20) | `test/geometry.test.ts` |
| `webview/shortcuts.ts` | existing | `arrow` (A), `line` (L), `pen` (P), `eraser` (E) in _Tools_; `copyPng` (Mod+Shift+C) in _Editing_ (R26) | `test/shortcuts.test.ts` already checks no key is used twice |
| `webview/toolbar.ts` | existing | `Tool` gains `connection`, `pen` and `eraser`; `TOOLBAR_BUTTONS` gains four buttons; `showTool` marks them | none (DOM) |
| `webview/contextMenuItems.ts` | existing | `exportPng`, `exportSvg`, `copyPng` items in both menus (R19) | `test/contextMenuItems.test.ts` |
| `webview/nodeDefaults.ts` | existing | `pickNodeDefaults` for a stroke: color and stroke width (R14) | `test/nodeDefaults.test.ts` |
| `webview/arrange.ts` | existing | no change: `main.ts` leaves points out of what it hands to `reorder`, `align`, `distribute`, `snapGuides` and `scaleRects` (R10) | `test/arrange.test.ts` unchanged |
| `webview/export.ts` | new | `buildSvg(...)`: an SVG document of the chosen elements, from the same render code as the board; fonts and images inlined | `test/export.test.ts` for the parts without a DOM: bounds, font and image inlining as strings |
| `src/canvasEditor.ts` | existing | export and copy messages, image inlining, save dialog (below) | none (`vscode`) |
| `src/extension.ts` | existing | the three commands | none (`vscode`) |

### Free ends (R1–R12)

**Drawing a connection.** `Tool` in `webview/toolbar.ts` gains `{ kind:
"connection"; heads: "arrow" | "line" }`, set by **A**, **L** and two toolbar
buttons. A new
drag kind `"edge"` keeps the start point and the card under it. While dragging
it draws the preview with `edgePath`, as the `"connect"` drag does, and marks
a target card with the existing `drop-target` class. On release it binds each
end (card and side by `nodeUnder`, `facingSide` and `nearCenter`, as today) or
makes a point with `pointNodeAt`, pushes the point nodes and the edge, applies
`setEdgeStyle(edge, edgeDefaults)` and then the heads of the tool, and commits
once.

**Geometry.** `edgeGeometry` in `main.ts` reads a point as a point: its anchor
is its center and its side is null, so the curve leaves it straight towards the
other end. `edgePath` and `edgeCurve` in `webview/geometry.ts` already take a
null side for the end; the start side becomes nullable too.

**Not drawn.** `renderNodes` skips points. Every place that walks
`data.nodes` for the user skips them: the marquee in `pointermove`, select all,
the `others` rects for snap guides, `reorder`, `align`, `distribute`,
`resize-many` and `nodeUnder`. `fitToContent` counts them, so an arrow's end
is in view. `childrenOf` counts them too: a point inside a group moves with it,
as a card does (ADR 0001).

**End handles (R6–R7).** `renderEdges` draws two `.end-handle` circles on a
selected connection, at `geo.start` and `geo.end`. A new drag kind
`"rebind"` keeps the edge, which end, and its old node and side. No handles
for a locked connection (`isLocked`). On release it
writes the new `fromNode`/`toNode` and side, or a new point; an old point left
without a connection goes in `prunePoints`.

**Moving (R8).** The `"move"` drag adds the points of selected, unlocked
connections (`pointsOfEdges`) to the nodes it moves. A pointer down on a
selected connection's line starts the same drag.

**Clean up (R11).** `commit()` and the nudge coalescer call `prunePoints(data)`
before serializing, so every path that deletes a connection or a card
(`deleteSelection`, the eraser, a rebind) leaves no orphan. `deleteSelection`
already keeps locked connections and their cards; a point held by a locked
connection stays with it. `parseCanvas` does not prune: opening a file never
changes it (`AGENTS.md`, _Obsidian round-trip_).

**Copy (R12).** `copySelection` adds the points of the copied connections and
of connections from a copied card to a point; `paste` already maps every node
id, so the points get new ids with the rest.

### Strokes (R13–R16)

A drag kind `"pen"` collects pointer points in world coordinates (coalesced
events, `getCoalescedEvents`), draws the live path in a preview `<svg>` with
`smoothPath`, and on release runs `simplify` (tolerance 0.5 screen pixels in
world units), `strokeBox`, and `setStrokePoints`. A stroke shorter than 2
points becomes a dot of its width.

`renderNodes` draws a stroke as a `.node.stroke` element at its box, holding an
`<svg>` with a wide transparent hit path and the visible path:
`sketchPath(smoothPath(points), seedOf(node.id), styleOf(node))`, stroke
`currentColor`, width from `WIDTHS` by `strokeWidth`. Turn uses the existing
`rotation`. Pointer events go to the hit path only, so a click inside the box
but off the line falls through to what lies under it.

Resize of a stroke: the `"resize"` and `"resize-many"` drags scale the box as
for any card; on release `scalePoints` rewrites `points` to the new box. Layer
order, align, distribute, snap guides and lock need nothing new: a stroke is a
text node like a shape. Strokes keep the
resize handles and turn handle, and get no connection dots.

The properties panel hides `.shape-tools` and `.text-tools` for a selection of
strokes and shows the color swatches, `.border-tools` (as "Width") and the
style row. `setSelectedNodeLook` already writes `strokeWidth` through
`setNodeLook`, and records it in `nodeDefaults`; `setNodeLook` keeps working
on a stroke because it is a text node. A new stroke applies
`pickNodeDefaults(nodeDefaults, "draw")`.

### Eraser (R17–R18)

A drag kind `"erase"` keeps a set of stroke ids. On each move it tests the
segment from the last pointer point with `strokesTouched` (unlocked strokes
only) and adds a `.fading` class to those elements. On release it deletes them and commits
once; Escape clears the set and the classes.

### Export (R19–R24)

**Commands.** `src/extension.ts` registers `canvas.exportPng`,
`canvas.exportSvg` and `canvas.copyPng`. Each finds the panel of
`CanvasEditorProvider.activeUri` and posts `{ type: "export"; format: "png" |
"svg" | "clipboard"; options }` after the quick pick (R21). The zoom bar
buttons, the context menu items and **Ctrl/Cmd+Shift+C** send `{ type:
"exportRequest"; format }` to the host, which runs the same command, so there
is one path. The webview tells the host the paper it shows in that message, so
the quick pick starts on it.

**Drawing.** `buildSvg` in `webview/export.ts` makes an SVG of the export
bounds:

- strokes, shapes, outlines, connections and heads: the same path data as on
  the board, with the same seeds;
- text cards, note previews, link cards and free text: `foreignObject` holding
  a clone of the card's DOM;
- the CSS the board uses: the rules of `webview/style.css` that apply to cards,
  with the variables of `#viewport[data-paper="light"]` or `"dark"` resolved
  for the chosen paper, whatever the canvas shows;
- the Caveat font from `webview/fonts/caveat-*.woff2` as a base64 `@font-face`;
- images as data URIs.

**Inlining.** The webview may not fetch: the CSP is `default-src 'none'`. The
webview sends `{ type: "inline"; paths: string[] }` and the host answers with
`{ type: "inlined"; data: Record<string, string> }`: data URIs of the image
files and the two font files, read with `vscode.workspace.fs`.

**PNG.** The webview draws the SVG on an `OffscreenCanvas` at the chosen scale
and sends `{ type: "exported"; format; base64 }`. Because every resource is a
data URI, the canvas is not tainted. **Copy as PNG** writes the blob with
`navigator.clipboard.write` in the webview; see C5.

**Saving.** The host shows `vscode.window.showSaveDialog` with `defaultUri` the
canvas path with the new extension and writes the bytes with
`vscode.workspace.fs.writeFile`.

**Protocol.** `src/protocol.ts`:

- `HostMessage` gains `{ type: "export"; format: "png" | "svg" | "clipboard";
  background: boolean; paper: "light" | "dark"; scale: 1 | 2 | 3 }` and
  `{ type: "inlined"; data: Record<string, string> }`.
- `WebviewMessage` gains `{ type: "exportRequest"; format: "png" | "svg" |
  "clipboard"; paper: Paper }`,
  `{ type: "inline"; paths: string[] }` and `{ type: "exported"; format: "png" |
  "svg"; base64: string }`.

### Keys

The new keys go into `SHORTCUTS` in `webview/shortcuts.ts`, and the keydown
handler in `main.ts` checks them with `matchesShortcut`, as it does for every
key now. The tooltips, toolbar hints, context menu and `?` overview read them
from there. **Ctrl/Cmd+Shift+C** follows the rule of Plan 0001, C2: check for a
clash with VS Code in Build; add `contributes.keybindings` scoped to
`activeCustomEditorId == 'canvas.editor'` only if it clashes.

### Docs

`README.md` _Using it_: the arrow and line tools, end handles, free ends and how
they look in Obsidian (a tiny empty card), the pen, the eraser, strokes in
Obsidian (an empty card the size of the stroke), export and copy. The
_Drawing styles_ item says strokes follow the drawing style too.
`package.json` `contributes.commands` gets the three commands and
`contributes.menus.commandPalette` shows them only when
`activeCustomEditorId == canvas.editor`. `CONTEXT.md` gets: **Free end**,
**Point** (the node that holds a free end), **Stroke**, **Pen**, **Eraser**,
**Arrow tool** and **Line tool**, **Export**.

## Decisions

- **Free ends as points, not an edge property** (intent, open question 1).
  Every edge stays valid for any JSON Canvas reader; `parseCanvas` would drop
  an edge with an unknown `fromNode`. Rejected: `"fromPoint": {x, y}` with a
  hidden dummy node, which needs the dummy anyway.
- **One point per free end, never shared.** Two connections never share a
  point, so moving or deleting one leaves the other alone. Rejected: reusing a
  point at the same spot, which the intent's "reuse" in the tests could mean;
  the test checks that copy and paste reuse the copied point instead.
- **Prune points in `commit()`, not on load.** Opening a canvas never changes the
  file.
- **"Arrow tool" and "line tool" as UI names.** `CONTEXT.md` lists "arrow" under
  _Avoid_ for a connection. The tools make connections; their names say which
  heads they start with, as the intent and Excalidraw call them. In code:
  `{ kind: "connection" }`.
- **The zoom bar is the "top bar"** of the intent. It is the only bar at the
  top (top right). Rejected: a new top bar for two buttons.
- **Strokes share the sticky style of cards** (`nodeDefaults`), color and width
  only. Rejected: a separate `strokeDefaults`; a width picked for a shape's
  border then also fits a stroke, as in Excalidraw.
- **Locked strokes are not erased.** A lock means "cannot be deleted" (Plan
  0001, C5); the eraser deletes.
- **Export paper is a choice, not the screen.** The quick pick starts on the
  paper shown, so a dark-theme user can still export light for a document.
- **Strokes follow the drawing style through Rough.js**, like every other line
  (`AGENTS.md`, _Deterministic drawing_). Rejected: perfect-freehand, which
  `webview/sketch.ts` names as a later option: it adds a dependency, draws
  filled outlines that ignore the drawing style, and its width varies with
  speed, which the intent's non-goals rule out.
- **Points stored in box units, rewritten on resize.** The file reads as plain
  pixels; a stroke that is only moved keeps its `points`. Rejected: points
  normalised to 0–1, which lose precision at one decimal on large strokes.
- **Strokes stay separate nodes** (intent, open question 2), the intent's
  proposal.
- **A stroke is selected by its line, not its box.** A box selection would catch
  clicks on cards under a large loop. Marquee still uses the box.
- **Export through the host, drawing in the webview.** Only the webview can lay
  out cards; only the host can read files and save. Rejected: rendering in
  the host with a headless browser.
- **Export options in a quick pick, remembered in `globalState`.** Rejected: a
  settings entry per option; nobody changes these for every canvas.
- **One "export" path for the commands and the zoom bar buttons**, so they
  cannot drift.

## Open questions from the intent

1. _Free ends as point nodes or a non-standard edge property?_ Answered: point
   nodes (R9, _Decisions_).
2. _Should pen strokes in one session merge into one node?_ Answered: no (R13,
   _Decisions_).
3. _Performance with many strokes_ (intent, _Risks_). Carried to Build: Build
   measures 500 strokes; if a redraw on drag lags, it redraws only the moved
   elements during a drag, the same fix Spec 0001 carries for 300 cards.
4. _Export in the context menu "with Intent 0001"_ (intent, R6). Answered:
   Intent 0001 is built, so both menus get the three items (R19).

## Concerns

C1. A stroke is a large empty card in Obsidian -- policy: AGENTS.md _Obsidian
round-trip_ ("a plain fallback Obsidian understands") -- owner: dom8509
    The intent accepts empty cards for points (1×1). A stroke's box can be
    hundreds of pixels wide, so Obsidian shows a big empty card over whatever
    lies under it, and a user may delete it there.
    Options: accept, as the intent's _Risks_ does, and say so in the README; or
    put a short text in the stroke (e.g. "✏️ drawing") so the card explains
    itself, at the cost of the `"text": ""` the intent names.

C2. Dragging a card's dot to empty space makes a card today -- policy: README
_Connect_ ("Drop on empty space to make a new card there"), intent R1 ("an end
on empty space stays a free point") -- owner: dom8509
    The intent speaks of the arrow tool, so the spec keeps today's dot
    behaviour. Users may expect the dot to make a free end too.
    Options: keep both (the spec); or make the dot leave a free end and Alt+drop
    make a card; or the other way round.

C3. Free ends and Obsidian edits -- policy: intent R3 -- owner: dom8509
    In Obsidian a point is a normal card. Someone may write in it, resize it or
    connect a third card to it. On return it is still `"shape": "point"`, so the
    canvas hides it, text and all.
    Options: hide it only while its text is empty and it has the 1×1 size, else
    show it as a plain card (and stop treating it as a point); or always hide it.

C4. Clipboard access from a webview -- policy: none covers it -- owner: dom8509
    `navigator.clipboard.write` with an image needs focus and permission; it
    is not certain in a VS Code webview on every platform, and the host API
    `vscode.env.clipboard` takes text only.
    Options: try it in Build on Windows, macOS and Linux; if it fails, fall
    back to saving a file and say so, or drop *Copy as PNG* from this spec.

C5. Export looks like the canvas "exactly" -- policy: intent acceptance
criteria -- owner: dom8509
    `foreignObject` layout can differ from the board by a pixel or two (font
    hinting, line breaks), and there is no screenshot test in `npm run check`.
    Options: accept a manual side-by-side check of `sample/Welcome.canvas`
    (light and dark, 1× and 2×) in Build; or add a Playwright screenshot test,
    which is new test tooling for this repository.

## Out of scope

- Shape recognition, pressure brushes, PDF export, embedding a live canvas in
  Markdown, collaboration (intent _Non-goals_).
- Bending a connection by dragging its middle; only its ends are edited.
- Labels on free connections beyond what connections have today (double-click
  still adds one).
- Partial erase that splits a stroke; the eraser deletes whole strokes.
- Export of a canvas that is not open in the editor (from the Explorer).
