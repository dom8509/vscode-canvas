import { describe, expect, it } from "vitest";
import type { CanvasData } from "../src/jsonCanvas";
import { mimeOf } from "../src/jsonCanvas";
import { exportItems, inlineUrls, paperVariables, svgDocument } from "../webview/export";

const css = `
#viewport { color: red; }
#viewport[data-paper="light"] {
  --card-bg: #ffffff;
  --edge: #1e1e1e;
}
#viewport[data-paper="dark"] {
  --card-bg: #1b1b1f;
}
@font-face {
  font-family: "Caveat";
  src: url("fonts/caveat-400.woff2") format("woff2");
}
.x { background: url(fonts/caveat-700.woff2); }
`;

describe("paperVariables", () => {
  it("gives the variables of the chosen paper", () => {
    expect(paperVariables(css, "light")).toBe("--card-bg: #ffffff; --edge: #1e1e1e;");
    expect(paperVariables(css, "dark")).toBe("--card-bg: #1b1b1f;");
  });
});

describe("inlineUrls", () => {
  it("puts data URIs in place of the font files, quoted or not", () => {
    const out = inlineUrls(css, { "fonts/caveat-400.woff2": "data:font/woff2;base64,AAA", "fonts/caveat-700.woff2": "data:font/woff2;base64,BBB" });
    expect(out).toContain('src: url("data:font/woff2;base64,AAA") format("woff2");');
    expect(out).toContain('background: url("data:font/woff2;base64,BBB");');
    expect(out).not.toContain("fonts/caveat");
  });
});

describe("mimeOf", () => {
  it("knows images and fonts by their extension", () => {
    expect(mimeOf("a/b.PNG")).toBe("image/png");
    expect(mimeOf("x.jpg")).toBe("image/jpeg");
    expect(mimeOf("x.svg")).toBe("image/svg+xml");
    expect(mimeOf("fonts/caveat-400.woff2")).toBe("font/woff2");
    expect(mimeOf("x.bin")).toBe("application/octet-stream");
  });
});

describe("exportItems", () => {
  const card = (id: string, x: number, more = {}) => ({ id, type: "text" as const, text: "", x, y: 0, width: 50, height: 50, ...more });
  const data: CanvasData = {
    nodes: [
      { id: "g", type: "group", x: -10, y: -10, width: 200, height: 100 },
      card("a", 0),
      card("b", 100),
      card("c", 500),
      card("p", 900, { shape: "point", width: 1, height: 1 }),
    ],
    edges: [
      { id: "ab", fromNode: "a", toNode: "b" },
      { id: "cp", fromNode: "c", toNode: "p" },
      { id: "bc", fromNode: "b", toNode: "c" },
    ],
  };
  const ids = (x: { nodes: { id: string }[]; edges: { id: string }[] }) => [x.nodes.map((n) => n.id), x.edges.map((e) => e.id)];

  it("holds every card and connection when nothing is selected, never a point", () => {
    expect(ids(exportItems(data, new Set()))).toEqual([["g", "a", "b", "c"], ["ab", "cp", "bc"]]);
  });

  it("holds the selection, the cards in a selected group, and the connections between them", () => {
    expect(ids(exportItems(data, new Set(["g"])))).toEqual([["g", "a", "b"], ["ab"]]);
    expect(ids(exportItems(data, new Set(["c", "cp"])))).toEqual([["c"], ["cp"]]);
  });
});

describe("svgDocument", () => {
  it("is a standalone SVG of the bounds, with its style and an optional background", () => {
    const svg = svgDocument({ width: 200, height: 100, style: ".a{}", background: "#fff", body: "<div></div>" });
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100" viewBox="0 0 200 100">')).toBe(true);
    expect(svg).toContain("<style>.a{}</style>");
    expect(svg).toContain('<rect width="200" height="100" fill="#fff"/>');
    expect(svg).toContain('<foreignObject x="0" y="0" width="200" height="100"><div></div></foreignObject>');
    expect(svgDocument({ width: 1, height: 1, style: "", background: undefined, body: "" })).not.toContain("<rect");
  });
});
