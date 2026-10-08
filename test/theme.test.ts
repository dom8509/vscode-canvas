import { describe, expect, it } from "vitest";
import { resolveTheme } from "../webview/theme";

describe("resolveTheme", () => {
  it("follows the VS Code theme on auto", () => {
    expect(resolveTheme("auto", "vscode-light")).toBe("light");
    expect(resolveTheme("auto", "vscode-dark")).toBe("dark");
    expect(resolveTheme("auto", "vscode-high-contrast")).toBe("dark");
    expect(resolveTheme("auto", "vscode-high-contrast vscode-high-contrast-light")).toBe("light");
    expect(resolveTheme("auto", "vscode-high-contrast-light")).toBe("light");
  });

  it("takes light or dark whatever the VS Code theme", () => {
    for (const body of ["vscode-light", "vscode-dark", "vscode-high-contrast", "vscode-high-contrast-light"]) {
      expect(resolveTheme("light", body)).toBe("light");
      expect(resolveTheme("dark", body)).toBe("dark");
    }
  });

  it("reads an unknown setting as auto", () => {
    expect(resolveTheme("sepia", "vscode-dark")).toBe("dark");
    expect(resolveTheme(undefined, "vscode-light")).toBe("light");
  });

  it("is light paper when the body names no theme", () => {
    expect(resolveTheme("auto", "")).toBe("light");
  });
});
