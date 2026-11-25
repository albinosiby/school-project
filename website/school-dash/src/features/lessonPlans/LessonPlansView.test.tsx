import { describe, expect, it } from "vitest";
import { LessonPlansView } from "./LessonPlansView";
import { getRow, renderUI, screen, seed, within } from "@/test/render";

const plan = (id: string, state: string, title: string) => ({
  id, teacherId: "stf_1", title, cls: "10-B", subject: "Mathematics", chapter: "NCERT Ch 4", outcomes: ["Solve by factoring"], sessionCount: 2, taughtCount: 1,
  sessions: [{ id: "s1", date: "2026-11-20", slot: "P2", focus: "Factoring", status: "taught", note: "Went well" }, { id: "s2", date: "2026-11-24", slot: "P4", focus: "Formula", status: "planned" }],
  review: { state, note: "", submittedAt: "2026-11-25T08:00:00.000Z" },
});

describe("Lesson plan review", () => {
  it("lists plans sent for review and approves one", async () => {
    seed({ ls_plans: [plan("lp_1", "submitted", "Quadratic Equations"), plan("lp_2", "none", "Private draft"), plan("lp_3", "approved", "Circles")],
      staff: [{ id: "stf_1", name: "Fathima Beevi" }], me: [{ id: "me", name: "Dr. Rao", title: "Principal" }] });
    const { user } = renderUI(<LessonPlansView />);
    expect(await screen.findByText("Quadratic Equations")).toBeInTheDocument();
    expect(screen.queryByText("Private draft")).not.toBeInTheDocument();
    expect(screen.queryByText("Circles")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Quadratic Equations/ }));
    const d = screen.getByRole("dialog", { name: "Lesson plan" });
    expect(within(d).getByText("Factoring")).toBeInTheDocument();
    expect(within(d).getByText("“Went well”")).toBeInTheDocument();
    await user.click(within(d).getByRole("button", { name: "Approve" }));
    await expect.poll(() => getRow("ls_plans", "lp_1")).toMatchObject({ review: { state: "approved", by: "Dr. Rao (Principal)", submittedAt: "2026-11-25T08:00:00.000Z" } });
  });

  it("asking for changes needs a note", async () => {
    seed({ ls_plans: [plan("lp_1", "submitted", "Quadratic Equations")], staff: [], me: [{ id: "me", name: "Dr. Rao" }] });
    const { user } = renderUI(<LessonPlansView />);
    await user.click(await screen.findByRole("button", { name: /Quadratic Equations/ }));
    const d = screen.getByRole("dialog", { name: "Lesson plan" });
    await user.click(within(d).getByRole("button", { name: "Ask for changes" }));
    expect(await screen.findByText("Write what should change")).toBeInTheDocument();
    await user.type(within(d).getByLabelText("Review note"), "Add an activity on inertia");
    await user.click(within(d).getByRole("button", { name: "Ask for changes" }));
    await expect.poll(() => getRow("ls_plans", "lp_1")).toMatchObject({ review: { state: "changes", note: "Add an activity on inertia" } });
  });
});
