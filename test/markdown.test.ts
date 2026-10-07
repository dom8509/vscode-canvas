import { describe, expect, it } from "vitest";
import { renderInline, renderMarkdown, stripFrontMatter } from "../webview/markdown";

describe("markdown", () => {
  it("escapes HTML", () => {
    expect(renderMarkdown("<script>alert(1)</script>")).toBe("<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>");
  });

  it("renders headings, lists and tasks", () => {
    expect(renderMarkdown("# Title")).toBe("<h1>Title</h1>");
    expect(renderMarkdown("- a\n- b")).toBe("<ul><li>a</li><li>b</li></ul>");
    expect(renderMarkdown("1. a\n2. b")).toBe("<ol><li>a</li><li>b</li></ol>");
    expect(renderMarkdown("- [x] done")).toContain("checked");
  });

  it("renders inline formatting", () => {
    expect(renderInline("**b** *i* ~~s~~ ==m== `c*`")).toBe(
      "<strong>b</strong> <em>i</em> <del>s</del> <mark>m</mark> <code>c*</code>",
    );
  });

  it("renders links and wikilinks with escaped targets", () => {
    expect(renderInline("[x](https://a.b)")).toBe('<a data-href="https://a.b">x</a>');
    expect(renderInline("[[Note|alias]]")).toBe('<a class="internal-link" data-href="Note">alias</a>');
    expect(renderInline('[x](javascript:"a")')).toContain('data-href="javascript:&quot;a&quot;"');
    expect(renderInline("see https://a.b/c_d_e.")).toBe('see <a data-href="https://a.b/c_d_e">https://a.b/c_d_e</a>.');
  });

  it("keeps code blocks verbatim", () => {
    expect(renderMarkdown("```\n<b>*x*</b>\n```")).toBe("<pre><code>&lt;b&gt;*x*&lt;/b&gt;</code></pre>");
  });

  it("strips front matter", () => {
    expect(stripFrontMatter("---\na: 1\n---\nBody")).toBe("Body");
    expect(stripFrontMatter("Body")).toBe("Body");
  });
});
