import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StepPage } from "./StepPage";
import * as locationData from "./locations";
import { authAccounts, field, fieldError, getRow, renderUI, router, rowsOf, screen, seed, sentInvites, writes, writesTo } from "@/test/render";

beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-11-03T10:00:00")); });
afterEach(() => { vi.useRealTimers(); });

const steps = Array.from({ length: 8 }, (_, i) => ({ id: `step_${i + 1}`, no: i + 1, done: false, doneAt: "" }));
/** opens step `no` with steps 1..no-1 already completed */
function openStep(no: number, extra: Record<string, Record<string, unknown>[]> = {}) {
  seed({ onboarding: [{ id: "state", complete: false, completed: Array.from({ length: no - 1 }, (_, i) => i + 1) }], setup_steps: steps, ...extra });
  return renderUI(<StepPage no={no} />);
}
const save = () => screen.getByRole("button", { name: /Save & continue|Finish setup/ });
const alertText = () => screen.getByRole("alert").textContent;
/** only the wizard's own bookkeeping was written */
const onlyProgress = () => writes.every((w) => ["onb_data", "onboarding", "setup_steps"].includes(w.coll));

describe("guard", () => {
  it("sends you back to the first unfinished step", () => {
    seed({ onboarding: [{ id: "state", complete: false, completed: [1] }], setup_steps: steps });
    renderUI(<StepPage no={4} />);
    expect(router.replace).toHaveBeenCalledWith("/onboarding/setup/2");
  });
});

