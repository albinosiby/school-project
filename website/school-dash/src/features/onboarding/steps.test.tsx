import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StepPage } from "./StepPage";
import * as locationData from "./locations";
import { callableCalls, failNextWrite, field, fieldError, getRow, renderUI, router, rowsOf, screen, seed, sentInvites, writes, writesTo, within } from "@/test/render";

beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-11-03T10:00:00")); });
afterEach(() => { vi.useRealTimers(); });

const steps = Array.from({ length: 8 }, (_, i) => ({ id: `step_${i + 1}`, no: i + 1, done: false, doneAt: "" }));
/** Opens a step with the preceding active steps completed. */
function openStep(no: number, extra: Record<string, Record<string, unknown>[]> = {}) {
  const completed = steps.filter((step) => step.no < no && step.no !== 7).map((step) => step.no);
  seed({ onboarding: [{ id: "state", complete: false, completed }], setup_steps: steps, ...extra });
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

  it.each([7, 8])("redirects retired setup link %i to the last active step", (no) => {
    openStep(no);
    expect(router.replace).toHaveBeenCalledWith("/onboarding/setup/6");
    expect(writes).toHaveLength(0);
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
    expect(screen.queryByLabelText("Principal")).not.toBeInTheDocument();
    await user.click(save());
    expect(getRow("school", "school")).toMatchObject({ name: "Sunrise Academy", short: "Sunrise Academy", board: "CBSE", affiliation: "#1930281", city: "Pune", academicYear: "2026-27", term: "Term 1" });
    expect(getRow("set_config", "profile")).toMatchObject({ name: "Sunrise Academy", affiliation: "1930281", email: "office@sunrise.in", phone: "+91 20 2345 6789" });
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
  it("saves separate Science A and Commerce A classes and independent Grade 12 streams", async () => {
    const { user } = openStep(3, {
      classes: [{ id: "cls_11_science_A", grade: "11", section: "A", streamId: "science", classTeacherId: "teacher1", room: "Lab" }, { id: "cls_11A", grade: "11", section: "A" }],
      students: [{ id: "legacy", grade: "11", section: "A", classId: "cls_11A" }],
    });
    for (const name of ["Grade 11 Science", "Grade 11 Commerce", "Grade 12 Humanities"]) await user.click(within(screen.getByRole("group", { name })).getByRole("checkbox"));
    await user.selectOptions(screen.getByLabelText("Grade 11 Science sections"), "2");
    await user.clear(screen.getByLabelText("Grade 11 Commerce seats per section"));
    await user.type(screen.getByLabelText("Grade 11 Commerce seats per section"), "25");
    await user.click(save());
    expect(getRow("classes", "cls_11_science_A")).toMatchObject({ grade: "11", streamId: "science", stream: "Science", section: "A", classTeacherId: "teacher1", room: "Lab" });
    expect(getRow("classes", "cls_11_science_B")).toMatchObject({ streamId: "science", section: "B" });
    expect(getRow("classes", "cls_11_commerce_A")).toMatchObject({ grade: "11", streamId: "commerce", section: "A" });
    expect(getRow("classes", "cls_12_humanities_A")).toMatchObject({ grade: "12", streamId: "humanities", section: "A" });
    expect(getRow("classes", "cls_11A")).toBeDefined();
    expect(getRow("set_sections", "sec_grade11_science")).toMatchObject({ sections: ["11-Science-A", "11-Science-B"], cap: 60 });
    expect(getRow("set_sections", "sec_grade11_commerce")).toMatchObject({ sections: ["11-Commerce-A"], cap: 25 });
    expect(getRow("onb_data", "s3")).toMatchObject({ values: { cfg: expect.arrayContaining([expect.objectContaining({ grade: "11", streams: [{ id: "science", sections: 2, cap: 30 }, { id: "commerce", sections: 1, cap: 25 }] })]) } });
  });

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
    expect(getRow("set_config", "bell")).toMatchObject({ gates: "07:45", classes: "08:30 – 15:00", periods: "8 Periods × 40 min", breaks: [
      { name: "Morning break", start: "10:30", duration: 15 }, { name: "Lunch", start: "12:05", duration: 30 },
    ] });
  });

  it("adds all three exact-time breaks, saves them and restores them on reopening", async () => {
    const { user, unmount } = openStep(4);
    const edit = async (index: number, name: string, start: string, duration: string) => {
      const row = within(screen.getByRole("group", { name: `Break ${index}` }));
      for (const [label, value] of [["Break name", name], ["Start time", start], ["Duration (min)", duration]]) {
        const input = row.getByLabelText(label!);
        await user.clear(input); await user.type(input, value!);
      }
    };
    await user.clear(field("School closes")); await user.type(field("School closes"), "16:00");
    await edit(1, "Morning break", "11:00", "10");
    await edit(2, "Lunch", "12:00", "60");
    await user.click(screen.getByRole("button", { name: "Add break" }));
    await edit(3, "Afternoon break", "15:00", "10");
    const preview = within(screen.getByRole("list", { name: "Daily schedule preview" }));
    expect(preview.getByText("11:00 – 11:10")).toBeInTheDocument();
    expect(preview.getByText("12:00 – 13:00")).toBeInTheDocument();
    expect(preview.getByText("15:00 – 15:10")).toBeInTheDocument();
    await user.click(save());
    const breaks = [{ name: "Morning break", start: "11:00", duration: 10 }, { name: "Lunch", start: "12:00", duration: 60 }, { name: "Afternoon break", start: "15:00", duration: 10 }];
    expect(getRow("set_config", "bell")).toMatchObject({ breaks, periodCount: 8, periodLength: 40 });
    expect(getRow("onb_data", "s4")).toMatchObject({ values: { breaks } });
    expect(router.push).toHaveBeenCalledWith("/onboarding/setup/5");
    const saved = getRow("onb_data", "s4")!;
    unmount();
    openStep(4, { onb_data: [saved] });
    expect(screen.getAllByLabelText("Break name")).toHaveLength(3);
    expect(within(screen.getByRole("group", { name: "Break 3" })).getByLabelText("Start time")).toHaveValue("15:00");
  });

  it("blocks incomplete and overlapping breaks and lets an added break be removed", async () => {
    const { user } = openStep(4);
    await user.click(screen.getByRole("button", { name: "Add break" }));
    await user.click(save());
    expect(alertText()).toBe("Break 3: enter a name of up to 80 characters.");
    const row = within(screen.getByRole("group", { name: "Break 3" }));
    await user.type(row.getByLabelText("Break name"), "Afternoon break");
    await user.type(row.getByLabelText("Start time"), "10:35");
    await user.click(save());
    expect(alertText()).toBe("Afternoon break overlaps Morning break.");
    expect(writes).toHaveLength(0);
    await user.click(screen.getByRole("button", { name: "Remove break 3" }));
    expect(screen.queryByRole("group", { name: "Break 3" })).not.toBeInTheDocument();
    await user.click(save());
    expect(getRow("set_config", "bell")).toMatchObject({ breaks: expect.any(Array) });
  });

  it("loads a legacy schedule without losing its saved break times", () => {
    openStep(4, { onb_data: [{ id: "s4", values: { gates: "08:00", start: "09:00", end: "16:00", periods: 8, len: 45, snackAfter: 2, snackMin: 10, lunchAfter: 4, lunchMin: 60 } }] });
    expect(within(screen.getByRole("group", { name: "Break 1" })).getByLabelText("Start time")).toHaveValue("10:30");
    expect(within(screen.getByRole("group", { name: "Break 2" })).getByLabelText("Start time")).toHaveValue("12:10");
  });
});

