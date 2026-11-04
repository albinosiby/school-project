// Shared helpers of the Staff & HR / Settings tests (on top of @/test/render).
import { waitFor } from "@testing-library/react";
import { writes } from "@/test/render";

export * from "@/test/render";

/** Waits until at least `n` writes happened (effects such as mirror backfills run after render). */
export const waitForWrites = (n: number) => waitFor(() => { if (writes.length < n) throw new Error(`${writes.length} writes`); });
