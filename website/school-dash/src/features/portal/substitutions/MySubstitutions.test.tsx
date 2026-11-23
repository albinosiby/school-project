import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ADMIN_UID, authState, getRow, renderUI, screen, seed, within, writes } from "@/test/render";
import { MySubstitutions } from "./MySubstitutions";
import { canDecide, groupSubstitutions } from "./logic";

const teacher = () => { authState.user = { id: "uid_t", email: "t@s.in", organizationName: "", schoolId: "sch_test", role: "teacher", staffId: "stf_1", staffRole: "teacher", name: "Anita" }; };
const sub = (date: string, day: string, period: number, classId: string, status: string, extra: Record<string, unknown> = {}) => ({
  id: `sub_${date}_${classId}_${period}`, date, day, period, classId, subject: "Science", absentTeacherId: "stf_2", substituteTeacherId: "stf_1", status,
  topic: "Light", note: "Lab sheet on the desk", createdAt: "2026-11-20T05:00:00.000Z", updatedAt: "2026-11-20T05:00:00.000Z", updatedBy: "admin_uid", ...extra,
});
const subs = [
  sub("2026-11-23", "Mon", 3, "cls_8A", "Assigned"),
  sub("2026-11-25", "Wed", 2, "cls_8B", "Accepted"),
  sub("2026-11-18", "Wed", 4, "cls_8A", "Assigned"),
  sub("2026-11-24", "Tue", 5, "cls_6A", "Assigned", { substituteTeacherId: "stf_9" }),
];
const base = { staff: [{ id: "stf_1", name: "Anita" }, { id: "stf_2", name: "Ravi Kumar" }], ops_substitutions: subs };
const item = (date: string, period: number, label: string) => screen.getByRole("listitem", { name: `Substitution ${date} period ${period} ${label}` });

beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date(2026, 10, 23, 12, 0)); });
afterEach(() => vi.useRealTimers());

describe("substitutions logic", () => {
  it("groups upcoming (soonest first) and past (newest first) duties", () => {
    const mine = subs.filter((s) => s.substituteTeacherId === "stf_1");
    const g = groupSubstitutions(mine as never, "2026-11-23");
    expect(g.upcoming.map((s) => s.id)).toEqual(["sub_2026-11-23_cls_8A_3", "sub_2026-11-25_cls_8B_2"]);
    expect(g.past.map((s) => s.id)).toEqual(["sub_2026-11-18_cls_8A_4"]);
    expect(canDecide(mine[0] as never, "2026-11-23")).toBe(true);
    expect(canDecide(mine[1] as never, "2026-11-23")).toBe(false);
    expect(canDecide(mine[2] as never, "2026-11-23")).toBe(false);
  });
});

describe("Substitutions", () => {
  it("shows own duties grouped and accepts one writing only status (+ updatedAt/updatedBy)", async () => {
    teacher(); seed(base);
    const { user } = renderUI(<MySubstitutions />);
    expect(screen.getByText("1 awaiting your answer")).toBeInTheDocument();
    expect(screen.queryByRole("listitem", { name: /6-A/ })).not.toBeInTheDocument();
    const today = item("2026-11-23", 3, "8-A");
    expect(today).toHaveTextContent("Science · covering Ravi Kumar");
    expect(today).toHaveTextContent("Topic: Light");
    expect(today).toHaveTextContent("Pending");
    expect(within(item("2026-11-25", 2, "8-B")).queryByRole("button")).not.toBeInTheDocument();
    expect(within(item("2026-11-18", 4, "8-A")).queryByRole("button")).not.toBeInTheDocument();
    await user.click(within(today).getByRole("button", { name: "Accept" }));
    expect(writes).toEqual([{ op: "update", coll: "ops_substitutions", id: "sub_2026-11-23_cls_8A_3", data: { status: "Accepted", updatedAt: expect.any(String), updatedBy: ADMIN_UID } }]);
    expect(getRow("ops_substitutions", "sub_2026-11-23_cls_8A_3")).toEqual({ ...subs[0], status: "Accepted", updatedAt: expect.any(String), updatedBy: ADMIN_UID });
    expect(await screen.findByText("Substitution accepted · 8-A P3 on 2026-11-23")).toBeInTheDocument();
    expect(item("2026-11-23", 3, "8-A")).toHaveTextContent("Accepted");
    expect(within(item("2026-11-23", 3, "8-A")).queryByRole("button")).not.toBeInTheDocument();
  });

  it("declines a duty", async () => {
    teacher(); seed(base);
    const { user } = renderUI(<MySubstitutions />);
    await user.click(within(item("2026-11-23", 3, "8-A")).getByRole("button", { name: "Decline" }));
    expect(writes).toHaveLength(1);
    expect(Object.keys(writes[0]!.data!).sort()).toEqual(["status", "updatedAt", "updatedBy"]);
    expect(getRow("ops_substitutions", "sub_2026-11-23_cls_8A_3")).toMatchObject({ status: "Declined", substituteTeacherId: "stf_1" });
  });

  it("tells a non-teaching staff member the page is for teachers", () => {
    authState.user = { ...authState.user!, role: "staff", staffId: "stf_7" };
    renderUI(<MySubstitutions />);
    expect(screen.getByText("Only teachers have substitutions")).toBeInTheDocument();
  });
});
