import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FeesPage } from "./FeesPage";
import { dialog, failNextWrite, field, fieldError, getRow, renderUI, rowsOf, screen, seed, within, writes, writesTo } from "@/test/render";

const invoice = (p: Record<string, unknown> = {}) => ({
  id: "inv_1", no: "INV-2026-0901", student: "Aarav Sharma", grade: "10", section: "B", grn: "GIS-9200", guardian: "Mr. Rahul Sharma", phone: "+91 98100 00001",
  term: "Term 2", issued: "2026-10-10", due: "2026-11-15", amount: 42000, paid: 12000, balance: 30000, status: "Partial",
  lines: [{ label: "Tuition", amount: 36000 }, { label: "Lab", amount: 6000 }], ...p,
});
const student = { id: "stu_101", name: "Aarav Sharma", grn: "GIS-9200", grade: "10", section: "B", guardian: "Mr. Rahul Sharma", phone: "+91 98100 00001", status: "Active" };

beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date(2026, 10, 3, 10, 0)); });
afterEach(() => { vi.useRealTimers(); });

async function pick(user: ReturnType<typeof renderUI>["user"], name = "Aarav Sharma") {
  await user.click(screen.getAllByText(name)[0]);
}

describe("Invoice status", () => {
  it("shows an unpaid invoice past its due date as Overdue even when stored as Pending", () => {
    seed({ fee_invoices: [invoice({ due: "2026-10-31", paid: 0, balance: 42000, status: "Pending" })] });
    renderUI(<FeesPage />);
    expect(screen.getByText("Overdue Defaulters").parentElement).toHaveTextContent("1 Students");
    expect(screen.getAllByText("Overdue").length).toBeGreaterThan(0);
  });
});

describe("Counter payment", () => {
  it("refuses an empty amount and a missing reference for a non-cash mode", async () => {
    seed({ fee_invoices: [invoice()] });
    const { user } = renderUI(<FeesPage />);
    await pick(user);
    await user.clear(field("Amount Received (₹)"));
    await user.click(screen.getByRole("button", { name: /Collect & Print Receipt/ }));
    expect(fieldError("Amount Received (₹)")).toBe("Enter an amount above ₹0");
    expect(fieldError("Reference no.")).toBe("Enter the transaction / cheque reference (at least 4 characters)");
    expect(writes).toHaveLength(0);
  });

  it("refuses more than the balance", async () => {
    seed({ fee_invoices: [invoice()] });
    const { user } = renderUI(<FeesPage />);
    await pick(user);
    await user.clear(field("Amount Received (₹)"));
    await user.type(field("Amount Received (₹)"), "30001");
    expect(fieldError("Amount Received (₹)")).toBe("Amount exceeds the due balance of ₹30,000");
    await user.type(field("Reference no."), "UTR12345");
    await user.click(screen.getByRole("button", { name: /Collect & Print Receipt/ }));
    expect(writes).toHaveLength(0);
  });

  it("records a UPI part payment: receipt with {mode} · {reference}, invoice paid / balance / status in one batch", async () => {
    seed({ fee_invoices: [invoice()], fee_payments: [{ id: "rcp_1", receiptNo: "RCP-20455", invoiceId: "inv_x", amount: 1, mode: "Cash", date: "2026-10-01" }] });
    const { user } = renderUI(<FeesPage />);
    await pick(user);
    await user.clear(field("Amount Received (₹)"));
    await user.type(field("Amount Received (₹)"), "10000");
    await user.type(field("Reference no."), "utr 4417");
    await user.click(screen.getByRole("button", { name: /Collect & Print Receipt/ }));
    expect(await screen.findByText("Payment of ₹10,000 recorded · RCP-20456")).toBeInTheDocument();
    const p = rowsOf<Record<string, unknown>>("fee_payments").find((payment) => payment.invoiceId === "inv_1");
    expect(p).toMatchObject({ receiptNo: "RCP-20456", invoiceId: "inv_1", invoiceNo: "INV-2026-0901", student: "Aarav Sharma", grade: "10", grn: "GIS-9200", amount: 10000, mode: "UPI QR · UTR4417", reference: "UTR4417", date: "2026-11-03" });
    expect(getRow("fee_invoices", "inv_1")).toMatchObject({ paid: 22000, balance: 20000, status: "Partial" });
    expect(await screen.findByText("Payment of ₹10,000 recorded · RCP-20456")).toBeInTheDocument();
    expect(dialog("Fee Receipt")).toHaveTextContent("RCP-20456");
  });

  it("writes neither the receipt nor the invoice when the batch fails", async () => {
    seed({ fee_invoices: [invoice()] });
    const { user } = renderUI(<FeesPage />);
    await pick(user);
    await user.click(screen.getByRole("tab", { name: "Cash" }));
    failNextWrite();
    await user.click(screen.getByRole("button", { name: /Collect & Print Receipt/ }));
    expect(await screen.findByText("Could not confirm the payment. Retry to check its receipt without recording it twice.")).toBeInTheDocument();
    expect(writes).toHaveLength(0);
    expect(getRow("fee_invoices", "inv_1")).toMatchObject({ paid: 12000, balance: 30000 });
  });

  it("records cash without a reference and settles the invoice", async () => {
    seed({ fee_invoices: [invoice()] });
    const { user } = renderUI(<FeesPage />);
    await pick(user);
    await user.click(screen.getByRole("tab", { name: "Cash" }));
    expect(screen.queryByText("Reference no.")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Collect & Print Receipt/ }));
    expect(rowsOf("fee_payments")[0]).toMatchObject({ amount: 30000, mode: "Cash" });
    expect(rowsOf("fee_payments")[0]).not.toHaveProperty("reference");
    expect(getRow("fee_invoices", "inv_1")).toMatchObject({ paid: 42000, balance: 0, status: "Paid" });
  });
});

