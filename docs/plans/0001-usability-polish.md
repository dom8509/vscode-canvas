---
title: Usability polish
spec: docs/specs/0001-usability-polish.md
intent: docs/intents/0001-usability-polish.md
spec_commit: 605d599
status: accepted
created: 2026-10-08
---

# Plan: Usability polish

How Build turns [Spec 0001](../specs/0001-usability-polish.md) into code: eleven
**slices**, each a thin path from a key or click to what a person sees, each
test first. The order follows the intent's _Rollout_, with one change: lock
comes before the context menu, so the menu ships with every item working.

## Rules for every slice

- **Red first.** The test goes in `test/` through the module's exports, and
  fails for the reason the slice names before any code is written. DOM-only
  modules (`contextMenu.ts`, `shortcutPanel.ts`, `toolbar.ts`) have no test;
  their logic sits in a tested module next to them.
- **Words from `CONTEXT.md`.** A slice that coins a term adds it there in the
  same commit.
- **Docs in the same commit.** `README.md` _Using it_ gets the feature and its
  keys; a new setting goes into `package.json` `contributes`.
- **Round trip.** A slice that writes to the file writes through a `set*`
  helper, so a default value stays out of the file.
- **Gate.** `npm run check` passes, then one commit, named for what a person can
  now do.

## Slices

| # | Slice | Requirements | Test |
| - | ----- | ------------ | ---- |
| 1 | Every tool has a key, select and hand tool | R20, R21, R22 | `test/shortcuts.test.ts` |
| 2 | Shortcut overview and empty-canvas hint | R23, R25 | `test/shortcuts.test.ts` |
| 3 | Layer order on keys | R4, R5, R6 | `test/arrange.test.ts` |
| 4 | Lock | R13, R14, R15, R16 | `test/jsonCanvas.test.ts`, `test/arrange.test.ts` |
| 5 | Context menu | R1, R2, R3 | `test/contextMenuItems.test.ts` |
| 6 | Align and distribute | R7, R8 | `test/arrange.test.ts`, `test/geometry.test.ts` |
| 7 | Snap guides | R9, R10 | `test/arrange.test.ts` |
| 8 | Resize a multi-selection | R11, R12 | `test/arrange.test.ts` |
| 9 | Dark paper | R17, R18, R19 | `test/theme.test.ts` |
| 10 | Sticky styles | R24 | `test/nodeDefaults.test.ts` |
| 11 | Coalesced nudges, final check | R26, R27 | `test/coalesce.test.ts` |

### 1. Every tool has a key, select and hand tool

_Commit: "Every tool has a key, and a select and a hand tool join the toolbar"_

- **Red:** `shortcuts.ts` exports one table of keys. Tests: no key is used
  twice; every tool in the toolbar has an entry; the key text reads `Ctrl` on
  Windows and Linux and `⌘` on macOS.
- **Green:** move the bottom toolbar and `setTool` out of `main.ts` into
  `toolbar.ts`. `Tool` gains `select` (replaces `null`) and `hand`. The hand
  tool starts the existing `"pan"` drag on a left drag. Tooltips and the small
  hint on each button read from `shortcuts.ts`.
- The keydown guard (`main.ts` line ~1522) adds `[contenteditable]`.
- Escape: switches back to the select tool, or clears the selection when the
  select tool is already on. (Closing a menu comes in slices 2 and 5.)
- `CONTEXT.md`: **Select tool**, **Hand tool**.

### 2. Shortcut overview and empty-canvas hint

_Commit: "? shows every key, and an empty canvas says how to start"_

- **Red:** the table groups every key under tools, editing, view or navigation;
  no key is left without a group.
- **Green:** `shortcutPanel.ts` builds the panel from the table. `?` and a new
  button in the zoom bar open it; Escape or the button closes it. Escape closes
  the panel before it does anything else.
- `#empty-hint` in the viewport with `pointer-events: none`, shown by
  `render()` when `data.nodes` is empty.
- `CONTEXT.md`: **Shortcut overview**.

### 3. Layer order on keys

_Commit: "Bring cards to the front or send them back with Ctrl+] and Ctrl+["_