describe("1 · School profile", () => {
  it("shows the field errors and writes nothing", async () => {
    const { user } = openStep(1, { school: [{ id: "school", name: "" }] });
    await user.type(field("Affiliation number"), "12ab");
    await user.type(field("Phone"), "98100");
    await user.type(field("Official email"), "office@");
    await user.click(save());
    expect(fieldError("School name")).toBe("School name is required.");
    expect(fieldError("Affiliation number")).toBe("Enter the 5–7 digit affiliation number.");
    expect(fieldError("City")).toBe("City is required.");
    expect(fieldError("Address line 1")).toBe("Address line 1 is required.");
    expect(fieldError("State")).toBe("Choose a state.");
    expect(fieldError("District")).toBe("Choose a district.");
    expect(fieldError("PIN code")).toBe("PIN code is required.");
    expect(fieldError("Phone")).toBe("Enter a phone number with at least 10 digits.");
    expect(fieldError("Official email")).toBe("Enter a valid email address.");
    expect(writes).toHaveLength(0);
  });
  it("writes the contract school doc and the profile, then moves on", async () => {
    const { user } = openStep(1, { school: [{ id: "school", name: "Sunrise", academicYear: "2026-27", term: "Term 1" }], set_config: [{ id: "profile", name: "Sunrise" }] });
    await user.clear(field("School name"));
    await user.type(field("School name"), " Sunrise Academy ");
    await user.type(field("Affiliation number"), "#1930281");
    await user.type(field("Address line 1"), " 12 School Road ");
    await user.type(field("Address line 2"), " Near Central Park ");
    await user.selectOptions(field("State"), "IN.16");
    await user.selectOptions(field("District"), "IN.16.521");
    await user.type(field("City"), "Pune");
    await user.type(field("PIN code"), "411001");
    await user.type(field("Phone"), "+91 20 2345 6789");
    await user.type(field("Official email"), "office@sunrise.in");
    await user.type(field("Principal"), "Dr. Rao");
    await user.click(save());
    expect(getRow("school", "school")).toMatchObject({ name: "Sunrise Academy", short: "Sunrise Academy", board: "CBSE", affiliation: "#1930281", city: "Pune", academicYear: "2026-27", term: "Term 1" });
    expect(getRow("set_config", "profile")).toMatchObject({ name: "Sunrise Academy", affiliation: "1930281", email: "office@sunrise.in", phone: "+91 20 2345 6789", principal: "Dr. Rao" });
    const address = { addressLine1: "12 School Road", addressLine2: "Near Central Park", country: "IN", countryName: "India", state: "IN.16", stateName: "Maharashtra", district: "IN.16.521", districtName: "Pune", city: "Pune", pin: "411001" };
    expect(getRow("set_config", "profile")).toMatchObject(address);
    expect(getRow("set_config", "profile")?.address).toBe("12 School Road\nNear Central Park\nPune, Maharashtra, 411001\nIndia");
    expect(getRow("onb_data", "s1")).toMatchObject({ values: address });
    expect(getRow("onboarding", "state")).toMatchObject({ completed: [1] });
    expect(getRow("setup_steps", "step_1")).toMatchObject({ done: true });
    expect(router.push).toHaveBeenCalledWith("/onboarding/setup/2");
  });
  it("creates school/school when bootstrap left it missing", async () => {
    const { user } = openStep(1);
    await user.type(field("School name"), "Sunrise Academy");
    await user.type(field("Affiliation number"), "1930281");
    await user.type(field("Address line 1"), "12 School Road");
    await user.selectOptions(field("State"), "IN.16");
    await user.selectOptions(field("District"), "IN.16.521");
    await user.type(field("City"), "Pune");
    await user.type(field("PIN code"), "411001");
    await user.type(field("Phone"), "9810000001");
    await user.type(field("Official email"), "office@sunrise.in");
    await user.click(save());
    expect(getRow("school", "school")).toMatchObject({ name: "Sunrise Academy", city: "Pune" });
    expect(getRow("set_config", "profile")).toMatchObject({ name: "Sunrise Academy" });
  });
  it("restores the structured address when returning to step 1", () => {
    openStep(1, { onb_data: [{ id: "s1", values: { addressLine1: "School Road", addressLine2: "Near park", country: "IN", state: "IN.13", district: "IN.13.595", city: "Kochi", pin: "682001" } }] });
    expect(field("Address line 1")).toHaveValue("School Road");
    expect(field("Address line 2")).toHaveValue("Near park");
    expect(field("Country")).toHaveValue("IN");
    expect(field("State")).toHaveValue("IN.13");
    expect(field("District")).toHaveValue("IN.13.595");
    expect(field("City")).toHaveValue("Kochi");
    expect(field("PIN code")).toHaveValue("682001");
  });
  it("loads an older saved address without discarding it", () => {
    openStep(1, { school: [{ id: "school", name: "Sunrise", city: "Pune" }], set_config: [{ id: "profile", address: "12 School Road", email: "office@sunrise.in" }] });
    expect(field("Address line 1")).toHaveValue("12 School Road");
    expect(field("City")).toHaveValue("Pune");
    expect(field("Official email")).toHaveValue("office@sunrise.in");
    expect(field("District")).toBeDisabled();
    expect(writes).toHaveLength(0);
  });
  it("clears dependent address fields when their parent location changes", async () => {
    const { user } = openStep(1, { onb_data: [{ id: "s1", values: { addressLine1: "School Road", state: "IN.16", district: "IN.16.521", city: "Pune", pin: "411001" } }] });
    await user.selectOptions(field("State"), "IN.13");
    expect(field("District")).toHaveValue("");
    expect(field("City")).toHaveValue("");
    expect(field("PIN code")).toHaveValue("");
    expect(screen.queryByRole("option", { name: "Pune" })).not.toBeInTheDocument();
    await user.selectOptions(field("District"), "IN.13.595");
    vi.spyOn(locationData, "loadCountryStates").mockResolvedValue([{ code: "US.CA", name: "California", districts: [{ code: "US.CA.001", name: "Alameda County" }] }]);
    await user.selectOptions(field("Country"), "US");
    expect(field("State")).toHaveValue("");
    expect(field("District")).toHaveValue("");
    expect(field("District")).toBeDisabled();
    expect(await screen.findByRole("option", { name: "California" })).toBeInTheDocument();
    await user.selectOptions(field("State"), "US.CA");
    expect(screen.getByRole("option", { name: "Alameda County" })).toBeInTheDocument();
    expect(field("Postal code")).toHaveAttribute("inputmode", "text");
    expect(field("Address line 1")).toHaveValue("School Road");
  });
  it("shows a retry action and prevents saving when location loading fails", async () => {
    vi.spyOn(locationData, "loadCountryStates").mockRejectedValueOnce(new Error("offline")).mockResolvedValue([]);
    const { user } = openStep(1);
    await user.selectOptions(field("Country"), "GB");
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load states and districts");
    expect(save()).toBeDisabled();
    expect(field("State")).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("option", { name: "Not applicable" })).toBeInTheDocument();
    expect(save()).toBeEnabled();
    expect(writes).toHaveLength(0);
  });
});

