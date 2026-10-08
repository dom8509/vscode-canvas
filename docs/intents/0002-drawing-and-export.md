# Intent 0002: Drawing, free arrows and export

- **Status:** Proposed
- **Owner:** dom8509
- **Date:** 2026-10-08
- **Related:** [Intent 0001: Usability polish](0001-usability-polish.md)

## Problem

The biggest gaps to Excalidraw and tldraw are whole features, not polish:

- **Connections need two cards.** You hover a card, find a dot and drag it to
  another card. There is no arrow or line tool for an arrow that starts or ends
  anywhere, and you cannot drag the end of an existing connection to another
  card.
- **No freehand drawing.** There is no pen and no eraser, so you cannot sketch,
  circle something or underline it.
- **No export.** A board cannot be saved or copied as a PNG or SVG to put in a
  document, chat or slide.

## Goal

Draw, point and share like in Excalidraw and tldraw, while the `.canvas` file
stays valid JSON Canvas and still opens in Obsidian.

## Non-goals

- Shape recognition from freehand strokes (a closed stroke keeps the outline
  as drawn; it is not turned into a rectangle or ellipse).
- Pressure-sensitive brush styles beyond simple stroke width.
- PDF export, embedding a live canvas in Markdown, collaboration.

## Requirements

### R1. Arrow and line tool
- New tool **A** (arrow) and **L** (line) in the bottom toolbar.
- Drag on the canvas to draw. An end dropped on a card binds to that card (and
  the side under the pointer); an end on empty space stays a free point.
- Or click to pin the start, click again to pin each bend, and double-click
  (or Enter) to end the line, as in Excalidraw. Each pin may sit on a card or
  on empty space; the ends bind as above.
- A line whose last pin lands on its first closes and becomes a custom shape,
  as a closed pen stroke does (R4).
- Holding Shift snaps the angle to 15° steps.
- The new connection takes the sticky line and arrow style.
- Dragging a card's dot to empty space also leaves a free end. Arrows do not
  have to be pinned to cards.

### R2. Edit connection ends
- A selected connection shows a handle at each end.
- Dragging a handle onto a card rebinds it; dropping it on empty space makes
  that end free.
- Moving a bound card moves the end, as today. Free ends move with the
  connection when it is moved as part of a selection.

### R3. Storage of free ends
JSON Canvas edges need `fromNode` and `toNode`. A free end is stored as a small
anchor node: a text node with `"shape": "point"`, empty text and a 1×1 size at
the end position. This follows how shapes and free text are already stored
(text nodes with extra properties). The canvas never draws or selects point
nodes on their own; deleting the last edge on a point removes the point.
Obsidian shows a tiny empty card there, which is acceptable.

### R4. Pen
- New tool **P** (pen). Drag to draw a stroke; the stroke is smoothed.
- Properties: color, stroke width (thin, normal, bold, extra), and the drawing
  style (architect/artist/cartoonist) like other elements.
- A stroke is a node: a text node with `"shape": "draw"`, empty text, its
  bounding box as `x/y/width/height`, and `"points"` as a flat list of numbers
  relative to the box. Moving, resizing, turning, grouping, layer order and
  lock work as for any node.
- Strokes made within a short time with the pen still active stay separate
  nodes; the user can group them.
- A stroke that ends where it started closes, as in Excalidraw, and becomes a
  custom shape: it can be filled, written in and connected like any shape.

### R5. Eraser
- New tool **E**. Dragging over strokes deletes the strokes it touches.
  Touched strokes fade while dragging and are deleted on release (one undo
  step).
- The eraser only deletes pen strokes, not cards, shapes or connections.

### R6. Export
- Command *Canvas: Export as PNG* and *Canvas: Export as SVG*, plus the same in
  the context menu (with Intent 0001) and a button in the top bar.
- Exports the selection if there is one, otherwise the whole canvas, with a
  padding margin.
- Options: background on/off, light or dark, scale 1×/2×/3× (PNG).
- The exported image looks exactly like the canvas: same fonts (handwriting
  font embedded in SVG), same Rough.js lines, images and note previews.
- Files are saved via VS Code's save dialog, next to the canvas by default.

## Acceptance criteria

- Arrows with free ends, rebound ends, pen strokes and erased strokes survive a
  save/reload and an Undo/Redo through VS Code.
- A canvas with point and draw nodes opens in Obsidian without errors; all
  other cards and edges look as before.
- PNG and SVG export of `sample/Welcome.canvas` matches the canvas on screen,
  in light and dark, at 1× and 2×.
- Unit tests for: point-node bookkeeping (create, reuse, clean up), stroke
  smoothing and bounds, point scaling on resize/turn, eraser hit-testing,
  export bounds.
- `npm run check` passes. README documents the new tools and commands.

## Design notes

- Pure logic goes into testable modules: stroke smoothing and hit-testing
  (`webview/strokes.ts`), point-node rules (`src/jsonCanvas.ts`), export
  bounds (`webview/geometry.ts`).
- SVG export can reuse the drawing code that renders shapes and edges; cards
  with HTML content (Markdown, notes) go in as `foreignObject`. PNG export
  draws that SVG onto a canvas in the webview and sends the bytes to the
  extension host to save.
- Images in the workspace are loaded through webview URIs; export must inline
  them as data URIs so the file is self-contained.

## Risks

- **Obsidian look.** Point and draw nodes appear as empty cards in Obsidian.
  This is the price of staying inside JSON Canvas. Keep them as small as
  possible and document it in the README.
- **File size.** Long strokes produce many points. Simplify each stroke
  (e.g. Ramer–Douglas–Peucker) and round to one decimal.
- **`foreignObject` in PNG.** Browsers taint a canvas when the SVG pulls in
  outside resources. Inline every image and font before drawing.
- **Performance.** Many strokes make the full redraw on every change slower.
  This intent may need the partial redraw noted in Intent 0001.

## Rollout

Separate PRs, each usable alone: R6 export (no format change), R1 + R2 + R3
arrows and free ends, R4 pen, R5 eraser.

## Open questions

- Should free ends use point nodes (R3) or a non-standard edge property like
  `"fromPoint": {x, y}` with a hidden dummy node? Proposal: point nodes. They
  keep every edge valid for any JSON Canvas reader.
- Should pen strokes in one session merge into one node? Proposal: no, keep
  them separate; it makes erasing and moving simpler.
