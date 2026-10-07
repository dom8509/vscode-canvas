# Canvas for VS Code

An infinite canvas for VS Code, modelled on
[Obsidian Canvas](https://obsidian.md/canvas). Lay out cards, notes, images,
web links and groups on a board and connect them with arrows. A canvas is
saved as a [JSON Canvas](https://jsoncanvas.org) `.canvas` file — the same
open format Obsidian uses, so the files work in both.

## Using it

- **Create a canvas:** run *Canvas: New Canvas* from the Command Palette, or
  right-click a folder in the Explorer. Any `*.canvas` file opens on the canvas.
- **Cards:** double-click the empty canvas to add a card and write in it
  (Markdown: headings, lists, tasks, **bold**, *italic*, `code`, links,
  `[[wikilinks]]`). Double-click a card to edit it; Escape or a click outside
  ends editing.
- **Notes and media:** the file button in the bottom toolbar adds a file from
  the workspace. Markdown notes show their text, images show the picture.
  You can also drag notes and files onto the canvas — from the Explorer, an
  editor tab or your file manager (hold **Shift** while dropping; VS Code
  needs it). Several files land in a grid; a folder brings the files in it.
  Notes from outside the workspace come in as text cards. Double-click a file
  card to open the file beside the canvas.
- **Web links:** the link button adds a card for a URL; *Open* opens it in
  the browser. Pasting a URL also makes a link card.
- **Groups:** the group button puts a group around the selected cards (or
  adds an empty one). Moving a group moves the cards inside it. Double-click
  its name to rename it.
- **Connect:** hover a card, then drag one of the dots on its sides onto
  another card. Drop on empty space to make a new card there, connected.
  Double-click a connection to give it a label.
- **Colors:** select cards or connections; the bar at the top sets one of six
  colors or a custom one.
- **Move and resize:** drag cards (they snap to the grid; hold **Alt** to
  move freely); drag the bottom-right corner to resize. Arrow keys nudge the
  selection.
- **Select:** click; Shift-click adds; drag on the empty canvas draws a
  selection box. Ctrl/Cmd+A selects everything.
- **Navigate:** scroll to pan (Shift+scroll sideways), Ctrl/Cmd+scroll or
  pinch to zoom, Space+drag or middle-drag to pan. Shift+1 zooms to fit all,
  Shift+2 to fit the selection. The bar at the top right zooms too.
- **Edit:** Delete removes the selection, Ctrl/Cmd+C/X/V copy, cut and paste
  cards (also as text into other apps), Ctrl/Cmd+D duplicates.
  Undo and redo are VS Code's own (Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z).
- **Source:** the *Show Source* button in the editor title opens the file as
  JSON text; *Open Canvas* goes back.

File paths in a canvas are relative to the workspace folder that holds it,
as in an Obsidian vault.

## Develop

```sh
npm install
npm run check      # typecheck, unit tests, build
```

Press **F5** in VS Code to start an Extension Development Host with the
`sample` folder open, then open `sample/Welcome.canvas`.

`npm run package` builds a `.vsix` to install with
*Extensions: Install from VSIX…*.

## License

MIT