describe("New invoice", () => {
  it("requires a student, a whole amount above 0 and a due date", async () => {
    seed({ students: [student] });
    const { user } = renderUI(<FeesPage />);
    await user.click(screen.getByRole("button", { name: /New Invoice/ }));
    const d = dialog("New invoice");
    await user.click(within(d).getByRole("button", { name: "Create invoice" }));
    expect(fieldError("Student", d)).toBe("Choose a student");
    expect(fieldError("Amount (₹)", d)).toBe("Enter a whole rupee amount above 0");
    expect(fieldError("Due date", d)).toBe("Pick the due date");
    await user.type(field("Amount (₹)", d), "0");
    await user.click(within(d).getByRole("button", { name: "Create invoice" }));
    expect(fieldError("Amount (₹)", d)).toBe("Enter a whole rupee amount above 0");
    expect(writes).toHaveLength(0);
  });

  it("refuses a due date in the past", async () => {
    seed({ students: [student] });
    const { user } = renderUI(<FeesPage />);
    await user.click(screen.getByRole("button", { name: /New Invoice/ }));
    const d = dialog("New invoice");
    await user.selectOptions(field("Student", d), "stu_101");
    await user.type(field("Amount (₹)", d), "2500");
    await user.type(field("Due date", d), "2026-11-01");
    await user.click(within(d).getByRole("button", { name: "Create invoice" }));
    expect(fieldError("Due date", d)).toBe("The due date cannot be before today");
    expect(writes).toHaveLength(0);
  });

  it("creates the invoice matched to the student's grn", async () => {
    seed({ students: [student], fee_invoices: [invoice({ no: "INV-2026-0910" })] });
    const { user } = renderUI(<FeesPage />);
    await user.click(screen.getByRole("button", { name: /New Invoice/ }));
    const d = dialog("New invoice");
    await user.selectOptions(field("Student", d), "stu_101");
    await user.clear(field("Fee head", d));
    await user.type(field("Fee head", d), "Science trip");
    await user.type(field("Amount (₹)", d), "2500");
    await user.type(field("Due date", d), "2026-11-30");
    await user.click(within(d).getByRole("button", { name: "Create invoice" }));
    expect(writesTo("fee_invoices")).toHaveLength(1);
    expect(rowsOf("fee_invoices")[0]).toMatchObject({
      no: "INV-2026-0911", studentId: "stu_101", student: "Aarav Sharma", grade: "10", section: "B", grn: "GIS-9200", guardian: "Mr. Rahul Sharma", term: "Term 2",
      issued: "2026-11-03", due: "2026-11-30", amount: 2500, paid: 0, balance: 2500, status: "Pending", lines: [{ label: "Science trip", amount: 2500 }],
    });
    expect(await screen.findByText("Invoice INV-2026-0911 created for Aarav Sharma")).toBeInTheDocument();
  });
});

