import { describe, expect, it, vi } from "vitest";
import { callableCalls, dialog, field, renderUI, screen, seed, within, writes } from "@/test/render";
import { parseDetails } from "./details";
import { StudentProfile } from "./StudentProfile";
import { base, signInTeacher } from "./testFixtures";

const api = vi.hoisted(() => ({ fetch: vi.fn(), save: vi.fn() }));
vi.mock("./detailsApi", () => ({ fetchStudentDetails: api.fetch, saveStudentDetails: api.save }));

const record = parseDetails({
  exists: true, gender: "Male", dob: "2012-04-02", nationality: "Indian", motherTongue: "Hindi",
  contacts: { father: { name: "Mr Mehta", phone: "9876500001", occupation: "Engineer" }, mother: { name: "Mrs Mehta", phone: "9876500011" } },
  primary: "father", secondary: "mother", emergencyPhone: "9876500099", residence: { addressLine1: "12 MG Road", city: "Kochi", state: "Kerala", pin: "682001" },
  bloodGroup: "O+", conditions: "Asthma", admissionNumber: "GRN-1", admissionDate: "2020-06-01", academicYear: "2026-27", bus: "Bus 4", busStop: "Lake View",
});

describe("Student profile", () => {
  it("shows the overview with attendance counts, subject attendance and recent results", () => {
    signInTeacher(); seed(base());
    renderUI(<StudentProfile classId="cls_10B" studentId="stu_1" />);
    expect(screen.getByRole("heading", { name: "Aarav Mehta" })).toBeInTheDocument();
    expect(screen.getByText("Class 10-B · Roll 02 · Adm GRN-1")).toBeInTheDocument();
    expect(screen.getByText("Your class")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /9876500001/ })).toHaveAttribute("href", "tel:9876500001");
    // one register a day (the later period): 23 Nov P2 late, 24 Nov present
    expect(screen.getByRole("region", { name: "Attendance" })).toHaveTextContent("100.0% of 2 school days");
    expect(screen.getByRole("list", { name: "Attendance by subject" })).toHaveTextContent("Mathematics0/1");
    expect(screen.getByRole("region", { name: "Academics" })).toHaveTextContent("Half Yearlyclass 30%30%");
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual(["Overview", "Attendance", "Academics", "Details"]);
  });

  it("draws one dot per period each day and opens a day's periods with subject, teacher and mark", async () => {
    signInTeacher(); seed(base());
    const { user } = renderUI(<StudentProfile classId="cls_10B" studentId="stu_1" />);
    await user.click(screen.getByRole("tab", { name: "Attendance" }));
    expect(screen.getByText("November 2026")).toBeInTheDocument();
    const monday = screen.getByRole("button", { name: "2026-11-23, absent in 1 period" });
    expect(monday.querySelectorAll("span.rounded-full")).toHaveLength(3);
    expect([...monday.querySelectorAll("span.rounded-full")].map((d) => d.className.match(/bg-[a-z-]+/)?.[0])).toEqual(["bg-error", "bg-warning", "bg-outline-variant"]);
    expect(screen.getByRole("button", { name: "2026-11-24, present" }).querySelectorAll("span.rounded-full")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "2026-11-30, not marked" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "2026-11-29, no periods" })).toBeInTheDocument();
    await user.click(monday);
    const d = dialog("Mon 23 Nov");
    expect(d).toHaveTextContent("Absent in 1 of 3 periods");
    expect(within(d).getAllByRole("listitem").map((li) => li.textContent)).toEqual(["P1MathematicsAnitaAbsent", "P2EnglishRaviLate", "P3MathematicsAnitaNot marked"]);
    await user.click(within(d).getByRole("button", { name: "Close" }));
    await user.click(screen.getByRole("button", { name: "Previous month" }));
    expect(screen.getByText("October 2026")).toBeInTheDocument();
  });

  it("lists marks per subject and exam and the student's assignments", async () => {
    signInTeacher(); seed(base());
    const { user } = renderUI(<StudentProfile classId="cls_10B" studentId="stu_1" />);
    await user.click(screen.getByRole("tab", { name: "Academics" }));
    const maths = screen.getByRole("group", { name: "Marks in Mathematics" });
    expect(within(maths).getAllByRole("row").slice(1).map((r) => r.textContent)).toEqual(["UT140/5080%", "Half Yearly30/10030%"]);
    expect(maths).toHaveTextContent("55%");
    expect(screen.getByRole("group", { name: "Marks in Science" })).toHaveTextContent("UT125/5050%");
    const hw = screen.getByRole("list", { name: "Assignments" });
    expect(within(hw).getAllByRole("listitem").map((li) => li.textContent)).toEqual(["Lab notesScience · due 2026-11-29Pending", "Algebra sheetMathematics · due 2026-11-2818/20"]);
  });

  it("hides the details tab from a subject teacher", () => {
    signInTeacher("stf_3", "Meena"); seed(base());
    renderUI(<StudentProfile classId="cls_10B" studentId="stu_1" />);
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual(["Overview", "Attendance", "Academics"]);
    expect(api.fetch).not.toHaveBeenCalled();
  });

  it("refuses a student who is not on the class roster", () => {
    signInTeacher(); seed(base());
    renderUI(<StudentProfile classId="cls_10B" studentId="stu_9" />);
    expect(screen.getByText("Student not found")).toBeInTheDocument();
  });

  it("shows the class teacher the admission record and saves corrected contacts through the callable", async () => {
    api.fetch.mockResolvedValue(record);
    api.save.mockImplementation(async (_id: string, patch: { contacts?: { mother?: { phone: string } } }) =>
      ({ ...record, contacts: { ...record.contacts, mother: { ...record.contacts.mother, ...patch.contacts?.mother } } }));
    signInTeacher(); seed(base());
    const { user } = renderUI(<StudentProfile classId="cls_10B" studentId="stu_1" />);
    await user.click(screen.getByRole("tab", { name: "Details" }));
    expect(api.fetch).toHaveBeenCalledWith("stu_1");
    const contacts = await screen.findByRole("list", { name: "Contacts" });
    expect(within(contacts).getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      "FatherPrimaryMr Mehta · Engineer9876500001", "MotherSecondMrs Mehta9876500011", "Emergency9876500099",
    ]);
    expect(screen.getByRole("region", { name: "Home address" })).toHaveTextContent("12 MG Road, Kochi, Kerala, 682001");
    expect(screen.getByRole("region", { name: "Health" })).toHaveTextContent("Blood groupO+Medical conditionsAsthmaSupport needsNone recorded");
    expect(screen.getByRole("region", { name: "Transport" })).toHaveTextContent("BusBus 4StopLake View");
    expect(document.body).not.toHaveTextContent(/religion|caste|category|bank/i);

    await user.click(within(screen.getByRole("region", { name: "Parents & contacts" })).getByRole("button", { name: "Edit" }));
    const d = dialog("Parents & contacts");
    await user.click(within(d).getByRole("tab", { name: "Mother" }));
    await user.clear(field("Mobile number", d));
    await user.type(field("Mobile number", d), "12");
    await user.click(within(d).getByRole("button", { name: "Save changes" }));
    expect(within(d).getByRole("alert")).toHaveTextContent("Enter a valid mobile number for the mother.");
    expect(api.save).not.toHaveBeenCalled();
    await user.clear(field("Mobile number", d));
    await user.type(field("Mobile number", d), "9876500022");
    await user.click(within(d).getByRole("button", { name: "Save changes" }));
    expect(api.save).toHaveBeenCalledWith("stu_1", {
      contacts: { mother: { name: "Mrs Mehta", phone: "9876500022", email: "", occupation: "", relationship: "", address: "" } }, primary: "father", secondary: "mother", emergencyPhone: "9876500099",
    });
    expect(await screen.findByText("Saved")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Contacts" })).toHaveTextContent("9876500022");
    expect(writes).toHaveLength(0);
    expect(callableCalls).toHaveLength(0);
  });

  it("shows the server's message when the details cannot be loaded, with a retry", async () => {
    api.fetch.mockRejectedValueOnce(new Error("Only the class teacher of this division can open these details.")).mockResolvedValueOnce(record);
    signInTeacher(); seed(base());
    const { user } = renderUI(<StudentProfile classId="cls_10B" studentId="stu_1" />);
    await user.click(screen.getByRole("tab", { name: "Details" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Only the class teacher of this division can open these details.");
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("list", { name: "Contacts" })).toBeInTheDocument();
  });
});
