---
title: Drawing, free arrows and export
spec: docs/specs/0002-drawing-and-export.md
intent: docs/intents/0002-drawing-and-export.md
spec_commit: 85a7b39
status: draft
created: 2026-10-08
---

# Plan: Drawing, free arrows and export

How Build turns [Spec 0002](../specs/0002-drawing-and-export.md) into code: ten
**slices**, each a thin path from a key or click to what a person sees, each
test first. The order follows the spec's three parts: free ends first (the
storage every later connection slice needs), then the pen and what grows out of
it, then export, which draws everything the earlier slices made.

## Rules for every slice

- **Red first.** The test goes in `test/` through the module's exports, and
  fails for the reason the slice names before any code is written. DOM-only
  code (`main.ts`, `toolbar.ts`, `contextMenu.ts`, `canvasEditor.ts`,
  `extension.ts`) has no test; its logic sits in a tested module next to it.
- **Words from `CONTEXT.md`.** A slice that coins a term adds it there in the
  same commit.
- **Docs in the same commit.** `README.md` _Using it_ gets the feature and its
  keys; a new command goes into `package.json` `contributes`.
- **Round trip.** A slice that writes to the file writes through a `set*`
  helper, so a default value stays out of the file. `parseCanvas` then
  `serializeCanvas` keeps every new property (`bends`, `points`, `closed`,
  `sharp`, `"shape": "point"`, `"shape": "draw"`).
- **Seeds.** Every new sketchy mark (strokes, custom shapes, bent connections)
  takes its seed from `seedOf(id)`.
- **Points stay hidden.** A slice that adds a new way to walk `data.nodes` for
  the user skips points (`isPoint`), as R14 asks.
- **Gate.** `npm run check` passes, then one commit, named for what a person can
  now do.

## Slices

| # | Slice | Requirements | Test |
| - | ----- | ------------ | ---- |
| 1 | Arrow and line tools with free ends | R1, R2, R3, R4, R5, R13, R14, R15 | `test/jsonCanvas.test.ts`, `test/geometry.test.ts`, `test/shortcuts.test.ts` |
| 2 | End handles | R9, R10 | `test/jsonCanvas.test.ts` |
| 3 | Pinned lines with bends | R6, R7, R11 | `test/jsonCanvas.test.ts`, `test/geometry.test.ts` |
| 4 | Move and copy free connections | R12, R16 | `test/jsonCanvas.test.ts` |
| 5 | Pen | R17, R19, R20 | `test/strokes.test.ts`, `test/jsonCanvas.test.ts` |
| 6 | Stroke color and width | R18 | `test/nodeDefaults.test.ts` |
| 7 | Eraser | R23, R24 | `test/strokes.test.ts` |
| 8 | Custom shapes | R8, R21, R22 | `test/strokes.test.ts`, `test/jsonCanvas.test.ts`, `test/nodeDefaults.test.ts` |
| 9 | Export as SVG | R26, R28, R29 | `test/export.test.ts`, `test/geometry.test.ts` |
| 10 | Export as PNG, options, buttons and menu items; final check | R25, R27, R30, R31, R32 | `test/contextMenuItems.test.ts` |

### 1. Arrow and line tools with free ends

_Commit: "Draw an arrow or a line anywhere with A and L; an end on empty space stays free"_

- **Red:** `jsonCanvas.ts` `isPoint`, `pointNodeAt(p)`, `prunePoints(data)`.
  Tests: `pointNodeAt` makes a 1×1 text node with `"shape": "point"` and
  `"text": ""` centered on `p`; `prunePoints` removes a point no edge names and
  keeps one a locked edge names; a canvas with a point survives `parseCanvas`
  then `serializeCanvas` unchanged, orphan included (R15: opening never
  prunes); `nodeLook` of a point does not read it as a card that
  `setNodeLook` could rewrite. `geometry.ts` `snapAngle(from, to, 15)`: snaps
  to 0°, 15°, 90°; keeps the length. `edgePath` and `edgeCurve` take a null
  start side. `shortcuts.test.ts` picks up **A** and **L** through its
  existing "no key twice" test.
- **Green:** `Tool` gains `{ kind: "connection"; heads: "arrow" | "line" }`,
  two toolbar buttons, **A** and **L** in `SHORTCUTS`. New drag kind `"edge"`:
  under 10 screen pixels makes nothing (R5); a drag binds each end by
  `nodeUnder`, `facingSide` and `nearCenter`, or makes a point; Shift snaps,
  Alt turns off the grid; `setEdgeStyle(edge, edgeDefaults)`, then the tool's
  heads; one `commit()`; the select tool comes back with the new connection
  selected.
- The `"connect"` drag's release on empty space makes a point; with Alt it
  keeps today's `textNodeAt` (R2).
- `edgeGeometry` reads a point as its center with a null side.
- Points are skipped in `renderNodes`, the marquee, select all, snap guide
  `others`, `reorder`, `align`, `distribute`, `resize-many` and `nodeUnder`.
  `fitToContent` and `childrenOf` count them (R14).
