import { describe, expect, it } from "vitest";
import { findSection, sectionText } from "../src/subpath";

const note = [
  "---",
  "# not a heading: front matter",
  "---",
  "# Title",
  "Intro",
  "## Plan",
  "Step one",
  "```",
  "# not a heading: code",
  "```",
  "### Details",
  "Fine print",
  "## Notes",
  "A paragraph",
  "that ends here ^para",
  "",
  "- item one",
  "- item two ^item",
].join("\n");

describe("findSection", () => {
  it("runs from a heading to the next one of the same level", () => {
    expect(findSection(note, "#Plan")).toEqual({ start: 5, end: 12 });
  });

  it("matches headings loosely and skips front matter and code", () => {
    expect(findSection(note, "#  details ")).toEqual({ start: 10, end: 12 });
    expect(findSection(note, "#not a heading: code")).toBeUndefined();
    expect(findSection(note, "#not a heading: front matter")).toBeUndefined();
  });

  it("follows nested headings", () => {
    expect(findSection(note, "#Title#Plan#Details")).toEqual({ start: 10, end: 12 });
    expect(findSection(note, "#Notes#Details")).toBeUndefined();
  });

  it("finds blocks", () => {
    expect(findSection(note, "#^para")).toEqual({ start: 13, end: 15 });
    expect(findSection(note, "#^item")).toEqual({ start: 17, end: 18 });
    expect(findSection(note, "#^nope")).toBeUndefined();
  });
});

describe("sectionText", () => {
  it("gives the whole text without a subpath", () => {
    expect(sectionText("abc", undefined)).toBe("abc");
  });

  it("gives the section, without block markers", () => {
    expect(sectionText(note, "#Details")).toBe("### Details\nFine print");
    expect(sectionText(note, "#^para")).toBe("A paragraph\nthat ends here");
    expect(sectionText(note, "#Missing")).toBeUndefined();
  });
});
