import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { coalescer } from "../webview/coalesce";

describe("coalescer", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("commits once, 500 ms after the last of several nudges", () => {
    const commit = vi.fn();
    const nudges = coalescer(commit, 500);
    nudges.schedule();
    vi.advanceTimersByTime(200);
    nudges.schedule();
    vi.advanceTimersByTime(200);
    nudges.schedule();
    vi.advanceTimersByTime(499);
    expect(commit).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it("commits at once on a flush, and not again later", () => {
    const commit = vi.fn();
    const nudges = coalescer(commit, 500);
    nudges.schedule();
    nudges.flush();
    expect(commit).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1000);
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it("does nothing on a flush with nothing pending", () => {
    const commit = vi.fn();
    coalescer(commit, 500).flush();
    expect(commit).not.toHaveBeenCalled();
  });

  it("drops a waiting commit on cancel", () => {
    const commit = vi.fn();
    const nudges = coalescer(commit, 500);
    nudges.schedule();
    nudges.cancel();
    vi.advanceTimersByTime(1000);
    nudges.flush();
    expect(commit).not.toHaveBeenCalled();
  });

  it("tells whether a commit is pending", () => {
    const nudges = coalescer(() => undefined, 500);
    expect(nudges.pending()).toBe(false);
    nudges.schedule();
    expect(nudges.pending()).toBe(true);
    nudges.flush();
    expect(nudges.pending()).toBe(false);
  });
});
