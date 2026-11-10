import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EnquirySlideOver } from "./EnquirySlideOver";
import { field, fieldError, renderUI, rowsOf, screen, seed, writes, writesTo } from "@/test/render";

beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-11-03T10:00:00")); });
afterEach(() => { vi.useRealTimers(); });

const open = (mode: "enquiry" | "application" = "enquiry") => renderUI(<EnquirySlideOver open mode={mode} onClose={() => {}} />);

describe("Admissions intake", () => {
  it("requires the student, grade and guardian contact", async () => {
    const { user } = open();
    await user.click(screen.getByRole("button", { name: "Create enquiry" }));
    expect(fieldError("Student name")).toBe("Student name is required");
    expect(fieldError("Grade or course")).toBe("Choose a grade");
    expect(fieldError("Guardian name")).toBe("Guardian name is required");
    expect(fieldError("Guardian phone")).toBe("Enter a valid mobile number");
    expect(writes).toHaveLength(0);
  });

  it("saves a basic enquiry without a follow-up date or message", async () => {
    const { user } = open();
    await user.type(field("Student name"), "Samaira Kapoor");
    await user.selectOptions(field("Grade or course"), "3");
    await user.type(field("Guardian name"), "Dr. Kapoor");
    await user.type(field("Guardian phone"), "9845231209");
    await user.selectOptions(field("Gender"), "Female");
    await user.type(field("Parent email"), "parent@example.test");
    await user.type(field("Date of birth"), "2018-06-12");
    expect(screen.queryByLabelText("Follow-up date")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Create enquiry" }));
    expect(rowsOf("adm_enquiries")[0]).toMatchObject({ name: "Samaira Kapoor", grade: "3", gender: "Female", email: "parent@example.test", dob: "2018-06-12", followUp: "", stage: "new" });
    expect(writesTo("adm_messages")).toHaveLength(0);
  });

  it("starts a walk-in application directly with a custom course and guardian email", async () => {
    seed({ adm_seats: [{ id: "seat_11_course_home_science", grade: "11-course_home_science", streamId: "course_home_science", stream: "Home Science", group: "senior", capacity: 30, rteSeats: 0 }] });
    const { user } = open("application");
    await user.type(field("Student name"), "Samaira Kapoor");
    await user.selectOptions(field("Grade or course"), "11-course_home_science");
    await user.type(field("Guardian name"), "Dr. Kapoor");
    await user.type(field("Guardian phone"), "9845231209");
    await user.type(field("Parent email"), "Parent@example.test");
    await user.click(screen.getByRole("button", { name: "Create application" }));
    expect(rowsOf("adm_applications")[0]).toMatchObject({ name: "Samaira Kapoor", enquiryId: "", grade: "11-course_home_science", email: "parent@example.test", status: "submitted" });
    expect(writesTo("adm_enquiries")).toHaveLength(0);
  });
});
