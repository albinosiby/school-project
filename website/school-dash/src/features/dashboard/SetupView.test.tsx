import { describe, expect, it } from "vitest";
import { SetupView } from "./SetupView";
import { TODAY } from "./data";
import { getRow, renderUI, screen, seed, within, writesTo } from "@/test/render";

const titles = ["School Profile", "Terms & Semesters", "Classes & Sections", "Bell Schedule", "Fee Structure", "Staff Allocations", "Data Sync & Ingestion", "Portal & App Gateway"];
const steps = (doneUpTo: number) => titles.map((title, i) => ({ id: `step_${i + 1}`, no: i + 1, title, short: title, desc: "", done: i < doneUpTo, doneAt: i < doneUpTo ? "2026-10-01" : "" }));
const good = { id: "stu_1", name: "Asha Rao", grn: "GRN-1", grade: "8", section: "A", classId: "cls_8A", guardian: "Mr. Rao", phone: "+91 98100 00001", status: "Active" };
const bad = { id: "stu_2", name: "Ravi Kumar", grn: "GRN-2", grade: "8", section: "A", classId: "cls_8A", guardian: "Mrs. Kumar", phone: "98100", status: "Active" };
const legacy = { id: "exc_1", name: "Aarav Khurana", guardian: "Rajesh", grade: "IX-A", grn: "GRN-8921", status: "UID Mismatch", tone: "danger", kind: "uid", issue: "Aadhaar DOB mismatch", action: "Resolve UID", resolved: false };
const card = (phase: number) => screen.getByText(`PHASE ${String(phase).padStart(2, "0")}`).closest("div.relative") as HTMLElement;

describe("Setup wizard: flagged records", () => {
  it("lists the student data problems derived from the roster with a link to fix them", () => {
    seed({ setup_steps: steps(0), students: [good, bad] });
    renderUI(<SetupView />);
    const row = screen.getByText("Ravi Kumar").closest("tr") as HTMLElement;
    expect(within(row).getByText("Guardian phone has only 5 digits")).toBeInTheDocument();
    expect(within(row).getByRole("link")).toHaveAttribute("href", "/students?q=Ravi%20Kumar");
    expect(screen.queryByText("Asha Rao")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardian Contact (1)" })).toBeInTheDocument();
  });

  it("a stored (imported) exception is resolved in setup_exceptions", async () => {
    seed({ setup_steps: steps(0), students: [good], setup_exceptions: [legacy] });
    const { user } = renderUI(<SetupView />);
    await user.click(screen.getByRole("button", { name: "Resolve UID" }));
    expect(await screen.findByText("Aarav Khurana: uid mismatch resolved")).toBeInTheDocument();
    expect(writesTo("setup_exceptions")).toEqual([expect.objectContaining({ op: "update", id: "exc_1", data: expect.objectContaining({ resolved: true }) })]);
  });
});

describe("Setup wizard: completing phases", () => {
  it("open exceptions do not block an early phase", async () => {
    seed({ setup_steps: steps(0), students: [bad] });
    const { user } = renderUI(<SetupView />);
    await user.click(within(card(1)).getByRole("button", { name: "Mark complete" }));
    expect(await screen.findByText("Phase 1 marked complete")).toBeInTheDocument();
    expect(getRow("setup_steps", "step_1")).toMatchObject({ done: true, doneAt: TODAY });
    expect(writesTo("notifications")[0]!.data).toMatchObject({ category: "statutory", href: "/setup", read: false });
  });

  it("finishes at staff allocations even with flagged records and retired steps stored", async () => {
    seed({ setup_steps: steps(5), students: [bad], setup_exceptions: [legacy] });
    const { user } = renderUI(<SetupView />);
    expect(screen.queryByText("Data Sync & Ingestion")).not.toBeInTheDocument();
    expect(screen.queryByText("Portal & App Gateway")).not.toBeInTheDocument();
    await user.click(within(card(6)).getByRole("button", { name: "Mark complete" }));
    expect(await screen.findByText("6 of 6 phases complete · 100%")).toBeInTheDocument();
    await user.click(within(card(6)).getByRole("button", { name: /Reopen/ }));
    expect(await screen.findByText("Phase 6 reopened")).toBeInTheDocument();
    expect(getRow("setup_steps", "step_6")).toMatchObject({ done: false, doneAt: "" });
  });
});