- **Red:** `arrange.ts` `reorder(nodes, ids, op)` for `forward`, `backward`,
  `front`, `back`. Tests: groups stay at the start of `nodes`; a group moves
  only among groups; a card only among cards; ids not in the list are ignored;
  the order of the other nodes does not change.
- **Green:** the four keys call `reorder`, then `commit()`: one undo step each.
  The DOM order inside `#groups` and `#nodes` follows `data.nodes`.
- Check by hand that the order survives a save and a reopen in Obsidian (R5).
- `CONTEXT.md`: **Layer order**.

### 4. Lock

_Commit: "Lock a card, group or connection so it stays put"_

- **Red:** `jsonCanvas.ts` `isLocked` and `setLocked`. Tests: `setLocked(x,
  false)` removes the property; `parseCanvas` then `serializeCanvas` keeps
  `"locked": true`. In `arrange.ts`, `reorder` skips locked ids.
- **Green:** Ctrl/Cmd+Shift+L and a toggle in the properties panel. Every path
  the spec lists checks `isLocked` first: move, resize, turn, edit, rename,
  label, color, look, edge style, drawing style, nudge, delete, reorder and the
  marquee. A click still selects. The panel disables its controls for a locked
  selection, except the lock toggle.
- Moving an unlocked group carries locked cards inside it (spec _Decisions_;
  ADR candidate: write `docs/adr/0001-lock-and-groups.md` in this slice).
- Lock badge on hover and when selected.
- Follows C5 and C6 (see below).
- `CONTEXT.md`: **Lock**.

### 5. Context menu

_Commit: "Right-click opens a menu for the selection or the canvas"_

- **Red:** a pure function `menuItems(selection, clipboard)` in
  `contextMenuItems.ts` returns each item with its label, key text and
  `enabled`. Tests: empty canvas gives paste, select all, zoom to fit; paste is
  disabled with an empty clipboard; group selection is disabled for one card;
  lock reads "Unlock" when everything selected is locked; delete is disabled
  for a locked selection.
- **Green:** `contextMenu.ts` builds and places the menu, keeps it on screen,
  and calls the actions `main.ts` already has (cut, copy, paste, duplicate,
  delete, `reorder`, `addGroup`, lock, zoom). Right-click selects the element
  unless it is already selected. `preventDefault` on `contextmenu` keeps VS
  Code's own menu away. Escape, a click outside or picking an item closes it.
- `CONTEXT.md`: **Context menu**.

### 6. Align and distribute

_Commit: "Align and distribute selected cards from the properties panel"_

- **Red:** `geometry.ts` `turnedBounds(rect, turn)`. `arrange.ts`
  `align(rects, edge)` for the six edges and `distribute(rects, axis)`. Tests:
  align uses the selection's bounds; distribute keeps the outer two and makes
  the gaps equal, also when cards overlap; a turned card counts with its turned
  outline.
- **Green:** six align buttons for 2+ cards, two distribute buttons for 3+, in
  the properties panel. Locked cards stay where they are. One `commit()` each.

### 7. Snap guides

_Commit: "Cards snap to the edges and centers of nearby cards while you drag"_

- **Red:** `arrange.ts` `snapGuides(moving, others, tolerance)` returns the
  offset per axis and the guide lines. Tests: an edge within tolerance snaps;
  outside it does not; centers snap to centers; the closest match wins; an axis
  with no match returns no offset.
- **Green:** `case "move"` and `case "resize"` call `snapGuides` with 6 screen
  pixels turned into canvas units, then fall back to `snap` to the grid on an
  axis with no guide. Alt turns both off. Guide lines go in a new `#guides` SVG
  layer in `#world`, cleared in `endDrag`. Candidates: cards whose bounds meet
  the viewport widened by one viewport.
- **Measure** (spec open question 3): drag on a 300-card canvas. If it lags,
  redraw only the moving cards during a drag, in this slice.
- `CONTEXT.md`: **Snap guide**.

### 8. Resize a multi-selection

_Commit: "Resize several selected cards at once"_