describe("2 · Academic year & terms", () => {
  it("lists date and working-day problems", async () => {
    const { user } = openStep(2, { school: [{ id: "school", name: "S" }] });
    const ends = screen.getAllByLabelText("Ends");
    await user.clear(ends[0]!); await user.type(ends[0]!, "2026-03-01");
    const days = field("Statutory working days");
    await user.clear(days); await user.type(days, "50");
    await user.click(save());
    expect(alertText()).toContain("Term 1: end date must be after the start date.");
    expect(alertText()).toContain("Working days should be between 100 and 300.");
    expect(onlyProgress()).toBe(true);
    expect(writes).toHaveLength(0);
  });
  it("flags overlapping terms", async () => {
    const { user } = openStep(2, { school: [{ id: "school", name: "S" }] });
    const starts = screen.getAllByLabelText("Starts");
    await user.clear(starts[1]!); await user.type(starts[1]!, "2026-09-15");
    await user.click(save());
    expect(alertText()).toContain("Term 2 overlaps Term 1.");
    expect(writes).toHaveLength(0);
  });
  it("replaces set_terms and sets school.academicYear and the current term", async () => {
    const { user } = openStep(2, { school: [{ id: "school", name: "S" }], set_terms: [{ id: "old", name: "Old" }], set_config: [{ id: "meta", academicYear: "2020-21" }] });
    await user.click(save());
    expect(rowsOf("set_terms").map((t) => (t as { id: string }).id).sort()).toEqual(["term_1", "term_2"]);
    expect(getRow("set_terms", "term_1")).toMatchObject({ name: "Term 1", start: "2026-04-01", end: "2026-09-30", status: "Closed", days: 110 });
    expect(getRow("set_terms", "term_2")).toMatchObject({ name: "Term 2", status: "In Progress" });
    expect(getRow("school", "school")).toMatchObject({ academicYear: "2026-27", term: "Term 2" });
    expect(getRow("set_config", "meta")).toMatchObject({ academicYear: "2026-27" });
  });
});

describe("3 · Classes & sections", () => {
  it("refuses an out-of-range section size", async () => {
    const { user } = openStep(3);
    const cap = screen.getByLabelText("Grade 1 seats per section");
    await user.clear(cap); await user.type(cap, "5");
    await user.click(save());
    expect(alertText()).toBe("Seat capacity per section should be between 10 and 60.");
    expect(writes).toHaveLength(0);
  });
  it("creates one contract class doc per section and keeps existing class teachers", async () => {
    const { user } = openStep(3, {
      classes: [{ id: "cls_1A", grade: "1", section: "A", classTeacherId: "stf_009", room: "101", wing: "North" }, { id: "cls_12C", grade: "12", section: "C", classTeacherId: "" }, { id: "cls_12D", grade: "12", section: "D" }],
      students: [{ id: "stu_001", name: "X", grade: "12", section: "D", classId: "cls_12D" }],
    });
    await user.selectOptions(screen.getByLabelText("Grade 5 sections"), "1");
    await user.click(save());
    const ids = rowsOf<{ id: string }>("classes").map((c) => c.id).sort();
    // 1-4 × A-C, 5-A, and 12-D kept because a student sits in it; 12-C (empty) is removed
    expect(ids).toEqual(["cls_12D", "cls_1A", "cls_1B", "cls_1C", "cls_2A", "cls_2B", "cls_2C", "cls_3A", "cls_3B", "cls_3C", "cls_4A", "cls_4B", "cls_4C", "cls_5A"].sort());
    expect(getRow("classes", "cls_1A")).toMatchObject({ grade: "1", section: "A", classTeacherId: "stf_009", room: "101", wing: "North" });
    expect(getRow("classes", "cls_5A")).toMatchObject({ grade: "5", section: "A", classTeacherId: "", room: "", wing: "" });
    expect(getRow("set_sections", "sec_grade5")).toMatchObject({ grade: "Grade 5", sections: ["5-A"], cap: 30 });
  });
});

describe("4 · Bell schedule", () => {
  it("validates the day and writes set_config/bell", async () => {
    const { user } = openStep(4);
    const periods = field("Periods per day");
    await user.clear(periods); await user.type(periods, "13");
    await user.click(save());
    expect(alertText()).toBe("Use between 1 and 12 periods.");
    await user.clear(periods); await user.type(periods, "8");
    const close = field("School closes");
    await user.clear(close); await user.type(close, "13:00");
    await user.click(save());
    expect(alertText()).toBe("The schedule runs until 14:35, past the closing time of 13:00. Shorten the periods or move closing time.");
    expect(writes).toHaveLength(0);
    await user.clear(close); await user.type(close, "15:00");
    await user.click(save());
    expect(getRow("set_config", "bell")).toMatchObject({ gates: "07:45", classes: "08:30 – 15:00", periods: "8 Periods × 40 min", recess: "15m (snack) + 30m (lunch)" });
  });
});

