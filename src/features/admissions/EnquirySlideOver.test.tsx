import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EnquirySlideOver } from "./EnquirySlideOver";
import { field, fieldError, renderUI, rowsOf, screen, seed, writes, writesTo } from "@/test/render";

beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-11-03T10:00:00")); });
afterEach(() => { vi.useRealTimers(); });

const open = () => renderUI(<EnquirySlideOver open onClose={() => {}} />);
const create = () => screen.getByRole("button", { name: /Create Enquiry/ });

describe("Log enquiry form", () => {
  it("shows every required-field error and writes nothing", async () => {
    const { user } = open();
    await user.click(create());
    expect(fieldError("Student Full Name")).toBe("Student name is required");
    expect(fieldError("Date of Birth")).toBe("Date of birth is required");
    expect(fieldError("Primary Guardian")).toBe("Guardian name is required");
    expect(fieldError("Mobile Number")).toBe("Enter a valid mobile number");
    expect(fieldError("Email Address")).toBe("Enter a valid email");
    expect(writes).toHaveLength(0);
  });

  it("rejects a future DOB, a bad phone / email and a follow-up in the past", async () => {
    const { user } = open();
    await user.type(field("Student Full Name"), "Samaira Kapoor");
    await user.type(field("Date of Birth"), "2026-12-01");
    await user.type(field("Primary Guardian"), "Dr. Vikram Kapoor");
    await user.type(field("Mobile Number"), "----------");
    await user.type(field("Email Address"), "vikram@kapoor");
    await user.type(field("Follow-up Date"), "2026-11-02");
    await user.click(create());
    expect(fieldError("Date of Birth")).toBe("DOB cannot be in the future");
    expect(fieldError("Mobile Number")).toBe("Enter a valid mobile number");
    expect(fieldError("Email Address")).toBe("Enter a valid email");
    expect(fieldError("Follow-up Date")).toBe("Follow-up date cannot be in the past");
    expect(fieldError("Student Full Name")).toBe("");
    expect(writes).toHaveLength(0);
  });

  it("creates the enquiry with the next reference and logs the prospectus message", async () => {
    seed({ adm_enquiries: [{ id: "adm_enq_009", ref: "ENQ-2026-0009", name: "Old", grade: "1", source: "Walk-In", stage: "new", createdAt: "2026-10-01" }], staff: [{ id: "stf_001", name: "Meera Iyer", status: "Active" }] });
    const { user } = open();
    expect(screen.getByText("ENQ-2026-0010")).toBeInTheDocument();
    await user.type(field("Student Full Name"), "  Samaira Kapoor ");
    await user.selectOptions(field("Target Grade / Cohort"), "3");
    await user.type(field("Date of Birth"), "2018-06-12");
    await user.type(field("Primary Guardian"), "Dr. Vikram Kapoor");
    await user.type(field("Mobile Number"), "+91 98452 31209");
    await user.type(field("Email Address"), "vikram@kapoor.in");
    await user.selectOptions(field("Assign to Counsellor"), "Meera Iyer");
    await user.click(screen.getByRole("radio", { name: "Referral" }));
    await user.click(create());
    const row = rowsOf<Record<string, unknown>>("adm_enquiries").find((r) => r.ref === "ENQ-2026-0010");
    expect(row).toMatchObject({
      name: "Samaira Kapoor", grade: "3", dob: "2018-06-12", guardian: "Dr. Vikram Kapoor", phone: "+91 98452 31209", email: "vikram@kapoor.in",
      source: "Referral", stage: "new", assignee: "Meera Iyer", createdAt: "2026-11-03", applicationId: "", lostReason: "", sibling: false,
    });
    expect(String(row?.submittedTs)).toMatch(/^2026-11-03T/);
    expect(writesTo("adm_messages")).toHaveLength(1);
    expect(writesTo("adm_messages")[0]!.data).toMatchObject({ kind: "WhatsApp prospectus", to: "+91 98452 31209" });
    expect(await screen.findByText(/Enquiry ENQ-2026-0010 created/)).toBeInTheDocument();
  });

  it("offers the school's staff as counsellors instead of demo names", () => {
    seed({ staff: [{ id: "stf_002", name: "Ravi Kumar", status: "Active" }, { id: "stf_003", name: "Gone", status: "Inactive" }] });
    open();
    const opts = [...(field("Assign to Counsellor") as unknown as HTMLSelectElement).options].map((o) => o.text);
    expect(opts).toEqual(["Unassigned", "Ravi Kumar"]);
  });

  it("does not send the WhatsApp message when unticked", async () => {
    const { user } = open();
    await user.type(field("Student Full Name"), "A");
    await user.type(field("Date of Birth"), "2019-01-01");
    await user.type(field("Primary Guardian"), "G");
    await user.type(field("Mobile Number"), "9845231209");
    await user.type(field("Email Address"), "g@x.in");
    await user.click(screen.getByRole("checkbox", { name: /Dispatch digital prospectus/ }));
    await user.click(create());
    expect(writesTo("adm_enquiries")).toHaveLength(1);
    expect(writesTo("adm_messages")).toHaveLength(0);
  });
});
