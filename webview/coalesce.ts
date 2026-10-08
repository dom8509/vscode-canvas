// Gathers changes that come in a quick row, such as arrow-key nudges, into one commit: one undo step.

export interface Coalescer {
  /** Asks for a commit `delay` ms from now; a new ask before then moves it later. */
  schedule(): void;
  /** Commits now if a commit is waiting. */
  flush(): void;
  /** Drops a waiting commit. */
  cancel(): void;
  pending(): boolean;
}

export function coalescer(commit: () => void, delay: number): Coalescer {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const flush = () => {
    if (timer === undefined) return;
    clearTimeout(timer);
    timer = undefined;
    commit();
  };
  return {
    schedule() {
      if (timer !== undefined) clearTimeout(timer);
      timer = setTimeout(flush, delay);
    },
    flush,
    cancel() {
      clearTimeout(timer);
      timer = undefined;
    },
    pending: () => timer !== undefined,
  };
}