- **Red:** `arrange.ts` `scaleRects(rects, from, to, keepRatio)`. Tests:
  positions and sizes scale around the opposite corner or side; `keepRatio`
  keeps the box's ratio; a flip past the anchor behaves as single resize does
  (`resizedCorner`).
- **Green:** 2+ selected cards show one box with eight handles instead of each
  card's handles. New drag kind `"resize-many"` keeps the start rects and
  applies `scaleRects` on each move; snap guides from slice 7 apply. Free text
  scales through `setTextScale`, clamped to `MIN_TEXT_SCALE` and
  `MAX_TEXT_SCALE`. A selected group scales with its cards. Locked cards in the
  selection turn the handles off.

### 9. Dark paper

_Commit: "The canvas follows the dark VS Code theme"_

- **Red:** `theme.ts` `resolveTheme(setting, bodyClass)`. Tests: each of the
  four VS Code body classes with `auto`, `light` and `dark`; an unknown value
  falls back to `auto`.
- **Green:** `style.css` moves today's white-paper overrides under
  `#viewport[data-paper="light"]` and adds a `dark` block. A
  `MutationObserver` on `body`'s class follows a theme switch. The host reads
  `canvas.theme` in `sendSettings` and `onDidChangeConfiguration`; the
  `settings` message in `protocol.ts` gains `theme`. `package.json` lists
  `canvas.theme`.
- Check by hand: preset colors 1 to 6, a hex color, shape fills and Rough.js
  strokes on both papers, and the high-contrast themes. The file does not
  change on a theme switch.
- Follows C3. `CONTEXT.md`: **Paper**.

### 10. Sticky styles

_Commit: "New cards take the style you picked last"_

- **Red:** move the merge into a small pure function, `pickNodeDefaults(
  defaults, look, kind)`, next to `drawingStyles.ts` (`webview/nodeDefaults.ts`).
  Tests: a shape takes fill and border, a text card takes color, font and text
  size; a value that does not fit the kind is left out.
- **Green:** `shapeDefaults` becomes `nodeDefaults`, set by
  `setSelectedNodeLook` and `setColor`, applied through `setNodeLook` in
  `textNodeAt`, `freeTextAt` and the shape tool, saved with `edgeDefaults` in
  `vscode.setState`.

### 11. Coalesced nudges, final check

_Commit: "Arrow-key nudges in a row undo in one step"_

- **Red:** `coalesce.ts` with fake timers. Tests: three nudges 200 ms apart
  commit once, 500 ms after the last; a `flush()` commits at once; a flush with
  nothing pending does nothing.
- **Green:** the nudge applies to `data`, redraws, and hands the commit to the
  coalescer. Any other `commit()`, a `load` message, `blur` and
  `visibilitychange` flush first, and so does Ctrl/Cmd+S (C4).
- **Final check (R27):** read `README.md` _Using it_ against R1 to R26 and fill
  any gap; `npm run check`; run each feature once in the Extension Development
  Host on `sample/Welcome.canvas` in a light and a dark theme; open the edited
  canvas in Obsidian and back.

## Concerns: decided

The spec left six concerns to dom8509. dom8509 accepted the choices below on
2026-10-08. Build follows them; they are not deviations.

| | Concern | Decision | Why |
| - | ------- | ----------- | --- |
| C1 | `[`, `]`, `?` on non-US keyboards | Match both `e.key` and `e.code` | Works on US and German layouts; costs one line per key. |
| C2 | Clash with VS Code keys | Check in slice 1 on Linux, add `contributes.keybindings` scoped to `activeCustomEditorId == 'canvas.editor'` only for a key that clashes | Keeps `package.json` small when nothing clashes. |
| C3 | Dark paper by default | `auto`, as the intent says | It is what people on a dark theme asked for; `light` is one setting away. |
| C4 | A nudge not yet committed | The spec's flushes, plus a flush on Ctrl/Cmd+S in the webview | Closes the save case for one keydown check. |
| C5 | Deleting a card with a locked connection | The card cannot be deleted until the connection is unlocked | A lock always means "cannot be deleted"; no exceptions to explain. |
| C6 | Copy of a locked element | The copy is not locked | A copy is made to be placed; as in tldraw. |

## Not in this plan

Everything under the spec's _Out of scope_.
