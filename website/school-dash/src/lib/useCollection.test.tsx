import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderUI, screen } from "@/test/render";

const watches = vi.hoisted(() => [] as { path: string; filters?: unknown[]; next: (snapshot: unknown) => void; error: (error: { code: string }) => void; stop: ReturnType<typeof vi.fn> }[]);
vi.unmock("@/lib/useCollection");
vi.mock("firebase/firestore", async () => {
  const fake = await import("@/test/fakeFirestore");
  return { ...fake, onSnapshot: vi.fn((ref: { segs?: string[]; col?: { segs: string[] }; cons?: unknown[] }, next: (snapshot: unknown) => void, error: (error: { code: string }) => void) => {
    const stop = vi.fn();
    watches.push({ path: (ref.segs || ref.col?.segs || []).join("/"), filters: ref.cons, next, error, stop });
    return stop;
  }) };
});
import { CollectionGuard } from "@/components/CollectionGuard";
import { setCollectionScope, useCollection } from "./useCollection";

function Reader({ name = "students" }: { name?: string }) {
  const source = useCollection<{ id: string; name: string }>(name);
  return <p>{source.rows.length} {name}{source.rows.map((row) => ` · ${row.name}`)}</p>;
}
const snapshot = (rows: { id: string; name: string }[]) => ({ docs: rows.map((row) => ({ id: row.id, data: () => row })) });
beforeEach(() => { setCollectionScope(null); watches.length = 0; setCollectionScope("school_A"); });

describe("Shared school collection store", () => {
  it("keeps loading and read failures separate from an empty collection and retries the failed listener", async () => {
    const { user } = renderUI(<CollectionGuard><Reader /></CollectionGuard>);
    expect(screen.getByRole("status")).toHaveTextContent("Loading school data");
    expect(screen.getByText("0 students")).not.toBeVisible();
    act(() => watches[0].error({ code: "permission-denied" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Your account does not have permission");
    expect(screen.getByText("0 students")).not.toBeVisible();
    await user.click(screen.getByRole("button", { name: "Retry loading" }));
    expect(watches[0].stop).toHaveBeenCalledOnce();
    expect(watches).toHaveLength(2);
    act(() => watches[1].next(snapshot([{ id: "one", name: "Loaded student" }])));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByText("1 students · Loaded student")).toBeVisible();
  });
  it("shares a listener while readers are mounted and releases it when the final reader leaves", () => {
    const view = render(<><Reader /><Reader /></>);
    expect(watches).toHaveLength(1);
    view.rerender(<><Reader /></>);
    expect(watches[0].stop).not.toHaveBeenCalled();
    view.unmount();
    expect(watches[0].stop).toHaveBeenCalledOnce();
  });
  it("ignores late snapshots and failures from a previous school", () => {
    renderUI(<CollectionGuard><Reader /></CollectionGuard>);
    const old = watches[0];
    act(() => setCollectionScope("school_B"));
    expect(old.stop).toHaveBeenCalledOnce();
    expect(watches[1].path).toContain("school_B");
    act(() => watches[1].next(snapshot([{ id: "current", name: "Current school" }])));
    act(() => { old.next(snapshot([{ id: "old", name: "Previous school" }])); old.error({ code: "permission-denied" }); });
    expect(screen.getByText("1 students · Current school")).toBeVisible();
    expect(screen.queryByText(/Previous school/)).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
  it("preserves cached rows after a listener failure while hiding stale values", () => {
    renderUI(<CollectionGuard><Reader /></CollectionGuard>);
    act(() => watches[0].next(snapshot([{ id: "one", name: "Cached student" }])));
    expect(screen.getByText("1 students · Cached student")).toBeVisible();
    act(() => watches[0].error({ code: "unavailable" }));
    expect(screen.getByText("1 students · Cached student")).not.toBeVisible();
    expect(screen.getByRole("alert")).toHaveTextContent("Could not load this data");
  });
});


describe("Scoped collection queries", () => {
  it("keeps different dates separate and releases the previous date query", () => {
    function Daily({date}:{date:string}) { const source=useCollection<{id:string;name:string}>("ops_attendance",true,[["date","==",date]]);return <p>{source.rows.map(row=>row.name).join(",")}</p>; }
    const view=render(<Daily date="2026-11-11"/>);
    expect(watches[0].filters).toEqual([{kind:"where",field:"date",op:"==",value:"2026-11-11"}]);
    act(()=>watches[0].next(snapshot([{id:"old",name:"Previous day"}])));
    view.rerender(<Daily date="2026-11-12"/>);
    expect(watches[0].stop).toHaveBeenCalledOnce();
    expect(watches[1].filters).toEqual([{kind:"where",field:"date",op:"==",value:"2026-11-12"}]);
    act(()=>watches[0].next(snapshot([{id:"late",name:"Late stale result"}])));
    act(()=>watches[1].next(snapshot([{id:"current",name:"Current day"}])));
    expect(screen.getByText("Current day")).toBeInTheDocument();expect(screen.queryByText("Previous day")).not.toBeInTheDocument();
    view.unmount();expect(watches[1].stop).toHaveBeenCalledOnce();
  });
});