- `commit()` and the nudge coalescer run `prunePoints` before serializing.
- `README.md`: the arrow and line tools, free ends, the _Connect_ item's new
  drop and **Alt**, how a free end looks in Obsidian.
- `CONTEXT.md`: **Free end**, **Point**, **Arrow tool**, **Line tool**.

### 2. End handles

_Commit: "Drag the end of a selected connection to another card or to empty space"_

- **Red:** a pure `rebind(data, edgeId, end, target)` in `jsonCanvas.ts`, where
  `target` is a card and side or a point. Tests: binding to a card clears a
  free end and the old point is pruned on the next `prunePoints`; dropping on
  empty space makes a new point; dropping on the card at the other end changes
  nothing; a locked edge changes nothing.
- **Green:** `renderEdges` draws two `.end-handle` circles on a selected,
  unlocked connection. Drag kind `"rebind"` keeps the edge, the end and its old
  node and side; it marks a target card with `drop-target`; release calls
  `rebind` and commits once.
- `README.md`: end handles.

### 3. Pinned lines with bends

_Commit: "Click to pin a line with bends, and drag a bend to move it"_

- **Red:** `jsonCanvas.ts` `bendsOf` and `setBends`. Tests: rounds to one
  decimal; an empty list removes `"bends"`; an odd-length or non-number list
  reads as no bends. `geometry.ts` `bentPath(points, pathStyle)`. Tests:
  curved goes through every point; straight and elbow give a polyline; the
  start and end directions follow the first and last segment; the label sits
  at the middle of the path's length.
- **Green:** the `"edge"` drag from slice 1 turns into a pinned line when the
  pointer comes up before 10 pixels. Each click pins a bend; the preview
  follows the pointer from the last pin. Double-click, Enter, Escape or a click
  on the last pin ends it at the last pin; with only the start pinned it makes
  nothing. Shift snaps each segment. One commit.
- `edgeGeometry` uses `bentPath` when the edge has bends, and picks a bound
  end's side by `facingSide` towards the nearest bend.
- `renderEdges` draws `.bend-handle` squares on a selected connection; drag
  kind `"bend"` moves one, one commit.
- Check by hand in Obsidian: a bent connection shows as a plain one from end to
  end.
- Follows C1 (see below).
- `README.md`: pinned lines, bends, bend handles. `CONTEXT.md`: **Pin**,
  **Bend**.

### 4. Move and copy free connections

_Commit: "Move and copy connections with free ends along with the selection"_

- **Red:** `jsonCanvas.ts` `pointsOfEdges(data, edgeIds)`. Tests: returns the
  points of the given edges only; skips locked edges when asked to (move) and
  keeps them for copy; a card's connection to a point brings that point.
- **Green:** the `"move"` drag adds the points of selected, unlocked
  connections to the nodes it moves and shifts their bends. A pointer down on
  a selected connection's line starts the same drag. `copySelection` adds the
  points of copied connections and of connections from a copied card to a
  point; `paste` maps their ids as for every node. A pasted copy is not locked.
- Check by hand: copy, cut, duplicate and paste a free arrow; undo each.

### 5. Pen

_Commit: "Draw with the pen on P; each stroke can be moved, turned and resized like a card"_

- **Red:** `webview/strokes.ts` with `simplify`, `smoothPath`, `strokeBox`,
  `scalePoints`, `hitStroke`. Tests: `simplify` keeps the ends and drops
  points within tolerance; `strokeBox` returns the box and points relative to
  it; `scalePoints` maps a stroke from one box to another; `hitStroke` hits
  within the tolerance of the line, misses inside an open loop, and honours
  `rotation`. `jsonCanvas.ts` `isStroke`, `strokePoints`, `setStrokePoints`:
  rounds to one decimal; a stroke round-trips; `setNodeLook(stroke, {
  strokeWidth })` keeps `"shape": "draw"`.
- **Green:** `Tool` gains `{ kind: "pen" }`, **P**, a toolbar button. Drag kind
  `"pen"` collects coalesced points, draws a live preview with `smoothPath`,
  and on release simplifies, boxes and commits one node. The pen stays active.
- `renderNodes` draws a stroke as `.node.stroke` with a hit path and a visible
  `sketchPath` path; no connection dots, no double-click edit.
- Click on the line selects; the marquee uses the box. `"resize"` and
  `"resize-many"` rewrite `points` with `scalePoints` on release.
- **Measure** (spec open question 3): drag cards on a canvas with 500 strokes.
  If it lags, redraw only the moving elements during a drag, in this slice.
- `README.md`: the pen; how a stroke looks in Obsidian (an empty card the size
  of the stroke); _Drawing styles_ covers strokes. `CONTEXT.md`: **Pen**,
  **Stroke**.

### 6. Stroke color and width

_Commit: "Pick a stroke's color and width; the next stroke takes them"_

- **Red:** `pickNodeDefaults(defaults, "draw")` returns color and stroke width
  only. Tests: fill, font and text size are left out.
