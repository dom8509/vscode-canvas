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
- **Text:** the *T* button (or the **T** key) picks the text tool; click on
  the canvas and type, as in Excalidraw. Free text has no box and grows with
  what you write; the properties panel sets its size (S, M, L, XL) and color.
  Text left empty disappears.
- **Shapes:** the shapes button opens 18 shapes, as in tldraw: rectangle,
  ellipse, triangle, diamond, pentagon, hexagon, octagon, star, rhombus,
  trapezoid, cloud, heart, four arrows, x-box and check-box (**R** picks the
  rectangle, **O** the ellipse). Click on the canvas for a shape of the usual
  size, or drag to draw it. Double-click a shape to write in it. The
  properties panel changes the shape, its fill (none, light, solid), color and
  text size. Shapes and free text are text cards in the file, so Obsidian
  shows them as ordinary cards.
- **Fonts and borders:** for any text card, shape or free text the
  properties panel sets the font (sans serif, serif, monospace or
  handwriting) and the text size (S, M, L, XL). Cards and shapes also get a
  border thickness (thin, normal, bold, extra bold). Connections have four
  line widths too.
- **Turn:** drag the round handle above any selected card, note, link,
  shape or free text to turn it (hold **Shift** for 15° steps). Groups stay
  upright. Connections follow the turned sides. Obsidian shows turned cards
  upright.
- **Notes and media:** the file button in the bottom toolbar adds a file from
  the workspace. Markdown notes show their text, images show the picture.
  You can also drag notes and files onto the canvas — from the Explorer, an
  editor tab or your file manager (hold **Shift** while dropping; VS Code
  needs it). Several files land in a grid; a folder brings the files in it.
  Notes from outside the workspace come in as text cards. A card for
  `Note.md#Heading` (or `#Heading#Subheading`, or a block `#^id`) shows only
  that part of the note, as in Obsidian. Double-click a file card to open the
  file beside the canvas, at that heading.
- **Images:** the image button in the bottom toolbar picks images from
  anywhere on your computer. You can also paste an image (Ctrl/Cmd+V, e.g. a
  screenshot) or drop image files from your file manager. Images from outside
  the workspace are copied into the folder of the canvas first (a pasted one
  is named like `Pasted image 20240131154500.png`, as in Obsidian).
- **Web links:** the link button adds a card for a URL; *Open* opens it in
  the browser. Pasting a URL also makes a link card.
- **Groups:** the group button puts a group around the selected cards (or
  adds an empty one). Moving a group moves the cards inside it. Double-click
  its name to rename it.
- **Connect:** hover a card, then drag one of the dots on its sides onto
  another card. Drop on empty space to make a new card there, connected.
  Double-click a connection to give it a label.
- **Line and arrow styles:** select connections; the properties panel sets
  solid, dashed or dotted lines, thin, normal or bold width, curved, straight
  or right-angled paths, and the shape at each end (none, arrow, open arrow,
  dot, bar, diamond), as in Excalidraw. New connections take the style you
  picked last. Obsidian shows the extra styles as plain lines and arrows.
- **Drawing styles:** the canvas is white paper, and its lines are drawn with
  [Rough.js](https://roughjs.com) in one of Excalidraw's three styles:
  *architect* (clean, technical lines), *artist* (lightly hand-drawn, the
  default) or *cartoonist* (very sketchy). The setting `canvas.drawingStyle`
  sets it for all canvases; the wavy-line button at the top right sets it for
  one canvas (`"style"` at the top of the file); the *Style* row in the
  properties panel sets it for single cards and connections (`"style"` on
  them). The most specific one wins. The data stays the same: only the
  drawing changes, and each element looks the same on every redraw.
- **Properties:** select cards or connections and a panel on the left shows
  their properties, as in Excalidraw and tldraw: one of six colors or a custom one, and
  for connections the line and arrow styles below.
- **Move and resize:** drag cards (they snap to the grid; hold **Alt** to
  move freely); drag any corner or side to resize. Free text
  you make narrower keeps that width and wraps. Arrow keys nudge the
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

## Release

Push a version tag and GitHub builds the release:

```sh
git tag v0.2.0
git push origin v0.2.0
```

The *Release* workflow (`.github/workflows/release.yml`) runs the checks,
packages the extension with the tag's version and attaches the `.vsix` to a
new GitHub release with generated notes. A tag with a dash, like
`v0.3.0-beta.1`, becomes a pre-release.

## License

MIT. The handwriting font, [Caveat](https://github.com/googlefonts/caveat),
is under the SIL Open Font License (`webview/fonts/Caveat-OFL.txt`).
