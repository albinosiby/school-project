import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent } from "@testing-library/react";
import { LiveClassesView } from "./LiveClassesView";
import { renderUI, screen, seed, within, writes } from "@/test/render";

const staff = [{ id: "stf_025", name: "Mrs. Anita Sharma", department: "Mathematics" }, { id: "stf_003", name: "Ravi Kumar", department: "Science" }];
const base = { subject: "Mathematics", mins: 40, medium: "Google Meet", link: "https://meet.google.com/abc-defg-hij", status: "upcoming" };
const sessions = [
  { ...base, id: "lc_live", title: "Algebra doubts", classId: "cls_10B", teacherId: "stf_025", date: "2026-11-03", time: "10:00" },
  { ...base, id: "lc_next", title: "Cells revision", classId: "cls_9A", teacherId: "stf_003", date: "2026-11-04", time: "09:00", link: "meet.google.com/XYZ-ABCD-EFG" },
  { ...base, id: "lc_old", title: "Old session", classId: "cls_10B", teacherId: "stf_003", date: "2026-11-01", time: "09:00", link: "https://zoom.us/j/1" },
  { ...base, id: "lc_gone", title: "Deleted session", classId: "cls_10B", teacherId: "stf_025", date: "2026-11-03", time: "12:00", deleted: true, status: "cancelled" },
  { ...base, id: "lc_draft", title: "Draft session", classId: "cls_9A", teacherId: "stf_025", date: "2026-11-05", time: "09:00", status: "draft" },
  { ...base, id: "lc_zoom", title: "Zoom session", classId: "cls_9A", teacherId: "stf_025", date: "2026-11-02", time: "09:00", medium: "Zoom", link: "https://zoom.us/j/edu-cls-9A" },
];
const titles = () => screen.getAllByRole("row").slice(1).map((r) => within(r).queryByText(/session|doubts|revision/)?.textContent ?? r.textContent);
const statValue = (label: string) => screen.getAllByText(label, { selector: "span.text-xs" })[0]!.parentElement!.nextElementSibling!.firstElementChild!.textContent;

function setup() {
  seed({ staff, live_classes: sessions, "live_classes/lc_live/joins": [{ id: "uid_a", joinedAt: "x" }, { id: "uid_b", joinedAt: "y" }] });
  return renderUI(<LiveClassesView />);
}

beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date(2026, 10, 3, 10, 5)); });
afterEach(() => vi.useRealTimers());

describe("Live classes (read-only list)", () => {
  it("hides soft-deleted sessions and derives status from the clock", () => {
    setup();
    expect(titles()).toEqual(["Draft session", "Cells revision", "Algebra doubts", "Zoom session", "Old session"]);
    expect(screen.queryByText("Deleted session")).not.toBeInTheDocument();
    expect(statValue("Sessions")).toBe("5");
    expect(statValue("Live now")).toBe("1");
    expect(statValue("Upcoming")).toBe("1");
    const row = (t: string) => screen.getByText(t).closest("tr") as HTMLElement;
    expect(within(row("Algebra doubts")).getByText("Live")).toBeInTheDocument();
    expect(within(row("Cells revision")).getByText("Upcoming")).toBeInTheDocument();
    expect(within(row("Old session")).getByText("Ended")).toBeInTheDocument();
    expect(within(row("Draft session")).getByText("Draft")).toBeInTheDocument();
    expect(within(row("Algebra doubts")).getByText("2")).toBeInTheDocument(); // joins/{uid} link opens
  });

  it("opens only valid links: Meet sessions need a Meet link (normalised), other media an http(s) link", () => {
    setup();
    expect(screen.getByRole("link", { name: "Open Cells revision (new tab)" })).toHaveAttribute("href", "https://meet.google.com/xyz-abcd-efg");
    const a = screen.getByRole("link", { name: "Open Algebra doubts (new tab)" });
    expect(a).toHaveAttribute("target", "_blank");
    expect(a).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getByRole("link", { name: "Open Zoom session (new tab)" })).toHaveAttribute("href", "https://zoom.us/j/edu-cls-9A");
    expect(screen.queryByRole("link", { name: "Open Old session (new tab)" })).not.toBeInTheDocument();
    expect(within(screen.getByText("Old session").closest("tr")!).getByText("Not a valid Meet link")).toBeInTheDocument();
  });

  it("filters by class, teacher, date and status, and clears", async () => {
    const { user } = setup();
    expect([...screen.getByLabelText("Class").querySelectorAll("option")].map((o) => o.textContent)).toEqual(["All classes", "Grade 9-A", "Grade 10-B"]);
    await user.selectOptions(screen.getByLabelText("Class"), "cls_9A");
    expect(titles()).toEqual(["Draft session", "Cells revision", "Zoom session"]);
    await user.selectOptions(screen.getByLabelText("Teacher"), "stf_003");
    expect(titles()).toEqual(["Cells revision"]);
    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(titles()).toHaveLength(5);

    fireEvent.change(screen.getByLabelText("Date"), { target: { value: "2026-11-03" } });
    expect(titles()).toEqual(["Algebra doubts"]);
    fireEvent.change(screen.getByLabelText("Date"), { target: { value: "" } });

    await user.selectOptions(screen.getByLabelText("Status"), "Ended");
    expect(titles()).toEqual(["Zoom session", "Old session"]);
    await user.selectOptions(screen.getByLabelText("Teacher"), "stf_025");
    expect(titles()).toEqual(["Zoom session"]);
    await user.selectOptions(screen.getByLabelText("Class"), "cls_10B");
    expect(screen.getByText("No sessions match")).toBeInTheDocument();
    expect(writes).toHaveLength(0);
  });
});