- **Green:** for a selection of strokes the properties panel hides
  `.shape-tools` and `.text-tools`, shows the swatches, `.border-tools` as
  "Width" and the style row. A new stroke applies the picked defaults.

### 7. Eraser

_Commit: "Wipe strokes away with the eraser on E"_

- **Red:** `strokes.ts` `strokesTouched(nodes, path, tolerance)`. Tests: finds
  strokes the path passes within tolerance; skips cards, shapes, free text,
  groups, points and locked strokes; finds a stroke crossed between two
  pointer samples.
- **Green:** `Tool` gains `{ kind: "eraser" }`, **E**, a toolbar button. Drag
  kind `"erase"` adds `.fading` to touched strokes; release deletes them in one
  commit; Escape clears the set and the classes.
- `README.md`: the eraser. `CONTEXT.md`: **Eraser**.

### 8. Custom shapes

_Commit: "Close a stroke or a pinned line to make a shape you can fill and write in"_

- **Red:** `strokes.ts` `closes(points, tolerance, minSize)` and
  `hitInside(node, p)`. Tests: closes within 12 pixels and at least 16 on the
  longer side; not when too small; `hitInside` with a turn. `jsonCanvas.ts`
  `isClosed`, `setClosed` (leaves out `false`); a stroke's `nodeLook` gives
  `fill: "none"`, and `setNodeLook` leaves `"none"` out and writes `"semi"`.
  `pickNodeDefaults(defaults, "draw", closed)` also gives fill, font and text
  size. The eraser test gains: a custom shape with text is skipped.
- **Green:** a pen release that closes sets the last point to the first and
  `setClosed`. A pinned line (slice 3) with 3 or more pins closes on a click
  near its first pin into a custom shape with `"sharp": true`, and no
  connection. `renderNodes` gives a closed stroke `shape fill-<fill>`, a path
  ending in `Z` (straight sides when sharp), `.content` and the four `.connect`
  dots. Double-click edits text. A filled one is hit inside, an unfilled one by
  its line. The panel shows fill (no shape picker) and the text tools.
- `README.md`: custom shapes and how they look in Obsidian (a text card with
  their text). `CONTEXT.md`: **Custom shape**.

### 9. Export as SVG

_Commit: "Export a canvas or the selection as an SVG file"_

- **Red:** `geometry.ts` `exportBounds(rects, margin)`. Tests: 32-pixel margin;
  a turned card counts with its turned outline; a free connection counts with
  its ends and bends. `webview/export.ts`, the parts without a DOM: the font
  and image `@font-face` and data URI strings, the CSS variable block for each
  paper, and the list of what goes in (selection, else all; never points,
  handles, grid or the empty-canvas hint).
- **Green:** `buildSvg` in `export.ts`. The `inline` and `inlined` messages in
  `protocol.ts`; the host reads images and the two Caveat files with
  `vscode.workspace.fs`. The command `canvas.exportSvg` in `extension.ts` posts
  `export` to the active panel; the webview answers `exported`; the host shows
  `showSaveDialog` next to the canvas and writes the file. Light paper,
  background on, until slice 10.
- Check by eye: `sample/Welcome.canvas` and its SVG side by side.
- `package.json`: `canvas.exportSvg` in `contributes.commands` and in
  `menus.commandPalette` when `activeCustomEditorId == canvas.editor`.
  `README.md`: export. `CONTEXT.md`: **Export**.

### 10. Export as PNG, options, buttons and menu items; final check

_Commit: "Export as PNG, pick background, paper and scale, from the zoom bar or the menu"_

- **Red:** `contextMenuItems.test.ts`: `exportPng` and `exportSvg` in the
  selection menu and the empty-canvas menu, always enabled.
- **Green:** `canvas.exportPng`: the webview draws the SVG on an
  `OffscreenCanvas` at the chosen scale and sends the PNG as base64. The quick
  pick (background, paper, scale for PNG) starts on the paper shown and
  remembers the rest in `globalState`. Two zoom bar buttons and the two menu
  items send `exportRequest` to the host, which runs the same command.
- `package.json`: `canvas.exportPng` as for SVG.
- **Final check (R30–R32):** the new keys show in tooltips, hints and the `?`
  overview; read `README.md` _Using it_ against R1 to R29 and fill any gap;
  `npm run check`; run each feature once in the Extension Development Host on
  `sample/Welcome.canvas` in a light and a dark theme, with save, reload, undo
  and redo; export at 1× and 2× in light and dark and compare by eye; open the
  edited canvas in Obsidian and back.

## Concerns: proposed defaults

The spec has no concerns left. Cutting the slices raised two small ones. Build
follows the default unless dom8509 picks otherwise.

| | Concern | Default | Why |
| - | ------- | ------- | --- |
| C1 | Ctrl/Cmd+Z while a pinned line is still open | Drop the open line, then let VS Code undo as usual | Nothing is committed yet, so undo should not reach past it to older work. |
| C2 | The pen after a stroke closes into a custom shape | The pen stays active, as after any stroke (R17) | One rule for every stroke; a double-click after Escape writes in the shape. |

## Not in this plan

Everything under the spec's _Out of scope_.