describe("5 · Fee structure", () => {
  it("refuses zero tuition and a bad due day, then writes fee_structure per grade", async () => {
    const { user } = openStep(5, { fee_structure: [{ id: "fs_5", grade: "5", tuition: 1, lab: 1, activity: 1, library: 1, transport: 900 }] });
    const tuition = screen.getAllByLabelText("Tuition (₹)");
    await user.clear(tuition[0]!);
    await user.click(save());
    expect(alertText()).toBe("Tuition must be greater than zero for every band.");
    await user.type(tuition[0]!, "18000");
    const due = field("Due on day of month");
    await user.clear(due); await user.type(due, "31");
    await user.click(save());
    expect(alertText()).toBe("Due day should be between 1 and 28.");
    expect(writes).toHaveLength(0);
    await user.clear(due); await user.type(due, "10");
    await user.click(save());
    expect(getRow("fee_structure", "fs_LKG")).toMatchObject({ grade: "LKG", tuition: 18000, transport: 0 });
    expect(getRow("fee_structure", "fs_5")).toMatchObject({ tuition: 24000, lab: 3500, transport: 900 });
    expect(rowsOf("fee_structure")).toHaveLength(14);
  });
});

describe("6 · Staff allocations", () => {
  const secs = [{ id: "sec_grade5", grade: "Grade 5", sections: ["5-A", "5-B"] }];
  it("new staff need a name and a unique email", async () => {
    const { user } = openStep(6, { set_sections: secs, staff: [{ id: "stf_001", name: "Anita", email: "anita@s.in", role: "TGT", department: "Science" }] });
    await user.click(screen.getByRole("button", { name: "Add" }));
    expect(fieldError("New staff member")).toBe("Enter the new staff member's name.");
    expect(fieldError("Email (teacher login)")).toBe("Enter a valid email (it is the teacher's login).");
    await user.type(field("New staff member"), "Ravi");
    await user.type(field("Email (teacher login)"), "ANITA@s.in");
    await user.click(screen.getByRole("button", { name: "Add" }));
    expect(fieldError("Email (teacher login)")).toBe("Another staff member already uses this email.");
    expect(writes).toHaveLength(0);
  });
  it("adds staff with a stf_ id, a teacher login and a password email", async () => {
    const { user } = openStep(6, { set_sections: secs, staff: [{ id: "stf_001", name: "Anita", email: "anita@s.in", empId: "EMP-1001", role: "TGT", department: "Science" }] });
    await user.type(field("New staff member"), " Ravi Kumar ");
    await user.type(field("Email (teacher login)"), "ravi@s.in");
    await user.click(screen.getByRole("button", { name: "Add" }));
    expect(await screen.findByText("Staff member added · password email sent to ravi@s.in")).toBeInTheDocument();
    expect(getRow("staff", "stf_002")).toMatchObject({ name: "Ravi Kumar", email: "ravi@s.in", empId: "EMP-1002", role: "TGT", status: "Active", authUid: "uid_new_1" });
    expect(getRow("users", "uid_new_1")).toMatchObject({ schoolId: "sch_test", role: "teacher", staffId: "stf_002", email: "ravi@s.in" });
    expect(sentInvites).toEqual(["ravi@s.in"]);
  });
  it("reports an email that already has a login and leaves nothing behind", async () => {
    authAccounts.set("taken@s.in", "uid_x");
    const { user } = openStep(6, { set_sections: secs });
    await user.type(field("New staff member"), "Ravi");
    await user.type(field("Email (teacher login)"), "taken@s.in");
    await user.click(screen.getByRole("button", { name: "Add" }));
    expect(await screen.findByText(/Could not add staff: This email already has a login/)).toBeInTheDocument();
    expect(writes).toHaveLength(0);
  });
  it("needs at least one staff member", async () => {
    const { user } = openStep(6, { set_sections: secs });
    await user.click(save());
    expect(alertText()).toBe("Add at least one staff member before continuing.");
    expect(writes).toHaveLength(0);
  });
  it("needs half the sections covered; then writes classTeacherId + name on the class docs", async () => {
    const { user } = openStep(6, {
      set_sections: secs,
      staff: [{ id: "stf_001", name: "Anita Sharma", email: "a@s.in", role: "TGT", department: "Science" }, { id: "stf_002", name: "Ravi", email: "r@s.in", role: "PRT", department: "Maths" }],
      classes: [{ id: "cls_5A", grade: "5", section: "A", classTeacherId: "" }, { id: "cls_5B", grade: "5", section: "B", classTeacherId: "stf_002", classTeacher: "Ravi" }],
    });
    // the existing class teacher is pre-selected from the class doc
    expect(screen.getByLabelText("Class for Ravi")).toHaveValue("5-B");
    await user.selectOptions(screen.getByLabelText("Class for Ravi"), "");
    await user.click(save());
    expect(alertText()).toBe("2 of 2 sections have no class teacher yet. Assign at least half to continue.");
    expect(writes).toHaveLength(0);
    await user.selectOptions(screen.getByLabelText("Class for Anita Sharma"), "5-A");
    await user.click(save());
    expect(getRow("classes", "cls_5A")).toMatchObject({ classTeacherId: "stf_001", classTeacher: "Anita Sharma" });
    expect(getRow("classes", "cls_5B")).toMatchObject({ classTeacherId: "", classTeacher: "" });
    expect(getRow("staff", "stf_001")).not.toHaveProperty("classTeacherOf");
    expect(router.push).toHaveBeenCalledWith("/onboarding/setup/7");
  });
});

