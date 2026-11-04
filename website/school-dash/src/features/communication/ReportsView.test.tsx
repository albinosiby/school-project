import { describe, expect, it } from "vitest";
import { fireEvent } from "@testing-library/react";
import { ReportsView } from "./ReportsView";
import { dialog, field, fieldError, getRow, renderUI, rowsOf, screen, seed, within, writes, writesTo } from "@/test/render";

const report = { id: "rep_07", kind: "attendance", title: "Student Attendance Register", category: "CBSE Statutory", tag: "Mandatory", desc: "", format: "csv", formats: ["csv"], lastGenerated: "Never", meta: "0 Records" };
const students = [
  { id: "stu_1", name: "Asha", grn: "G-1", grade: "8", section: "A", guardian: "", phone: "", status: "Active", attendance: 0 },
  { id: "stu_2", name: "Ravi", grn: "G-2", grade: "9", section: "B", guardian: "", phone: "", status: "Active", attendance: 0 },
];
const att = [{ id: "2026-11-02_cls_8A_1", date: "2026-11-02", classId: "cls_8A", period: 1, total: 1, marks: { stu_1: "A" }, submitted: true }];

describe("Standard reports", () => {
  it("Run Now: a From after To is rejected before generating", async () => {
    seed({ com_reports: [report], students });
    const { user } = renderUI(<ReportsView />);
    await user.click(screen.getByRole("button", { name: "Run Now" }));
    const d = dialog("Student Attendance Register");
    fireEvent.change(field("From", d), { target: { value: "2026-11-05" } });
    fireEvent.change(field("To", d), { target: { value: "2026-11-01" } });
    expect(fieldError("To", d)).toBe("Must be on or after From");
    expect(within(d).getByRole("button", { name: "Generate Report" })).toBeDisabled();
    expect(writes).toHaveLength(0);
  });

  it("Generate previews real records, adds the export and stamps the report", async () => {
    seed({ com_reports: [report], students, ops_attendance: att });
    const { user } = renderUI(<ReportsView />);
    await user.click(screen.getByRole("button", { name: "Run Now" }));
    const d = dialog("Student Attendance Register");
    await user.selectOptions(field("Grade", d), "8");
    expect(within(field("Section", d)).getAllByRole("option").map((o) => o.textContent)).toEqual(["All", "A"]);
    await user.click(within(d).getByRole("button", { name: "Generate Report" }));
    expect(await screen.findByText("Report generated with 1 records")).toBeInTheDocument();
    expect(within(d).getByText("1 records · showing first 1")).toBeInTheDocument();
    expect(within(d).getByText("Below 75%")).toBeInTheDocument();
    expect(rowsOf("com_exports")[0]).toMatchObject({ reportId: "rep_07", format: "csv", code: "#REP-9843" });
    expect(getRow("com_reports", "rep_07")).toMatchObject({ meta: "1 Records · Grade 8" });
  });

  it("an automated schedule needs a name and recipients", async () => {
    seed({ com_reports: [report] });
    const { user } = renderUI(<ReportsView />);
    await user.click(screen.getByRole("button", { name: /Add Automated Schedule/ }));
    const d = dialog("Add Automated Schedule");
    await user.click(within(d).getByRole("button", { name: "Add Schedule" }));
    expect(fieldError("Recipients", d)).toBe("Name and recipients are required");
    expect(writes).toHaveLength(0);
    await user.type(field("Report name", d), " Weekly attendance ");
    await user.type(field("Recipients", d), "principal@school.test");
    await user.click(within(d).getByRole("button", { name: "Add Schedule" }));
    expect(await screen.findByText("Schedule added")).toBeInTheDocument();
    expect(writesTo("com_schedules")[0]!.data).toMatchObject({ title: "Weekly attendance", to: "principal@school.test", when: "Every Monday · 08:00 IST", active: true });
  });
});