describe("5 · Fee structure", () => {
  it("saves distinct fees for each senior stream and replaces the old class-wide rate", async () => {
    const { user } = openStep(5, { classes: [
      { id: "cls_11_science_A", grade: "11", section: "A", streamId: "science" },
      { id: "cls_11_commerce_A", grade: "11", section: "A", streamId: "commerce" },
      { id: "cls_12_humanities_A", grade: "12", section: "A", streamId: "humanities" },
    ], fee_structure: [{ id: "fs_11", grade: "11", tuition: 0, lab: 0, library: 0, activity: 0, transport: 0 }] });
    for (const [scope, amount] of [["Grade 11 · Science", "3000"], ["Grade 11 · Commerce", "2200"], ["Grade 12 · Humanities", "2500"]]) {
      await user.click(screen.getByRole("button", { name: "Tuition" }));
      const item = within(screen.getByRole("group", { name: "Fee item 1" }));
      await user.type(item.getByLabelText("Amount per collection (₹)"), amount!);
      await user.click(item.getByText("Applicable classes"));
      await user.click(item.getByRole("button", { name: "Clear" }));
      await user.click(item.getByRole("checkbox", { name: scope }));
    }
    await user.click(save());
    expect(getRow("fee_structure", "fs_11_science")).toMatchObject({ grade: "11", streamId: "science", items: [expect.objectContaining({ amount: 3000, grades: ["11:science"] })] });
    expect(getRow("fee_structure", "fs_11_commerce")).toMatchObject({ grade: "11", streamId: "commerce", items: [expect.objectContaining({ amount: 2200 })] });
    expect(getRow("fee_structure", "fs_12_humanities")).toMatchObject({ grade: "12", streamId: "humanities", items: [expect.objectContaining({ amount: 2500 })] });
    expect(getRow("fee_structure", "fs_11")).toBeUndefined();
    expect(writesTo("fee_invoices")).toHaveLength(0);
  });

  const classes = [{ id: "cls_5A", grade: "5", section: "A" }];
  it("saves class-specific fees without a first due date and restores the configuration", async () => {
    const { user, unmount } = openStep(5, { classes });
    await user.click(save());
    expect(alertText()).toBe("Add at least one fee item.");
    await user.click(screen.getByRole("button", { name: "Tuition" }));
    const item = within(screen.getByRole("group", { name: "Fee item 1" }));
    await user.click(save());
    expect(alertText()).toContain("enter an amount above ₹0");
    await user.type(item.getByLabelText("Amount per collection (₹)"), "2000");
    await user.click(screen.getByRole("button", { name: /^Collapse fee item 1:/ }));
    expect(item.getByLabelText("Amount per collection (₹)")).not.toBeVisible();
    await user.click(screen.getByRole("button", { name: /^Expand fee item 1:/ }));
    expect(item.getByLabelText("Amount per collection (₹)")).toBeVisible();
    expect(item.getByLabelText("Amount per collection (₹)")).toHaveValue(2000);
    expect(writes).toHaveLength(0);
    await user.click(save());
    expect(getRow("fee_structure", "fs_5")).toMatchObject({ schemaVersion: 2, academicYear: "2026-27", items: [expect.objectContaining({ name: "Tuition", amount: 2000, frequency: "Monthly", grades: ["5"], dueDate: "", mandatory: true })] });
    expect(rowsOf("fee_structure")).toHaveLength(1);
    expect(getRow("set_config", "fee_policy")).toMatchObject({ academicYear: "2026-27", upi: true, card: true });
    const saved = getRow("onb_data", "s5")!;
    unmount();
    openStep(5, { classes, onb_data: [saved] });
    expect(screen.getByRole("button", { name: /^Expand fee item 1:/ })).toHaveAttribute("aria-expanded", "false");
    await user.click(screen.getByRole("button", { name: /^Expand fee item 1:/ }));
    expect(screen.getByLabelText("Amount per collection (₹)")).toHaveValue(2000);
    expect(screen.getByLabelText("First due date (optional)")).toHaveValue("");
  });

  it("adds an optional admission-only fee and removes an unwanted item", async () => {
    const { user } = openStep(5, { classes });
    expect(screen.queryByRole("button", { name: "Transport" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Add fee item" }));
    const item = within(screen.getByRole("group", { name: "Fee item 1" }));
    await user.type(item.getByLabelText("Fee name"), "School trip");
    await user.type(item.getByLabelText("Amount per collection (₹)"), "1500");
    await user.selectOptions(item.getByLabelText("Collection frequency"), "One-time");
    await user.type(item.getByLabelText("First due date (optional)"), "2026-11-10");
    await user.selectOptions(item.getByLabelText("Collection type"), "optional");
    await user.selectOptions(item.getByLabelText("Student eligibility"), "new");
    await user.click(screen.getByRole("button", { name: "Annual fee" }));
    expect(screen.getByRole("button", { name: /^Collapse fee item 1: Annual fee/ })).toHaveAttribute("aria-expanded", "true");
    expect(within(screen.getByRole("group", { name: "Fee item 2" })).getByLabelText("Fee name")).toHaveValue("School trip");
    expect(within(screen.getByRole("group", { name: "Fee item 2" })).getByLabelText("Amount per collection (₹)")).toHaveValue(1500);
    await user.click(screen.getByRole("button", { name: "Remove fee item 1" }));
    await user.click(save());
    expect(getRow("fee_structure", "fs_5")).toMatchObject({ items: [expect.objectContaining({ name: "School trip", amount: 1500, frequency: "One-time", mandatory: false, newStudentsOnly: true })] });
  });

  it("preserves general amounts without creating a transport fee item from the old grade rate", async () => {
    const { user } = openStep(5, { classes, fee_structure: [{ id: "old_grade5", grade: "5", tuition: 24000, lab: 3500, activity: 0, library: 0, transport: 900 }] });
    for (const button of screen.getAllByRole("button", { name: /^Expand fee item/ })) await user.click(button);
    await user.click(screen.getByRole("button", { name: /^Collapse fee item 1:/ }));
    expect(within(screen.getByRole("group", { name: "Fee item 1" })).getByLabelText("Amount per collection (₹)")).not.toBeVisible();
    expect(within(screen.getByRole("group", { name: "Fee item 2" })).getByLabelText("Amount per collection (₹)")).toBeVisible();
    await user.click(screen.getByRole("button", { name: /^Expand fee item 1:/ }));
    expect(screen.getAllByLabelText("Amount per collection (₹)").map((input) => (input as HTMLInputElement).value)).toEqual(["24000", "3500"]);
    for (const date of screen.getAllByLabelText("First due date (optional)")) await user.type(date, "2026-11-10");
    await user.click(save());
    expect(getRow("fee_structure", "old_grade5")).toMatchObject({ tuition: 24000, lab: 3500, transport: 900, schemaVersion: 2, items: [expect.objectContaining({ name: "Tuition" }), expect.objectContaining({ name: "Laboratory" })] });
    expect(rowsOf("fee_structure")).toHaveLength(1);
  });

  it("does not save half a fee plan when the batch fails", async () => {
    const item = { id: "tuition", name: "Tuition", amount: 2000, grades: ["5"], frequency: "Monthly", dueDate: "2026-11-10", mandatory: true, newStudentsOnly: false };
    const { user } = openStep(5, { classes, onb_data: [{ id: "s5", values: { schemaVersion: 2, academicYear: "2026-27", termsPerYear: 2, grades: ["5"], items: [item], late: 0, upi: true, card: true } }] });
    failNextWrite();
    await user.click(save());
    expect(await screen.findByText(/Could not save, please try again/)).toBeInTheDocument();
    expect(rowsOf("fee_structure")).toHaveLength(0);
    expect(rowsOf("set_config")).toHaveLength(0);
    expect(router.push).not.toHaveBeenCalled();
  });
});

describe("6 · Staff allocations", () => {
  const secs = [{ id: "sec_grade5", grade: "Grade 5", sections: ["5-A", "5-B"] }];
  it("adds staff with only name, email, and role from setup", async () => {
    const { user } = openStep(6, { set_sections: secs });
    await user.type(field("Name"), " Ravi Kumar ");
    await user.type(field("Email"), "ravi@s.in");
    await user.selectOptions(field("Role"), "teacher");
    await user.click(screen.getByRole("button", { name: "Add" }));
    expect(callableCalls).toEqual([["createSchoolStaff", { name: "Ravi Kumar", email: "ravi@s.in", role: "teacher", invitationId: expect.any(String) }]]);
    expect(sentInvites).toEqual([]);
  });
  it("finishes without staff, class teachers or invitations", async () => {
    const { user } = openStep(6, { set_sections: secs });
    await user.click(save());
    expect(getRow("onb_data", "s6")).toMatchObject({ values: { assign: {}, assigned: 0 } });
    expect(writesTo("staff")).toHaveLength(0);
    expect(writesTo("classes")).toHaveLength(0);
    expect(writesTo("notifications")).toHaveLength(0);
    expect(getRow("onboarding", "state")).toMatchObject({ complete: true, completed: [1, 2, 3, 4, 5, 6] });
    expect(router.push).toHaveBeenCalledWith("/dashboard");
  });
  it("saves partial allocations and explicit removals on the class records", async () => {
    const { user } = openStep(6, {
      set_sections: [{ ...secs[0], sections: ["5-A", "5-B", "5-C"] }],
      staff: [{ id: "stf_001", name: "Anita Sharma", email: "a@s.in", role: "TGT", department: "Science" }, { id: "stf_002", name: "Ravi", email: "r@s.in", role: "PRT", department: "Maths" }],
      classes: [{ id: "cls_5A", grade: "5", section: "A", classTeacherId: "" }, { id: "cls_5B", grade: "5", section: "B", classTeacherId: "stf_002", classTeacher: "Ravi" }],
    });
    // the existing class teacher is pre-selected from the class doc
    expect(screen.getByLabelText("Class for Ravi")).toHaveValue("5-B");
    await user.selectOptions(screen.getByLabelText("Class for Ravi"), "");
    await user.selectOptions(screen.getByLabelText("Class for Anita Sharma"), "5-A");
    await user.click(save());
    expect(getRow("classes", "cls_5A")).toMatchObject({ classTeacherId: "stf_001", classTeacher: "Anita Sharma" });
    expect(getRow("classes", "cls_5B")).toMatchObject({ classTeacherId: "", classTeacher: "" });
    expect(getRow("staff", "stf_001")).not.toHaveProperty("classTeacherOf");
    expect(router.push).toHaveBeenCalledWith("/dashboard");
  });
});
