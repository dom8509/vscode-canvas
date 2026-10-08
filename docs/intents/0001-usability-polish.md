# Intent 0001: Usability polish

- **Status:** Proposed
- **Owner:** dom8509
- **Date:** 2026-10-08
- **Related:** [Intent 0002: Drawing, free arrows and export](0002-drawing-and-export.md)

## Problem

The canvas already covers what you need to lay out a board: cards, shapes, free
text, files, links, groups and styled connections. But compared with tldraw,
Excalidraw and Obsidian Canvas, everyday editing feels unfinished:

- There is no context menu. Copy, duplicate, delete and grouping are spread
  over keys and buttons.
- Cards cannot be brought to the front or sent to the back.
- There is no way to align or distribute cards, and there are no snap guides
  while dragging. Only the grid helps.
- Only one card can be resized at a time.
- Nothing can be locked, so a background card or group gets moved by accident.
- The canvas is always white paper (`webview/style.css`), which glares in a
  dark VS Code theme.
- The toolbar has no select or hand tool, and only T, R and O have keys. Tools
  do not show their key, and there is no shortcut overview, so features like
  Shift+1 or Space+drag are hard to find.
- New shapes and cards do not take the last used style (connections do).
- A new, empty canvas gives no hint on how to start.
- Each arrow-key nudge is its own undo step.

## Goal

Make everyday editing feel as clean and predictable as tldraw and Excalidraw,
without changing what the `.canvas` file means to Obsidian.

## Non-goals

- New element types (freehand drawing, free arrows) and export. See
  [Intent 0002](0002-drawing-and-export.md).
- Real-time collaboration.
- A redesign of the properties panel.

## Requirements

### R1. Context menu
Right-click on a card, connection, group or the selection opens a menu with:
cut, copy, paste, duplicate, delete, bring to front, bring forward, send
backward, send to back, group selection, lock/unlock, zoom to selection.
Right-click on the empty canvas offers paste, select all and zoom to fit.
Items that do not apply are disabled, and each item shows its shortcut.

### R2. Layer order
- Ctrl/Cmd+] forward, Ctrl/Cmd+[ backward, Ctrl/Cmd+Shift+] to front,
  Ctrl/Cmd+Shift+[ to back.
- Order is the order of `nodes` in the file, as in the JSON Canvas spec, so
  Obsidian shows the same order.
- Groups stay behind the cards they contain.

### R3. Align and distribute
- With 2+ cards selected, the properties panel shows align left, center,
  right, top, middle, bottom.
- With 3+ cards selected, it also shows distribute horizontally and
  vertically.
- One undo step per action.

### R4. Snap guides
While moving or resizing, cards snap to the edges and centers of nearby cards
and a thin guide line shows the match. Alt still turns all snapping off.

### R5. Resize a multi-selection
A selection of 2+ cards gets one bounding box with corner and side handles.
Dragging scales positions and sizes together; Shift keeps the aspect ratio.
Free text scales its font size, as single free text does today.

### R6. Lock
- Lock/unlock from the context menu, the properties panel and Ctrl/Cmd+Shift+L.
- A locked element cannot be moved, resized, turned, edited or deleted, and a
  marquee does not pick it up. A click still selects it so it can be unlocked.
- Stored as `"locked": true` on the node or edge. Unknown properties are
  already kept (`src/jsonCanvas.ts`), so Obsidian keeps the flag.

### R7. Dark theme
- The canvas follows the VS Code theme (light, dark, high contrast) by default.
- A setting `canvas.theme` (`auto`, `light`, `dark`) overrides it.
- Preset colors 1 to 6 and custom colors stay readable on both backgrounds;
  shape fills and Rough.js strokes adjust.
- The data does not change; only the drawing does.

### R8. Toolbar and keys
- Add a select tool (V) and a hand tool (H) to the bottom toolbar.
- Give every tool a key and show it in its tooltip and as a small hint on the
  button: V select, H hand, T text, R rectangle, O ellipse, N card, G group.
  Keys never fire while a text field has focus.
- Escape always goes back to the select tool.

### R9. Shortcut overview
`?` (and a button in the zoom bar) opens a panel listing all shortcuts,
grouped by tools, editing, view and navigation. Escape closes it.

### R10. Sticky styles
Cards, shapes and free text take the color, fill, font, text size and border
picked last, as connections already do. The choice is per canvas session and
is not written to the file.

### R11. Empty-canvas hint
An empty canvas shows a short, centered hint ("Double-click to write · T text
· R O shapes · drop files here · ? shortcuts") that disappears with the first
element.

### R12. Coalesced undo
Repeated arrow-key nudges within ~500 ms make one undo step. Dragging stays one
step, as today.

## Acceptance criteria

- Every requirement above works in the Extension Development Host on
  `sample/Welcome.canvas`, in a light and a dark VS Code theme.
- A canvas edited with these features opens in Obsidian with the same layer
  order and positions; extra properties (`locked`) survive a round trip
  through Obsidian.
- New unit tests cover the pure parts: layer order operations, align and
  distribute, snap-guide matching, multi-selection scaling, undo coalescing.
- `npm run check` passes.
- README "Using it" documents every new feature and key.

## Design notes

- Layer order, align/distribute, snap matching and multi-scaling are pure
  functions on rects and node lists. Put them in `webview/geometry.ts` (or a
  new `webview/arrange.ts`) so they are testable without a DOM.
- `webview/main.ts` is ~1,850 lines. Move the context menu, the shortcut panel
  and the toolbar into their own modules as part of this work instead of
  growing `main.ts` further.
- Theme colors come from the VS Code CSS variables the webview already gets;
  drop the hard-coded white overrides in `webview/style.css` for `auto`.

## Risks

- Snap guides add work on every pointer move. Limit candidates to cards near
  the viewport.
- Today every change redraws all nodes and edges (`replaceChildren` in
  `renderNodes` / `renderEdges`). Snap guides and multi-resize make this more
  visible on large canvases. If it lags at ~300 cards, redraw only what
  changed during a drag.
- Shortcuts can clash with VS Code keybindings. Check each one in the custom
  editor; prefer what tldraw and Excalidraw use.

## Rollout

Ship in small PRs, each usable on its own, in this order: R8 + R9 + R11
(discoverability), R1 + R2 (context menu and order), R3 + R4 + R5 (arrange),
R6 (lock), R7 (dark theme), R10 + R12 (polish).

## Open questions

- Should locked elements show a small lock badge, or only a different
  selection outline? Proposal: a badge on hover and when selected.
- Should `canvas.theme` also be settable per canvas (in the file), like the
  drawing style? Proposal: no, a theme is a viewer preference.