describe("Reminders", () => {
  it("writes one fee_reminders row per outstanding invoice, once a day", async () => {
    seed({ fee_invoices: [invoice()] });
    const { user } = renderUI(<FeesPage />);
    await user.click(screen.getByRole("button", { name: /Remind/ }));
    expect(writesTo("fee_reminders")).toHaveLength(1);
    expect(rowsOf("fee_reminders")[0]).toMatchObject({
      invoiceId: "inv_1", invoiceNo: "INV-2026-0901", student: "Aarav Sharma", grn: "GIS-9200", guardian: "Mr. Rahul Sharma", phone: "+91 98100 00001", channel: "Parent app",
      amount: 30000, due: "2026-11-15", message: "Dear Mr. Rahul Sharma, fee of ₹30,000 for Aarav Sharma (INV-2026-0901) is due on 15 Nov 2026.",
    });
    expect(await screen.findByText("Reminder sent to 1 guardian in the parent app")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Remind/ }));
    expect(await screen.findByText("Already reminded today")).toBeInTheDocument();
    expect(writesTo("fee_reminders")).toHaveLength(1);
  });
});

describe("Fee structure", () => {
  it("adds a configured senior stream after setup without colliding with its sibling stream", async () => {
    seed({ classes: [{ id: "cls_11_science_A", grade: "11", section: "A", streamId: "science" }, { id: "cls_11_commerce_A", grade: "11", section: "A", streamId: "commerce" }], fee_structure: [{ id: "fs_11_science", grade: "11", streamId: "science", tuition: 3000, lab: 0, activity: 0, library: 0, transport: 0 }] });
    const { user } = renderUI(<FeesPage />);
    await user.click(screen.getByRole("tab", { name: "Fee Structure" }));
    await user.click(screen.getByRole("button", { name: /Add grade/ }));
    expect(within(field("Grade")).queryByRole("option", { name: "Grade 11 · Science" })).not.toBeInTheDocument();
    await user.selectOptions(field("Grade"), "11:commerce");
    const modal = dialog("Add Grade 11 · Commerce fee structure");
    await user.type(field("Academic year", modal), "2026-27");
    await user.click(within(modal).getByRole("button", { name: "Tuition" }));
    await user.type(field("Amount per collection (₹)", modal), "2200");
    await user.click(within(modal).getByRole("button", { name: "Save" }));
    expect(getRow("fee_structure", "fs_11_commerce")).toMatchObject({ grade: "11", streamId: "commerce", schemaVersion: 2, items: [expect.objectContaining({ amount: 2200, grades: ["11:commerce"] })] });
    expect(getRow("fee_structure", "fs_11_science")).toMatchObject({ tuition: 3000 });
  });

  it("adds a grade's structure as fs_{grade}", async () => {
    const { user } = renderUI(<FeesPage />);
    await user.click(screen.getByRole("tab", { name: "Fee Structure" }));
    await user.click(screen.getByRole("button", { name: /Add grade/ }));
    const d = dialog("Add a grade fee structure");
    expect(within(d).getByRole("button", { name: "Save" })).toBeDisabled();
    await user.selectOptions(field("Grade", d), "7");
    await user.clear(field("Tuition", d));
    await user.type(field("Tuition", d), "24000");
    await user.click(within(d).getByRole("button", { name: "Save" }));
    expect(getRow("fee_structure", "fs_7")).toMatchObject({ grade: "7", tuition: 24000, lab: 0 });
  });

  it("shows and edits configured fee items without reverting to the old fixed heads", async () => {
    seed({ fee_structure: [{ id: "fs_10", grade: "10", schemaVersion: 2, academicYear: "2026-27", termsPerYear: 2, tuition: 0, lab: 0, activity: 0, library: 0, transport: 0, items: [
      { id: "tuition", name: "Tuition", amount: 2000, grades: ["10"], frequency: "Monthly", dueDate: "2026-11-10", mandatory: true, newStudentsOnly: false },
    ] }] });
    const { user } = renderUI(<FeesPage />);
    await user.click(screen.getByRole("tab", { name: "Fee Structure" }));
    expect(screen.getByText("Recurring / year")).toBeInTheDocument();
    expect(screen.getByText("₹24,000")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Edit" }));
    const modal = dialog("Edit Grade 10 fee structure");
    await user.click(within(modal).getByRole("button", { name: /^Expand fee item 1:/ }));
    await user.clear(field("Amount per collection (₹)", modal));
    await user.type(field("Amount per collection (₹)", modal), "2200");
    await user.click(within(modal).getByRole("button", { name: "Save" }));
    expect(getRow("fee_structure", "fs_10")).toMatchObject({ schemaVersion: 2, items: [expect.objectContaining({ amount: 2200, frequency: "Monthly" })] });
  });
});

describe("Configured fee billing", () => {
  it("bills only the selected stream, excluding ambiguous legacy students and other classes", async () => {
    const science = { ...student, id: "sci", grn: "SCI", grade: "11", section: "A", classId: "cls_11_science_A" };
    seed({ students: [science, { ...science, id: "com", grn: "COM", classId: "cls_11_commerce_A" }, { ...science, id: "legacy", grn: "OLD", classId: "cls_11A" }, { ...science, id: "twelve", grn: "XII", grade: "12", classId: "cls_12_science_A" }],
      classes: [{ id: "cls_11_science_A", grade: "11", section: "A", streamId: "science" }, { id: "cls_11_commerce_A", grade: "11", section: "A", streamId: "commerce" }],
      fee_structure: [
        { ...structure, id: "fs_11_science", grade: "11", streamId: "science", items: [{ ...tuition, grades: ["11:science"], amount: 3000 }] },
        { ...structure, id: "fs_11_commerce", grade: "11", streamId: "commerce", items: [{ ...tuition, grades: ["11:commerce"], amount: 2200 }] },
      ],
    });
    const { user } = renderUI(<FeesPage />);
    await user.click(screen.getByRole("button", { name: "Generate Batch Invoices" }));
    const modal = dialog("Generate Batch Invoices");
    await user.selectOptions(field("Grade", modal), "11");
    expect(within(modal).getByRole("button", { name: "Generate 0 invoices" })).toBeDisabled();
    await user.selectOptions(field("Stream", modal), "science");
    expect(within(modal).getByText(/1 students have no stream assignment/)).toBeInTheDocument();
    await user.type(field("Billing period", modal), "November");
    await user.click(within(modal).getByRole("switch", { name: "Notify parents" }));
    await user.click(within(modal).getByRole("button", { name: "Generate 1 invoices" }));
    expect(rowsOf("fee_invoices")).toEqual([expect.objectContaining({ studentId: "sci", grn: "SCI", grade: "11", streamId: "science", amount: 3000 })]);
    expect(rowsOf("fee_reminders")).toEqual([expect.objectContaining({ grn: "SCI", amount: 3000 })]);
  });

  const tuition = { id: "tuition", name: "Tuition", amount: 2000, grades: ["10"], frequency: "Monthly", dueDate: "2026-11-10", mandatory: true, newStudentsOnly: false };
  const structure = { id: "fs_10", grade: "10", schemaVersion: 2, academicYear: "2026-27", termsPerYear: 2, tuition: 99999, lab: 99999, activity: 99999, library: 99999, transport: 99999, items: [tuition,
    { ...tuition, id: "annual", name: "Annual fee", frequency: "Annual", amount: 3000 },
    { ...tuition, id: "transport", name: "Transport", amount: 1200, mandatory: false },
    { ...tuition, id: "admission", name: "Admission", amount: 5000, newStudentsOnly: true },
  ] };

  it("bills only the chosen frequency and excludes optional, admission-only and legacy amounts", async () => {
    seed({ students: [student], fee_structure: [structure] });
    const { user } = renderUI(<FeesPage />);
    await user.click(screen.getByRole("button", { name: "Generate Batch Invoices" }));
    const modal = dialog("Generate Batch Invoices");
    await user.selectOptions(field("Grade", modal), "10");
    expect(within(modal).getByRole("button", { name: "Generate 1 invoices" })).toBeDisabled();
    await user.type(field("Billing period", modal), "November");
    await user.click(within(modal).getByRole("button", { name: "Generate 1 invoices" }));
    expect(rowsOf("fee_invoices")).toEqual([expect.objectContaining({ amount: 2000, term: "2026-27 · Monthly · November", studentId: student.id, lines: [{ label: "Tuition", amount: 2000 }] })]);
    expect(rowsOf("fee_reminders")).toHaveLength(0);
  });

  it("queues parent messages only for newly billed students when Notify parents is enabled", async () => {
    seed({ students: [student, { ...student, id: "other", grn: "OTHER", grade: "9" }], fee_structure: [structure] });
    const { user } = renderUI(<FeesPage />);
    await user.click(screen.getByRole("button", { name: "Generate Batch Invoices" }));
    const modal = dialog("Generate Batch Invoices");
    await user.selectOptions(field("Grade", modal), "10");
    await user.type(field("Billing period", modal), "November");
    const toggle = within(modal).getByRole("switch", { name: "Notify parents" });
    expect(toggle).toHaveAttribute("aria-checked", "false");
    await user.click(toggle);
    await user.click(within(modal).getByRole("button", { name: "Generate 1 invoices" }));
    const created = rowsOf<{ id: string }>("fee_invoices");
    expect(created).toHaveLength(1);
    expect(rowsOf("fee_reminders")).toEqual([expect.objectContaining({ invoiceId: created[0]!.id, grn: student.grn, amount: 2000, channel: "Parent app" })]);
    expect(await screen.findByText("1 invoices generated · parent payment messages queued")).toBeInTheDocument();
  });

  it("queues no messages and creates no invoices if the billing batch fails", async () => {
    seed({ students: [student], fee_structure: [structure] });
    const { user } = renderUI(<FeesPage />);
    await user.click(screen.getByRole("button", { name: "Generate Batch Invoices" }));
    const modal = dialog("Generate Batch Invoices");
    await user.selectOptions(field("Grade", modal), "10");
    await user.type(field("Billing period", modal), "November");
    await user.click(within(modal).getByRole("switch", { name: "Notify parents" }));
    failNextWrite();
    await user.click(within(modal).getByRole("button", { name: "Generate 1 invoices" }));
    expect(await screen.findByText("Stopped after 0 of 1 invoices. Please try again.")).toBeInTheDocument();
    expect(rowsOf("fee_invoices")).toHaveLength(0);
    expect(rowsOf("fee_reminders")).toHaveLength(0);
    expect(dialog("Generate Batch Invoices")).toBeInTheDocument();
  });

  it("does not create duplicate invoices for a previously billed class and collection period", async () => {
    seed({ students: [student], fee_structure: [structure], fee_invoices: [invoice({ term: "2026-27 · Monthly · November" })] });
    const { user } = renderUI(<FeesPage />);
    await user.click(screen.getByRole("button", { name: "Generate Batch Invoices" }));
    const modal = dialog("Generate Batch Invoices");
    await user.selectOptions(field("Grade", modal), "10");
    await user.type(field("Billing period", modal), "  NOVEMBER  ");
    expect(within(modal).getByRole("button", { name: "Generate 0 invoices" })).toBeDisabled();
    expect(writesTo("fee_invoices")).toHaveLength(0);
  });
});