describe("7 · Data import", () => {
  it("shows row errors and imports valid rows as contract students", async () => {
    const { user } = openStep(7, { classes: [{ id: "cls_5A", grade: "5", section: "A" }, { id: "cls_5B", grade: "5", section: "B" }], students: [{ id: "stu_007", name: "Old", grn: "GIS-8807", grade: "5", section: "A", classId: "cls_5A", roll: 3 }] });
    await user.click(screen.getByLabelText("CSV data"));
    await user.paste("name,grade,section,guardian,phone\nAarav Nair,5,A,Mr. Nair,+91 9810011223\nDiya Menon,5,B,Mrs. Menon,9810011224\nKabir Shah,9,A,Mr. Shah,9810011225\nTara,5,B,Mrs. Iyer,98100");
    expect(screen.getByText("No class 9-A (add it in step 3)")).toBeInTheDocument();
    expect(screen.getByText("Phone needs 10–13 digits")).toBeInTheDocument();
    expect(writesTo("students")).toHaveLength(0);
    await user.click(screen.getByRole("button", { name: "Import 2 valid rows" }));
    expect(getRow("students", "stu_008")).toMatchObject({ name: "Aarav Nair", grade: "5", section: "A", classId: "cls_5A", roll: 4, guardian: "Mr. Nair", phone: "+91 9810011223", status: "Active" });
    expect(getRow("students", "stu_009")).toMatchObject({ name: "Diya Menon", classId: "cls_5B", roll: 1 });
    expect(await screen.findByText("2 students imported")).toBeInTheDocument();
    await user.click(save());
    expect(getRow("onb_data", "s7")).toMatchObject({ values: { imported: 2, totalStudents: 3 } });
  });
});

describe("8 · Parent invite", () => {
  it("validates the invitation and finishes setup", async () => {
    const { user } = openStep(8, { school: [{ id: "school", short: "Sunrise" }] });
    await user.clear(field("Invitation message"));
    await user.type(field("Invitation message"), "Hello");
    await user.click(save());
    expect(alertText()).toBe("The message must include the {link} variable so parents can sign in.");
    await user.type(field("Invitation message"), " {{link}");
    await user.click(screen.getByRole("radio", { name: "Schedule" }));
    await user.click(save());
    expect(alertText()).toBe("Pick the date to send the invitations.");
    await user.type(screen.getByLabelText("Send date"), "2026-11-01");
    await user.click(save());
    expect(alertText()).toBe("Pick today or a later date.");
    await user.clear(screen.getByLabelText("Send date"));
    await user.type(screen.getByLabelText("Send date"), "2026-11-10");
    await user.click(save());
    expect(alertText()).toBe("Confirm the parent contact data has been verified.");
    expect(writes).toHaveLength(0);
    await user.click(screen.getByRole("checkbox"));
    await user.click(save());
    expect(writesTo("notifications")).toHaveLength(1);
    expect(getRow("onboarding", "state")).toMatchObject({ complete: true, completed: [1, 2, 3, 4, 5, 6, 7, 8] });
    expect(router.push).toHaveBeenCalledWith("/dashboard");
  });
});
