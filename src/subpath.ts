// Subpaths of a Markdown note, as Obsidian writes them after the file name:
// "#Heading", "#Heading#Subheading" or "#^block-id".
// Shared by the extension host and the webview.

export interface Section {
  /** First line of the section (0-based). */
  start: number;
  /** Line after the section. */
  end: number;
}

interface Heading {
  line: number;
  level: number;
  text: string;
}

const normalize = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();

/** The headings of a note, outside front matter and code blocks. */
function headings(lines: string[]): Heading[] {
  const out: Heading[] = [];
  let i = frontMatterEnd(lines);
  let fence: string | null = null;
  for (; i < lines.length; i++) {
    const line = lines[i]!;
    const f = /^\s*(```|~~~)/.exec(line);
    if (f) {
      if (!fence) fence = f[1]!;
      else if (line.trim().startsWith(fence)) fence = null;
      continue;
    }
    if (fence) continue;
    const m = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
    if (m) out.push({ line: i, level: m[1]!.length, text: normalize(m[2]!) });
  }
  return out;
}

function frontMatterEnd(lines: string[]): number {
  if (lines[0]?.trim() !== "---") return 0;
  for (let i = 1; i < lines.length; i++) if (lines[i]!.trim() === "---") return i + 1;
  return 0;
}

/**
 * The lines a subpath points to, or undefined when the note has no such heading
 * or block. A heading section runs to the next heading of the same or a higher level.
 */
export function findSection(text: string, subpath: string): Section | undefined {
  const lines = text.split(/\r?\n/);
  const parts = subpath.split("#").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return undefined;

  if (parts.length === 1 && parts[0]!.startsWith("^")) return findBlock(lines, parts[0]!.slice(1));

  const all = headings(lines);
  let range: Section = { start: 0, end: lines.length };
  for (const part of parts) {
    const want = normalize(part);
    const index = all.findIndex((h) => h.line >= range.start && h.line < range.end && h.text === want);
    if (index < 0) return undefined;
    const h = all[index]!;
    const next = all.slice(index + 1).find((n) => n.level <= h.level);
    range = { start: h.line, end: Math.min(next ? next.line : lines.length, range.end) };
  }
  return range;
}

/** The paragraph or list item that ends with "^id". */
function findBlock(lines: string[], id: string): Section | undefined {
  const marker = new RegExp(`(^|\\s)\\^${id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`);
  const line = lines.findIndex((l) => marker.test(l));
  if (line < 0) return undefined;
  // A list item stands alone; a paragraph runs back to a blank line, heading, fence or list.
  if (/^\s*([-*+]|\d+[.)])\s/.test(lines[line]!)) return { start: line, end: line + 1 };
  // A marker on its own line belongs to the block above it.
  const end = line + 1;
  let start = lines[line]!.trim().startsWith("^") ? line - 1 : line;
  start = Math.max(0, start);
  while (start > 0 && !/^\s*$|^\s*(#{1,6}\s|```|~~~|---|[-*+]\s|\d+[.)]\s)/.test(lines[start - 1]!)) start--;
  return { start, end };
}

/** The text of a section, without block markers. */
export function sectionText(text: string, subpath: string | undefined): string | undefined {
  if (!subpath) return text;
  const section = findSection(text, subpath);
  if (!section) return undefined;
  return text
    .split(/\r?\n/)
    .slice(section.start, section.end)
    .map((l) => l.replace(/\s\^[\w-]+\s*$/, "").replace(/^\s*\^[\w-]+\s*$/, ""))
    .join("\n")
    .trim();
}
