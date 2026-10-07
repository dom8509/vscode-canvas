import { describe, expect, it } from "vitest";
import { imageFileName, isImageFile, uniqueFileName } from "../src/jsonCanvas";

describe("isImageFile", () => {
  it("knows images by type or name", () => {
    expect(isImageFile("image/png")).toBe(true);
    expect(isImageFile("", "photo.JPG")).toBe(true);
    expect(isImageFile("text/plain", "notes.md")).toBe(false);
  });
});

describe("imageFileName", () => {
  const date = new Date(2024, 0, 31, 15, 45, 0);

  it("keeps the name of a named image file", () => {
    expect(imageFileName("image/png", "shot.png", date)).toBe("shot.png");
    expect(imageFileName("", "/home/me/Pictures/cat.jpeg", date)).toBe("cat.jpeg");
  });

  it("names a pasted image as Obsidian does", () => {
    expect(imageFileName("image/png", "", date)).toBe("Pasted image 20240131154500.png");
    expect(imageFileName("image/jpeg", "image", date)).toBe("Pasted image 20240131154500.jpg");
  });
});

describe("uniqueFileName", () => {
  it("counts up until the name is free", () => {
    const taken = new Set(["a.png", "a 1.png"]);
    expect(uniqueFileName("b.png", (n) => taken.has(n))).toBe("b.png");
    expect(uniqueFileName("a.png", (n) => taken.has(n))).toBe("a 2.png");
  });
});
