---
title: Usability polish
intent: docs/intents/0001-usability-polish.md
intent_commit: 19bf2a2
status: draft
created: 2026-10-08
policies:
  - CONTEXT.md@2084ef7
  - AGENTS.md@2084ef7
  - README.md@df06af5
  - package.json@89623d9
  - src/jsonCanvas.ts@a157aa2
  - src/protocol.ts@89623d9
  - src/canvasEditor.ts@89623d9
  - webview/main.ts@a157aa2
  - webview/geometry.ts@335838c
  - webview/style.css@a157aa2
---

# Spec: Usability polish

## Problem

Laying out a board works, but everyday editing feels unfinished next to tldraw,
Excalidraw and Obsidian Canvas: no context menu, no layer order, no align or
snap guides, no lock, no dark canvas, hidden keys, and styles that do not stick.
See [Intent 0001, _Problem_](../intents/0001-usability-polish.md#problem).

## Requirements

Each requirement is observable in the Extension Development Host. "Card" and
"connection" are used as in `CONTEXT.md`.

**Context menu**

R1. Right-click on a card, connection or group selects it (unless it is already
in the selection) and opens a menu with: cut, copy, paste, duplicate, delete,
bring to front, bring forward, send backward, send to back, group selection,
lock/unlock, zoom to selection. (intent: R1)

R2. Right-click on the empty canvas opens a menu with: paste, select all, zoom
to fit. (intent: R1)

R3. A menu item that does not apply to the selection is shown disabled. Each
item shows its key. Escape, a click outside or picking an item closes the menu.
VS Code's own webview menu does not appear. (intent: R1)

**Layer order**

R4. Ctrl/Cmd+] moves the selected cards one step forward, Ctrl/Cmd+[ one step
back, Ctrl/Cmd+Shift+] to the front, Ctrl/Cmd+Shift+[ to the back. The menu
items of R1 do the same. Each is one undo step. (intent: R2)

R5. The drawn order is the order of `nodes` in the file. After a reorder, the
file opens in Obsidian with the same order. (intent: R2, acceptance criteria)

R6. A group always lies behind every card. Reordering a group moves it only
among groups. (intent: R2)

**Align and distribute**

R7. With 2+ cards selected, the properties panel shows align left, center,
right, top, middle and bottom. Each aligns to the bounds of the selection and is
one undo step. (intent: R3)

R8. With 3+ cards selected, the panel also shows distribute horizontally and
vertically: the outer two cards stay, the gaps between all cards become equal.
One undo step each. (intent: R3)

**Snap guides**

R9. While moving or resizing, an edge or center of the moving cards snaps to an
edge or center of a nearby card when within 6 screen pixels, and a thin guide
line shows the match. A guide snap wins over the grid on that axis. (intent: R4)

R10. Holding Alt turns off guide snaps and the grid, as it turns off the grid
today. (intent: R4)

**Resize a multi-selection**

R11. A selection of 2+ cards shows one bounding box with four corner and four
side handles instead of the handles of each card. (intent: R5)

R12. Dragging a handle scales the positions and sizes of all selected cards
around the opposite corner or side; Shift keeps the aspect ratio of the box.
Free text in the selection scales its text scale with it. One undo step.
(intent: R5)

**Lock**

R13. Lock/unlock is offered in the context menu, in the properties panel and on
Ctrl/Cmd+Shift+L, for cards, groups and connections. (intent: R6)

R14. A locked element cannot be moved, resized, turned, edited, restyled or
deleted. A marquee does not pick it up. A click still selects it, so it can be
unlocked. (intent: R6)

R15. Lock is saved as `"locked": true` on the node or edge, and is left out of
the file when false. It survives a round trip through Obsidian. (intent: R6,
acceptance criteria)

R16. A locked element shows a small lock badge on hover and when selected.
(intent: open question 1)

**Dark theme**

R17. By default the canvas follows the VS Code theme: light, dark, high
contrast dark, high contrast light. It follows a theme switch without reopening.
(intent: R7)

R18. A setting `canvas.theme` (`auto`, `light`, `dark`, default `auto`)
overrides it for every canvas. (intent: R7)

R19. Preset colors 1 to 6, hex colors, shape fills and Rough.js strokes stay
readable on both backgrounds. The `.canvas` file does not change when the theme
changes. (intent: R7)

**Toolbar and keys**

R20. The bottom toolbar gains a select tool (V) and a hand tool (H). With the
hand tool, a left drag pans the canvas. (intent: R8)

R21. Every tool and add button has a key, shown in its tooltip and as a small
hint on the button: V select, H hand, T text, R rectangle, O ellipse, N card,
G group. No key fires while a text field has focus. (intent: R8)

R22. Escape closes an open menu first; otherwise it switches back to the select
tool; with the select tool already active, it clears the selection. (intent: R8)

**Shortcut overview**

R23. `?`, and a button in the zoom bar, open a panel listing every key, grouped
by tools, editing, view and navigation. Escape or the button closes it.
(intent: R9)

**Sticky styles**

R24. A new card, shape or free text takes the color, fill, font, text size and
border picked last, as a new connection takes the edge style picked last. Only
values that fit the new element's kind are taken. Nothing about it is written to
the file. (intent: R10)

**Empty-canvas hint**

R25. A canvas with no cards shows a centered hint: "Double-click to write · T
text · R O shapes · drop files here · ? shortcuts". It goes away with the first
card and comes back when the last one is deleted. It does not catch clicks or
drops. (intent: R11)

**Coalesced undo**

R26. Arrow-key nudges less than 500 ms apart make one undo step. A drag stays
one step. (intent: R12)

**Done**

R27. `README.md`, section _Using it_, describes every feature and key above.
`package.json` `contributes.configuration` lists `canvas.theme`. `npm run check`
passes. (intent: acceptance criteria)

## Design

### Where the code goes

`webview/main.ts` (1,843 lines) stays the DOM glue. Pure logic gets new modules,
each with a test in `test/`, written first:

| Module | New? | Holds | Test |
| --- | --- | --- | --- |
| `webview/arrange.ts` | new | `reorder(nodes, ids, op)` (R4–R6), `align(rects, edge)`, `distribute(rects, axis)` (R7–R8), `snapGuides(moving, others, tolerance)` returning the offset and the guide lines (R9), `scaleRects(rects, from, to, keepRatio)` (R12) | `test/arrange.test.ts` |
| `webview/geometry.ts` | existing | reuse `boundsOf`, `rectsIntersect`, `snap`, `resizeAnchor`, `resizedCorner`; turned cards measured by a new `turnedBounds(rect, turn)` | `test/geometry.test.ts` |
| `src/jsonCanvas.ts` | existing | `isLocked(element)` and `setLocked(element, on)`, which leaves out `false` like the other `set*` helpers (R15) | `test/jsonCanvas.test.ts` |
| `webview/theme.ts` | new | `resolveTheme(setting, bodyClass)` → `light` or `dark` (R17–R18) | `test/theme.test.ts` |
| `webview/coalesce.ts` | new | a small timer that gathers nudges and calls `commit()` once, 500 ms after the last (R26) | `test/coalesce.test.ts`, with fake timers |
| `webview/shortcuts.ts` | new | one table of every key: label, group, key text per platform. The tooltips, button hints, menu items and the overview (R3, R21, R23) all read it. | `test/shortcuts.test.ts`: no key used twice |
| `webview/contextMenu.ts` | new | builds and places the menu, items enabled by a function of the selection (R1–R3) | none (DOM) |
| `webview/shortcutPanel.ts` | new | the overview panel (R23) | none (DOM) |
| `webview/toolbar.ts` | new | the bottom toolbar markup and `setTool`, moved out of `main.ts` (R20–R21) | none (DOM) |

### Layer order (R4–R6)

`data.nodes` is the order. `reorder` moves the selected ids within their own
class: groups among groups at the start of the list, cards among cards after
them. This keeps the rule `addGroup` and `paste` already follow (groups first,
"so they lie under the cards they hold"). The DOM already draws groups in
`#groups` under `#nodes`, so only the order inside each layer changes.

### Align, distribute, snap, multi-resize (R7–R12)

All work on rects. A turned card counts with the bounds of its turned outline
(`turnedBounds`). The move and resize cases of the pointer handler in
`main.ts` (`case "move"`, `case "resize"`, today snapping to `GRID` unless
`e.altKey`) call `snapGuides` first and fall back to `snap` on an axis without a
guide. Guide lines are drawn in a new SVG layer `#guides` inside `#world` and
cleared in `endDrag`. Candidate cards are those whose bounds meet the viewport,
widened by one viewport, to keep pointer moves cheap.

Multi-resize adds a drag kind `"resize-many"` that keeps the start rects of all
selected cards and applies `scaleRects` on each move. Free text gets its new text
scale through `setTextScale`, clamped to `MIN_TEXT_SCALE` and `MAX_TEXT_SCALE`.
A selected group scales with the cards inside it.

### Lock (R13–R16)

`locked` is an extension property, kept by `parseCanvas` as every unknown
property is, and ignored by Obsidian (`CONTEXT.md`, _JSON Canvas_). Every path
that changes an element checks `isLocked` first: the drag starts in
`main.ts` (move, resize, rotate; drawing a new connection from a locked card
stays allowed),
`deleteSelection`, `startEditing`, `renameGroup`, `editEdgeLabel`, `setColor`,
`setSelectedNodeLook`, `setSelectedEdgeStyle`, `setSelectedDrawingStyle`, the
arrow-key nudge, `reorder`, `align` and the marquee in `endDrag`. The properties
panel disables its controls for a locked selection, except the lock toggle.

### Dark theme (R17–R19)

VS Code puts `vscode-light`, `vscode-dark`, `vscode-high-contrast` or
`vscode-high-contrast-light` on the webview `body`; a `MutationObserver` on that
class follows theme switches. `resolveTheme` picks the paper, and `main.ts` sets
`data-paper="light|dark"` on `#viewport`.

`webview/style.css` today forces white paper on `#viewport` with hard-coded
overrides of the `--vscode-*` variables. These move under
`#viewport[data-paper="light"]`; a new `#viewport[data-paper="dark"]` block sets
dark paper and light ink (`--card-bg`, `--card-border`, `--edge`, `--dot`,
`--muted`, `--accent`, and the `--vscode-*` overrides). Rough.js strokes and
shape fills already take `currentColor`, `--shape-stroke`, `--card-border` or
`--accent`, so they follow. Preset colors keep their hex values from
`PRESET_COLORS`; readability on dark paper comes from the existing
`color-mix(... var(--card-bg))` tints.

The host reads `canvas.theme` next to `canvas.drawingStyle` in
`src/canvasEditor.ts` (`sendSettings`, `onDidChangeConfiguration`). The
`settings` message in `src/protocol.ts` gains a field:
`{ type: "settings"; drawingStyle: string; theme: string }`.

### Toolbar, keys, overview (R20–R23)

`Tool` gains `{ kind: "select" }` and `{ kind: "hand" }`; `select` replaces
today's `null`. With `hand`, a pointer down on the canvas starts the existing
`"pan"` drag. The keydown handler in `main.ts` keeps its guard
(`closest("input, textarea")`) and adds `[contenteditable]`. Keys come from
`shortcuts.ts`. A `?` button joins the zoom bar.

### Sticky styles (R24)

`shapeDefaults` in `main.ts` today keeps only the fill. It becomes `nodeDefaults:
Partial<NodeLook> & { color?: string }`, set by `setSelectedNodeLook` and
`setColor`, and applied through `setNodeLook` when `textNodeAt`, `freeTextAt`
and the shape tool create a card. It is kept in the webview state next to
`edgeDefaults` (`vscode.setState`), so it survives a reload of the webview but
not a new window, as `edgeDefaults` does today.

### Empty-canvas hint (R25)

A `#empty-hint` element in the viewport with `pointer-events: none`, shown by
`render()` when `data.nodes` is empty.

### Coalesced undo (R26)

Each `commit()` is one `WorkspaceEdit` in `src/canvasEditor.ts`, so one VS Code
undo step. The webview applies nudges to `data` and redraws at once, but hands
the commit to `coalesce.ts`, which commits 500 ms after the last nudge. Any
other `commit()`, a `load` message, blur of the webview and `visibilitychange`
flush the pending commit first. See C4.

### Docs

`README.md` _Using it_ gets: the context menu, layer keys, align and distribute,
snap guides, multi-resize, lock, the theme and `canvas.theme`, the new tools and
keys, the `?` overview, sticky styles, and coalesced nudges. `package.json`
`contributes.configuration` gets `canvas.theme`. `CONTEXT.md` gets the new
terms: **Lock**, **Snap guide**, **Layer order**, **Paper** (the canvas
background, light or dark), **Select tool**, **Hand tool**, **Context menu**,
**Shortcut overview**.

## Decisions

- **Own HTML context menu, not VS Code's `webview/context` menu.** The native
  menu cannot show per-selection disabled states and keys without a contribution
  per item in `package.json` and a round trip to the host. Rejected for that.
- **Group selection is an action, not a new grouping concept.** It runs the
  existing `addGroup` (a frame around the selection), as the bottom toolbar does.
- **Groups reorder only among groups** (R6). The alternative, free order with a
  rule "a group never above its cards", breaks for overlapping groups and is
  harder to explain.
- **Turned cards align and snap by the bounds of their turned outline.**
  Alternative: their unturned rect, which looks wrong on screen.
- **Locked elements cannot be restyled** (R14), as in tldraw. The intent lists
  "edited"; restyling is read as editing.
- **Moving an unlocked group carries locked cards inside it.** A lock protects an
  element from being dragged by itself; it does not pin it to the paper.
  ADR candidate.
- **Lock badge on hover and when selected** (R16), the intent's proposal.
- **`canvas.theme` is a setting only, not per canvas**, the intent's proposal: a
  theme is a viewer preference and would make a shared file look different for
  each person. Not to be confused with **drawing style**, which is per canvas.
- **Paper, not "theme", in code and CSS** (`data-paper`), because `CONTEXT.md`
  lists "theme" under _Avoid_ for drawing style.
- **Sticky styles live in webview state**, like `edgeDefaults`. The intent says
  "per canvas session"; matching the existing connection behaviour is the less
  surprising choice.
- **Guide snap tolerance 6 screen pixels**, as tldraw. Tuned in Build if it
  feels off.
- **Coalescing in the webview, not the host.** VS Code makes each
  `applyEdit` an undo step; the host cannot merge them.

## Open questions from the intent

1. _Lock badge or a different selection outline?_ Answered: a badge on hover and
   when selected (R16, _Decisions_).
2. _Should `canvas.theme` also be settable per canvas?_ Answered: no (R18,
   _Decisions_).
3. _Performance at ~300 cards_ (intent, _Risks_). Carried to Build: the design
   limits snap candidates to the viewport; Build measures a drag on a 300-card
   canvas and adds redraw-only-what-changed during a drag if it lags.
4. _Shortcut clashes with VS Code keybindings_ (intent, _Risks_). Carried to
   Build and raised as C1 and C2.

## Concerns

C1. Keys on non-US layouts -- policy: intent R2, R8, R9 name `[`, `]` and `?` --
owner: dom8509
    On a German layout `[` and `]` need AltGr, which browsers report as
    Ctrl+Alt, so Ctrl+AltGr+8 may never match "Ctrl+[". `?` is Shift+ß.
    Options: match `e.key` (works for `?`, unclear for AltGr brackets); match
    `e.code` `BracketLeft`/`BracketRight` (the physical US key, which is `ü`/`+`
    on German); offer both; or pick tldraw's other keys (Alt+Ctrl+arrows).

C2. Clashes with VS Code keys -- policy: intent _Risks_ -- owner: dom8509
    Ctrl+Shift+L (select all occurrences), Ctrl+[ and Ctrl+] (indent) and
    Ctrl+Shift+[ (fold) are VS Code keys. Their `when` clauses need text editor
    focus, so they should not fire in the custom editor, but this is not yet
    checked on Windows, macOS and Linux.
    Options: check in Build and change any key that clashes; or add
    `contributes.keybindings` scoped to `activeCustomEditorId == canvas.editor`.

C3. Dark paper reverses a standing choice -- policy: `webview/style.css` ("white
paper with dark ink, as in Excalidraw, whatever the VS Code theme") -- owner:
dom8509
    Default `auto` changes how every existing canvas looks for anyone on a dark
    theme.
    Options: default `auto`, as the intent says; or default `light`, so nothing
    changes until a person opts in.

C4. A deferred commit can lose a nudge -- policy: AGENTS.md _The document is the
state_ -- owner: dom8509
    For up to 500 ms after a nudge, the webview shows a state the document does
    not hold. A save (Ctrl+S) or a close in that window saves the old position;
    an external change in that window overwrites the nudge.
    Options: flush on blur, `visibilitychange` and before any `load` (the
    design), and accept the small window; flush on Ctrl+S too by catching it in
    the webview; or merge undo steps in the host by replacing the last edit,
    which VS Code does not offer.

C5. Lock and connections -- policy: intent R6 ("cannot be ... deleted") -- owner:
dom8509
    Deleting an unlocked card would leave a locked connection to it with no end,
    and a connection cannot outlive its card.
    Options: the locked connection goes with the card; or a card with a locked
    connection cannot be deleted until that connection is unlocked.

C6. Lock and paste/duplicate -- policy: none covers it -- owner: dom8509
    Copying a locked card: should the copy be locked?
    Options: keep `locked` on the copy (it is a property like any other); or drop
    it, as tldraw does, so a copy can be placed.

## Out of scope

- New element types (freehand drawing, free arrows) and export: [Intent
  0002](../intents/0002-drawing-and-export.md).
- Real-time collaboration.
- A redesign of the properties panel; this spec only adds the align, distribute
  and lock controls to it.
- Per-canvas theme (see _Decisions_).
- Redraw-only-what-changed for all edits; considered only for drags if
  open question 3 shows lag.
- Keybindings the user can change through VS Code's keyboard shortcuts editor.
