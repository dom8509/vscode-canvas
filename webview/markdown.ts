// A small Markdown renderer for card text: enough for notes on a canvas,
// with all text escaped. Links become <a data-href> and are opened by the host.

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** Strips a leading YAML front matter block. */
export function stripFrontMatter(text: string): string {
  const m = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/.exec(text);
  return m ? text.slice(m[0].length) : text;
}

export function renderInline(text: string): string {
  // Code spans first, so nothing inside them is formatted.
  const codes: string[] = [];
  let s = text.replace(/`([^`]+)`/g, (_, code: string) => {
    codes.push(`<code>${escapeHtml(code)}</code>`);
    return `\u0000${codes.length - 1}\u0000`;
  });

  const links: string[] = [];
  const keep = (html: string) => {
    links.push(html);
    return `\u0001${links.length - 1}\u0001`;
  };
  // [[target|alias]] and [[target]]
  s = s.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, target: string, alias?: string) =>
    keep(`<a class="internal-link" data-href="${escapeHtml(target.trim())}">${escapeHtml((alias ?? target).trim())}</a>`),
  );
  // [text](url)
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label: string, url: string) =>
    keep(`<a data-href="${escapeHtml(url)}">${renderEmphasis(escapeHtml(label))}</a>`),
  );
  // Bare URLs.
  s = s.replace(/\bhttps?:\/\/[^\s<>()]+[^\s<>().,;:!?'"]/g, (url) => keep(`<a data-href="${escapeHtml(url)}">${escapeHtml(url)}</a>`));

  s = renderEmphasis(escapeHtml(s));
  s = s.replace(/\u0001(\d+)\u0001/g, (_, i: string) => links[Number(i)]!);
  return s.replace(/\u0000(\d+)\u0000/g, (_, i: string) => codes[Number(i)]!);
}

function renderEmphasis(s: string): string {
  return s
    .replace(/\*\*(?=\S)(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/__(?=\S)(.+?)__/g, "<strong>$1</strong>")
    .replace(/\*(?=\S)(.+?)\*/g, "<em>$1</em>")
    .replace(/(^|[^\w])_(?=\S)(.+?)_(?!\w)/g, "$1<em>$2</em>")
    .replace(/~~(?=\S)(.+?)~~/g, "<del>$1</del>")
    .replace(/==(?=\S)(.+?)==/g, "<mark>$1</mark>");
}

export function renderMarkdown(text: string): string {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const out: string[] = [];
  let paragraph: string[] = [];
  let list: { tag: "ul" | "ol"; items: string[] } | null = null;
  let quote: string[] | null = null;

  const flushParagraph = () => {
    if (paragraph.length) out.push(`<p>${paragraph.map(renderInline).join("<br>")}</p>`);
    paragraph = [];
  };
  const flushList = () => {
    if (list) out.push(`<${list.tag}>${list.items.join("")}</${list.tag}>`);
    list = null;
  };
  const flushQuote = () => {
    if (quote) out.push(`<blockquote>${renderMarkdown(quote.join("\n"))}</blockquote>`);
    quote = null;
  };
  const flushAll = () => {
    flushParagraph();
    flushList();
    flushQuote();
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;

    const fence = /^\s*(```|~~~)\s*([\w-]*)/.exec(line);
    if (fence) {
      flushAll();
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i]!.trim().startsWith(fence[1]!)) code.push(lines[i++]!);
      out.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
      continue;
    }

    const q = /^\s*>\s?(.*)$/.exec(line);
    if (q) {
      flushParagraph();
      flushList();
      (quote ??= []).push(q[1]!);
      continue;
    }
    flushQuote();

    if (line.trim() === "") {
      flushParagraph();
      flushList();
      continue;
    }

    const heading = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
    if (heading) {
      flushAll();
      const level = heading[1]!.length;
      out.push(`<h${level}>${renderInline(heading[2]!)}</h${level}>`);
      continue;
    }

    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
      flushAll();
      out.push("<hr>");
      continue;
    }

    const item = /^\s*([-*+]|\d+[.)])\s+(.*)$/.exec(line);
    if (item) {
      flushParagraph();
      const tag = /\d/.test(item[1]!) ? "ol" : "ul";
      if (list && list.tag !== tag) flushList();
      list ??= { tag, items: [] };
      const task = /^\[([ xX])\]\s+(.*)$/.exec(item[2]!);
      list.items.push(
        task
          ? `<li class="task"><input type="checkbox" disabled${task[1] === " " ? "" : " checked"}> ${renderInline(task[2]!)}</li>`
          : `<li>${renderInline(item[2]!)}</li>`,
      );
      continue;
    }

    flushList();
    paragraph.push(line.trim());
  }
  flushAll();
  return out.join("");
}
