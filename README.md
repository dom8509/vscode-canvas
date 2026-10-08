# Canvas for VS Code

An infinite canvas for VS Code, modelled on
[Obsidian Canvas](https://obsidian.md/canvas). Lay out cards, notes, images,
web links and groups on a board and connect them with arrows. A canvas is
saved as a [JSON Canvas](https://jsoncanvas.org) `.canvas` file — the same
open format Obsidian uses, so the files work in both.

## Using it

- **Tools:** the bottom toolbar holds the tools, each with its key in the
  corner of its button: select (**V**), hand (**H**: drag to pan), text
  (**T**), shapes (**R** rectangle, **O** ellipse), card (**N**) and group
  (**G**). **Escape** closes an open menu or panel first; otherwise it goes
  back to the select tool, or clears the selection when that is on already. No key fires while you type.
- **Keys:** press **?**, or the *?* button at the top right, for a list of
  every key. **Escape** or the button closes it. An empty canvas says how to
  start.
- **Create a canvas:** run *Canvas: New Canvas* from the Command Palette, or
  right-click a folder in the Explorer. Any `*.canvas` file opens on the canvas.
- **Cards:** the card button in the bottom toolbar adds a card to write in
  (Markdown: headings, lists, tasks, **bold**, *italic*, `code`, links,
  `[[wikilinks]]`). Double-click a card to edit it; Escape or a click outside
  ends editing.
- **Text:** double-click the empty canvas, or pick the text tool (**T**)
  and click; then type, as in Excalidraw. Free text has no box and grows with
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
- **Fonts and borders:** for any text card, note, shape or free text the
  properties panel sets the font (sans serif, serif, monospace or
  handwriting) and the text size (S, M, L, XL). Cards and shapes also get a
  border thickness (thin, normal, bold, extra bold), and so do file cards
  (pictures get the border only). Connections have four
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
- **Light and dark paper:** the canvas follows your VS Code theme: white
  paper with dark ink on a light theme, dark paper with light ink on a dark
  or high-contrast one, and it switches when you switch themes. The setting
  `canvas.theme` (*auto*, *light* or *dark*) fixes it for all canvases. The
  file does not change.
- **Drawing styles:** the lines on the canvas are drawn with
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
  for connections the line and arrow styles below. New cards, shapes and
  free text take the color, fill, font, text size and border you picked
  last, as far as they fit (free text has no fill or border).
- **Align and distribute:** with two or more cards selected, the *Align* row
  in the properties panel lines up their left sides, centers, right sides,
  tops, middles or bottoms. With three or more, two more buttons space them
  out evenly across or down: the outer two stay put. A turned card counts by
  its turned outline. Locked cards stay where they are.
- **Move and resize:** drag cards; drag any corner or side to resize. While
  you drag, an edge or center of a card snaps to the edges and centers of
  the cards nearby, and a thin red guide shows the match; where nothing is
  near, cards snap to the grid. Hold **Alt** to move freely. With two or
  more cards selected, one box with eight handles goes around them: drag a
  handle to scale them all at once (hold **Shift** to keep the box's shape).
  Free text in the selection scales its text with it. Free text
  you make narrower keeps that width and wraps. Arrow keys nudge the
  selection (**Shift**: further); nudges in a quick row undo in one step.
- **Context menu:** right-click a card, group or connection for cut, copy,
  paste, duplicate, delete, the layer order, group selection, lock and zoom
  to selection; right-click the empty canvas for paste, select all and zoom
  to fit. Items that do not apply are greyed out; each shows its key.
- **Layer order:** Ctrl/Cmd+] brings the selected cards one step forward,
  Ctrl/Cmd+[ sends them one step back; add **Shift** to bring them to the
  front or send them to the back. Groups always stay behind the cards. The
  order is the order in the file, so Obsidian shows it the same.
- **Lock:** Ctrl/Cmd+Shift+L, or *Lock* in the properties panel, locks the
  selected cards, groups and connections: they cannot be moved, resized,
  turned, edited, restyled or deleted, and a selection box skips them. Click
  one and press the key again to unlock it. A small lock shows on hover. A
  card with a locked connection stays until you unlock the connection. A
  group you move still carries the locked cards inside it. Copies are not
  locked. Obsidian ignores the lock.
- **Select:** click; Shift-click adds; drag on the empty canvas draws a
  selection box. Ctrl/Cmd+A selects everything that is not locked.
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
