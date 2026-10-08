# Context

The domain language of Canvas for VS Code. Use these terms in code, docs, specs and commits. Words in _Avoid_ name the same thing and drift from it.

## The file

**Canvas**: one `.canvas` file and the board it opens on. Stored as JSON Canvas, tab-indented, as Obsidian writes it. Code: `CanvasData`.

**JSON Canvas**: the open file format (jsoncanvas.org) Obsidian uses. Anything it does not define is an **extension property**: kept in the file, ignored by Obsidian.

**Workspace root**: the workspace folder holding the canvas. Every file path in a canvas is relative to it, as in an Obsidian vault.

## Cards

**Card**: one element on the board. The file calls it a node (`CanvasNode`); people and the UI say card. Every card has a position, a size and an optional color.

**Text card**: a card holding Markdown. Code: `TextNode`. Drawn in one of three ways, by its `shape` property:
- plain **card**: a box, as in Obsidian;
- **shape**: an outline from the shape list (rectangle, ellipse, star, …), as in tldraw;
- **free text**: bare text with no box, as in Excalidraw. Grows with its text; empty free text is removed.

Obsidian shows all three as plain text cards.

**File card**: a card showing a workspace file. Code: `FileNode`. A **note card** shows a Markdown note, an **image card** a picture. A **subpath** (`#Heading`, `#Heading#Sub`, `#^block`) limits a note card to one **section** of the note.

**Link card**: a card for a web URL. Code: `LinkNode`.

**Group**: a labelled frame around cards. Moving it moves the cards inside. Groups never turn. Code: `GroupNode`.

## Connections

**Connection**: a line from one card to another. The file calls it an edge (`CanvasEdge`); people and the UI say connection. _Avoid_: arrow, link (a link is a link card).

**Side**: where a connection meets a card: top, right, bottom or left.

**Free end**: an end of a connection that joins no card and sits at a spot on the canvas, as an arrow in Excalidraw does.

**Point**: the node that holds a free end: an empty 1×1 text node with `"shape": "point"`. The canvas never draws, selects or exports it; it goes when its last connection goes. Obsidian shows it as a tiny card. Code: `isPoint`, `pointNodeAt`.

**Pin** and **bend**: with the arrow or line tool, a click pins a line point by point. The first pin is the start, the last the end, and each one between is a **bend** the connection passes through. Saved as `"bends"` on the edge, in canvas coordinates; Obsidian draws the connection straight from end to end. Code: `bendsOf`, `setBends`.

**End** and **head**: JSON Canvas knows two ends, `none` and `arrow`. The **head** is the drawn shape at an end (arrow, open, dot, bar, diamond); any head other than none is saved as an `arrow` end plus a head property.

**Edge style**: a connection's look: heads, line style (solid, dashed, dotted), line width, path style (curved, straight, elbow). Code: `EdgeStyle`.

## Look

**Look**: how a text card or file card is drawn: shape, fill, font, text size, stroke width. Code: `NodeLook`.

**Preset color**: Obsidian's colors `"1"` to `"6"`. Any other color is a hex value.

**Line width**: thin, normal, bold, extra. Used for connections and for a card's border (its **stroke width**).

**Drawing style**: how lines are sketched with Rough.js: **architect** (clean), **artist** (light hand, the default) or **cartoonist** (very sketchy). Set on the extension setting, the canvas or one element; the most specific wins. The data stays the same, only the drawing changes. _Avoid_: theme, mode.

**Layer order**: which card lies on top of which. It is the order of `nodes` in the file: later is on top. Groups always lie behind every card and move only among groups.

**Lock**: a card, group or connection that cannot be moved, resized, turned, edited, restyled or deleted. A click still selects it, so it can be unlocked. Saved as `"locked": true`, an extension property. A group that moves carries its locked cards ([ADR 1](docs/adr/0001-lock-and-groups.md)).

**Snap guide**: the thin line that shows a moved or resized card lining up with an edge or center of a card nearby. Within 6 screen pixels the card snaps to it; on an axis with no guide it snaps to the grid. Code: `snapGuides`.

**Sticky style**: the color and look picked last in the properties panel. New cards, shapes and free text take what fits them, as new connections take the edge style picked last. Kept in the webview, never in the file. Code: `nodeDefaults`, `edgeDefaults`.

**Paper**: the canvas background with its ink: light (white paper, dark ink) or dark. The setting `canvas.theme` picks it, or the VS Code theme does. Only the look; the file stays the same. Code and CSS say paper (`data-paper`), since "theme" is a word to avoid for drawing style.

**Turn**: a card's rotation, clockwise in degrees, set with the turn handle. Saved as `rotation`.

**Text scale**: how much bigger free text is drawn after being scaled by a corner handle. Saved as `textScale`.

## Editor

**Host**: the extension side, in Node with the VS Code API (`src/`).

**Webview**: the board itself, in the browser (`webview/`). Talks to the host only through **messages** (`src/protocol.ts`).

**Commit**: the webview writing the whole canvas back to the document. The document is the state; undo and redo are VS Code's.

**Context menu**: the menu a right-click opens, for the selection or for the empty canvas. The canvas draws its own; VS Code's webview menu stays away.

**Shortcut overview**: the panel that lists every key, grouped by tools, editing, view and navigation. Opened with `?` or the button in the zoom bar.

**Properties panel**: the panel on the left that shows and sets the look of the selection.

**Bottom toolbar**: the row of buttons that picks a tool and adds cards, shapes, text, files, images, links and groups.

**Tool**: what a press on the canvas does. Code: `Tool`. The **select tool** (V) selects, moves and resizes; the **hand tool** (H) pans with a left drag; the text and shape tools place free text and shapes. The **arrow tool** (A) and the **line tool** (L) draw connections anywhere, with an arrow head at the end or none. Code: `{ kind: "connection" }`.
