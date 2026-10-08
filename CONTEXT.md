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

**End** and **head**: JSON Canvas knows two ends, `none` and `arrow`. The **head** is the drawn shape at an end (arrow, open, dot, bar, diamond); any head other than none is saved as an `arrow` end plus a head property.

**Edge style**: a connection's look: heads, line style (solid, dashed, dotted), line width, path style (curved, straight, elbow). Code: `EdgeStyle`.

## Look

**Look**: how a text card or file card is drawn: shape, fill, font, text size, stroke width. Code: `NodeLook`.

**Preset color**: Obsidian's colors `"1"` to `"6"`. Any other color is a hex value.

**Line width**: thin, normal, bold, extra. Used for connections and for a card's border (its **stroke width**).

**Drawing style**: how lines are sketched with Rough.js: **architect** (clean), **artist** (light hand, the default) or **cartoonist** (very sketchy). Set on the extension setting, the canvas or one element; the most specific wins. The data stays the same, only the drawing changes. _Avoid_: theme, mode.

**Turn**: a card's rotation, clockwise in degrees, set with the turn handle. Saved as `rotation`.

**Text scale**: how much bigger free text is drawn after being scaled by a corner handle. Saved as `textScale`.

## Editor

**Host**: the extension side, in Node with the VS Code API (`src/`).

**Webview**: the board itself, in the browser (`webview/`). Talks to the host only through **messages** (`src/protocol.ts`).

**Commit**: the webview writing the whole canvas back to the document. The document is the state; undo and redo are VS Code's.

**Properties panel**: the panel on the left that shows and sets the look of the selection.

**Bottom toolbar**: the row of buttons that adds cards, shapes, text, files, images, links and groups.
