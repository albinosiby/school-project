import { describe, expect, it } from "vitest";
import { fireEvent } from "@testing-library/react";
import { SettingsPage } from "./SettingsPage";
import { NavLinks, SchoolBadge } from "@/components/shell/Sidebar";
import { callableCalls, dialog, field, fieldError, getRow, renderUI, router, rowsOf, screen, seed, setUrl, uploads, within, writes, writesTo } from "@/test/render";

const profile = { id: "profile", name: "Greenfield International School", affiliation: "1930281", schoolCode: "", email: "office@greenfield.edu", phone: "+91 11 2345 6789", address: "Sector 12, New Delhi", seal: "", digitalKey: "" };
const base = {
  set_config: [profile, { id: "meta", academicYear: "2026-27", rolledOver: false, rolloverStep: 3 }],
  school: [{ id: "school", name: "Greenfield International School", short: "Greenfield Int.", board: "CBSE", affiliation: "1930281", academicYear: "2026-27", term: "Term 2" }],
  set_terms: [{ id: "term_1", name: "Term 1", start: "2026-04-01", end: "2026-09-30", days: 183, status: "Closed" }],
  set_grading: [{ id: "gr_0", grade: "A1", min: 91, point: 10 }, { id: "gr_1", grade: "A2", min: 81, point: 9 }, { id: "gr_8", grade: "E", min: 0, point: 0 }],
};
const saveProfile = () => screen.getByRole("button", { name: "Save school profile" });

it("manages timetable periods from Settings and removes its primary navigation link", async () => {
  seed({ ...base, staff: [{ id: "teacher", name: "Anita Sharma", category: "Teaching", department: "Mathematics" }] });
  const { user } = renderUI(<><NavLinks /><SettingsPage /></>);
  expect(within(screen.getByRole("navigation", { name: "Primary" })).queryByRole("link", { name: "Timetable" })).not.toBeInTheDocument();
  await user.click(screen.getByRole("tab", { name: "Timetable" }));
  expect(router.replace).toHaveBeenCalledWith("/settings?section=timetable", { scroll: false });
  const panel = screen.getByRole("tabpanel", { name: "Timetable" });
  expect(within(panel).getByRole("heading", { name: "Timetable", level: 2 })).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: /School Profile/ })).not.toBeInTheDocument();
  await user.click(within(panel).getByRole("button", { name: "Mon period 1 empty" }));
  const editor = dialog("Add period");
  await user.selectOptions(field("Subject", editor), "Mathematics");
  await user.selectOptions(field("Teacher", editor), "teacher");
  await user.click(within(editor).getByRole("button", { name: "Save" }));
  expect(getRow("ops_periods", "per_10B_Mon_1")).toMatchObject({ subject: "Mathematics", teacherId: "teacher", classId: "cls_10B" });
  expect(within(panel).queryByRole("tab", { name: "Substitutions" })).not.toBeInTheDocument();
  expect(within(panel).queryByRole("button", { name: "Assign substitute" })).not.toBeInTheDocument();
  await user.click(screen.getByRole("tab", { name: "School Profile" }));
  expect(screen.queryByRole("tabpanel", { name: "Timetable" })).not.toBeInTheDocument();
  expect(saveProfile()).toBeInTheDocument();
});

it("opens timetable deep links and follows section changes without showing unrelated settings", async () => {
  seed(base);
  setUrl("/settings?section=timetable");
  const view = renderUI(<SettingsPage />);
  expect(screen.getByRole("tab", { name: "Timetable" })).toHaveAttribute("aria-selected", "true");
  expect(screen.getByRole("tabpanel", { name: "Timetable" })).toBeInTheDocument();
  setUrl("/settings?section=subjects");
  view.rerender(<SettingsPage />);
  expect(screen.getByRole("tabpanel", { name: "Classes & Sections" })).toBeInTheDocument();
  expect(screen.getByRole("tab", { name: "Classes & Sections" })).toHaveAttribute("aria-selected", "true");
  expect(screen.queryByRole("tab", { name: "Subjects & Departments" })).not.toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Subjects & Departments" })).not.toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Timetable" })).not.toBeInTheDocument();
  await view.user.click(screen.getByRole("tab", { name: "School Profile" }));
  expect(router.replace).toHaveBeenCalledWith("/settings", { scroll: false });
  expect(saveProfile()).toBeInTheDocument();
});

it("saves a new employee ID pattern without resetting the issued sequence", async () => {
  seed({ ...base, set_config: [...base.set_config, { id: "staff_numbering", template: "EMP-{SEQ:4}", start: 1, next: 28 }] });
  const { user } = renderUI(<SettingsPage />);
  await user.click(screen.getByRole("tab", { name: "Employee IDs" }));
  fireEvent.change(field("Employee ID pattern"), { target: { value: "FC{YEAR}{SEQ:4}" } });
  fireEvent.change(field("Employee ID starting number"), { target: { value: "10" } });
  expect(screen.getByText(/Preview · FC\d{4}0028/)).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Save employee ID numbering" }));
  expect(getRow("set_config", "staff_numbering")).toMatchObject({ template: "FC{YEAR}{SEQ:4}", start: 10, next: 28 });
});

describe("School profile", () => {
  it("publishes a school logo to the sidebar as soon as the upload finishes", async () => {
    seed(base);
    renderUI(<><aside><SchoolBadge /></aside><SettingsPage /></>);
    const control = field("Upload school logo");
    fireEvent.change(control, { target: { files: [new File(["logo"], "logo.svg", { type: "image/svg+xml" })] } });
    expect(screen.getByRole("alert")).toHaveTextContent("Choose a PNG or JPEG image up to 2 MB.");
    expect(uploads).toHaveLength(0);

    fireEvent.change(control, { target: { files: [new File(["logo"], "crest.png", { type: "image/png" })] } });
    expect(await screen.findByText("School logo updated")).toBeInTheDocument();
    expect(uploads).toEqual([expect.objectContaining({ path: expect.stringMatching(/^schools\/sch_test\/branding\/logo-/), type: "image/png" })]);
    expect(getRow("school", "school")).toMatchObject({ name: base.school[0].name, logoUrl: expect.stringContaining(uploads[0].path) });
    expect(within(screen.getByRole("complementary")).getByAltText("")).toHaveAttribute("src", expect.stringContaining(uploads[0].path));
    expect(screen.getByAltText("School logo preview")).toBeInTheDocument();
    expect(field("Replace school logo")).toBeEnabled();
  });

  it("loads each stored campus address field and saves a formatted address", async () => {
    const campus = { addressLine1: "School Road", addressLine2: "Near the library", country: "IN",
      state: "IN.13", district: "IN.13.595", city: "Kochi", pin: "682001" };
    const address = "School Road\nNear the library\nKochi, Ernakulam, Kerala, 682001\nIndia";
    const onboardingProfile = { id: profile.id, name: profile.name, affiliation: profile.affiliation,
      email: profile.email, phone: profile.phone, ...campus, address };
    seed({ ...base, set_config: [onboardingProfile, base.set_config[1]] });
    const { user } = renderUI(<SettingsPage />);
    const location = screen.getByRole("group", { name: "Campus physical location" });
    for (const [label, value] of [["Address line 1", campus.addressLine1], ["Address line 2", campus.addressLine2],
      ["Country", campus.country], ["State", campus.state], ["District", campus.district], ["City", campus.city], ["PIN code", campus.pin]]) {
      expect(field(label, location)).toHaveValue(value);
    }
    expect(screen.getByText((_, element) => element?.tagName === "P" && element.textContent === address)).toHaveClass("whitespace-pre-wrap");

    fireEvent.change(field("City", location), { target: { value: "Edappally" } });
    await user.click(saveProfile());
    expect(getRow("set_config", "profile")).toMatchObject({ ...campus, city: "Edappally", address: address.replace("Kochi", "Edappally") });
    expect(getRow("school", "school")).toMatchObject({ city: "Edappally" });
  });

  it("keeps a legacy text address visible and saves unrelated edits without splitting it", async () => {
    seed(base);
    const { user } = renderUI(<SettingsPage />);
    const location = screen.getByRole("group", { name: "Campus physical location" });
    expect(field("Address line 1", location)).toHaveValue("");
    expect(screen.getByText(`Saved address: ${profile.address}`)).toBeInTheDocument();
    fireEvent.change(field("OFFICIAL INSTITUTION NAME"), { target: { value: "Updated school name" } });
    await user.click(saveProfile());
    expect(getRow("set_config", "profile")).toMatchObject({ name: "Updated school name", address: profile.address });
  });

  it("shows the field errors and writes nothing when invalid", async () => {
    seed(base);
    const { user } = renderUI(<SettingsPage />);
    await user.clear(field("OFFICIAL INSTITUTION NAME"));
    await user.clear(field("OFFICIAL ADMINISTRATIVE EMAIL")); await user.type(field("OFFICIAL ADMINISTRATIVE EMAIL"), "office@greenfield");
    await user.clear(field("REGISTRAR PBX HOTLINE")); await user.type(field("REGISTRAR PBX HOTLINE"), "12345");
    await user.clear(field("CBSE AFFILIATION NO."));
    await user.type(field("Address line 1"), " ");

    await user.click(saveProfile());
    expect(fieldError("OFFICIAL INSTITUTION NAME")).toBe("Institution name is required");
    expect(fieldError("OFFICIAL ADMINISTRATIVE EMAIL")).toBe("Enter a valid email");
    expect(fieldError("REGISTRAR PBX HOTLINE")).toBe("Enter a valid phone number");
    expect(fieldError("CBSE AFFILIATION NO.")).toBe("Required");
    expect(fieldError("Address line 1")).toBe("Address line 1 is required.");
    expect(await screen.findByText("Fix the highlighted fields")).toBeInTheDocument();
    expect(writes).toHaveLength(0);
  });

  it("saves set_config/profile and keeps school/school (read by the apps) in step", async () => {
    seed(base);
    const { user } = renderUI(<SettingsPage />);
    await user.clear(field("CBSE AFFILIATION NO.")); await user.type(field("CBSE AFFILIATION NO."), "1930999");
    await user.click(saveProfile());
    expect(getRow("set_config", "profile")).toMatchObject({ affiliation: "1930999" });
    expect(getRow("school", "school")).toMatchObject({ name: "Greenfield International School", affiliation: "1930999", board: "CBSE", term: "Term 2" });
    expect(await screen.findByText("School profile saved")).toBeInTheDocument();
    expect(rowsOf("set_audit")).toEqual([expect.objectContaining({ action: "Saved school profile", actor: "Administrator" })]);
  });

  it("creates school/school when it is missing", async () => {
    seed({ ...base, school: [] });
    const { user } = renderUI(<SettingsPage />);
    await user.click(saveProfile());
    expect(getRow("school", "school")).toMatchObject({ name: "Greenfield International School", short: "Greenfield International School", affiliation: "1930281" });
  });
});

describe("Grading bands", () => {
  it("refuses a lower grade with an equal or higher minimum", async () => {
    seed(base);
    const { user } = renderUI(<SettingsPage />);
    await user.click(screen.getByRole("tab", { name: "Grading" }));
    fireEvent.change(screen.getByLabelText("Minimum percent for A2"), { target: { value: "95" } });
    await user.click(screen.getByRole("button", { name: "Save grading" }));
    expect(screen.getByRole("alert").textContent).toBe("A1 must need a higher percentage than A2");
    expect(writes).toHaveLength(0);
  });

  it("saves a valid band minimum", async () => {
    seed(base);
    const { user } = renderUI(<SettingsPage />);
    await user.click(screen.getByRole("tab", { name: "Grading" }));
    fireEvent.change(screen.getByLabelText("Minimum percent for A2"), { target: { value: "85" } });
    await user.click(screen.getByRole("button", { name: "Save grading" }));
    expect(getRow("set_grading", "gr_1")).toMatchObject({ min: 85 });
  });
});

it("shows live bell summaries and links to the structured timetable editor without saving unrelated drafts", async () => {
  seed(base);
  const { user } = renderUI(<SettingsPage />);
  expect(screen.queryByRole("heading", { name: /Academic Year & Term/ })).not.toBeInTheDocument();
  await user.clear(field("OFFICIAL INSTITUTION NAME"));
  await user.click(screen.getByRole("tab", { name: "Academic Year" }));
  const academic = screen.getByRole("tabpanel", { name: "Academic Year" });
  expect(within(academic).getByRole("heading", { name: /Academic Year & Term/ })).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: /School Profile|Grading Scheme|Recent audit trail/ })).not.toBeInTheDocument();
  expect(field("Gates open", academic)).toHaveAttribute("readonly");
  expect(within(academic).getByRole("link", { name: "Edit school hours & breaks in Timetable" })).toHaveAttribute("href", "/settings?section=timetable#school-timings");
  expect(writesTo("set_config")).toHaveLength(0);
  await user.click(screen.getByRole("tab", { name: "School Profile" }));
  expect(field("OFFICIAL INSTITUTION NAME")).toHaveValue("");
});

describe("Terms", () => {
  async function newTerm() {
    seed(base);
    const r = renderUI(<SettingsPage />);
    await r.user.click(screen.getByRole("tab", { name: "Academic Year" }));
    await r.user.click(screen.getByRole("button", { name: /New Term/ }));
    return { ...r, dlg: dialog("New term") };
  }

  it("requires an end date after the start", async () => {
    const { user, dlg } = await newTerm();
    fireEvent.change(field("Start", dlg), { target: { value: "2027-04-01" } });
    fireEvent.change(field("End", dlg), { target: { value: "2027-03-01" } });
    await user.click(within(dlg).getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Pick a start and an end date after it")).toBeInTheDocument();
    expect(writes).toHaveLength(0);
  });

  it("refuses dates overlapping another term", async () => {
    const { user, dlg } = await newTerm();
    fireEvent.change(field("Start", dlg), { target: { value: "2026-09-01" } });
    fireEvent.change(field("End", dlg), { target: { value: "2026-12-31" } });
    await user.click(within(dlg).getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Dates overlap Term 1")).toBeInTheDocument();
    expect(writes).toHaveLength(0);
  });

  it("an In Progress term becomes school/school.term", async () => {
    const { user, dlg } = await newTerm();
    expect(field("Name", dlg).value).toBe("Term 2");
    fireEvent.change(field("Start", dlg), { target: { value: "2026-10-01" } });
    fireEvent.change(field("End", dlg), { target: { value: "2027-03-31" } });
    await user.clear(field("Name", dlg)); await user.type(field("Name", dlg), "Term 2 (Spring)");
    await user.click(within(dlg).getByRole("button", { name: "Save" }));
    expect(rowsOf("set_terms")).toContainEqual(expect.objectContaining({ name: "Term 2 (Spring)", start: "2026-10-01", end: "2027-03-31", days: 182, status: "In Progress" }));
    expect(getRow("school", "school")).toMatchObject({ term: "Term 2 (Spring)" });
  });
});

describe("Capacity matrix", () => {
  it("uses the grade drawer for capacity setup and validates section capacity before writing", async () => {
    seed({ ...base, set_config: [...base.set_config, { id: "subjects", subjects: [{ name: "Mathematics", active: true }] }] });
    const { user } = renderUI(<SettingsPage />);
    await user.click(screen.getByRole("tab", { name: "Classes & Sections" }));
    expect(screen.queryByRole("button", { name: "New Section" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Add grade" }));
    const dlg = dialog("Add grade");
    const err = () => within(dlg).getByRole("alert").textContent;
    await user.selectOptions(field("Grade", dlg), "9");
    await user.click(within(dlg).getByRole("button", { name: "Next" }));
    fireEvent.change(field("Section A seats", dlg), { target: { value: "0" } });
    await user.click(within(dlg).getByRole("button", { name: "Next" }));
    expect(err()).toBe("Capacity of section A must be a whole number of at least 1");
    fireEvent.change(field("Section A seats", dlg), { target: { value: "1.5" } });
    await user.click(within(dlg).getByRole("button", { name: "Next" }));
    expect(err()).toBe("Capacity of section A must be a whole number of at least 1");
    expect(writes).toHaveLength(0);
    fireEvent.change(field("Section A seats", dlg), { target: { value: "40" } });
    await user.click(within(dlg).getByRole("button", { name: "Next" }));
    await user.selectOptions(field("Add subject to Grade 9", dlg), "Mathematics");
    await user.click(within(dlg).getByRole("button", { name: "Create grade" }));
    expect(getRow("set_sections", "sec_grade9")).toMatchObject({ grade: "Grade 9", sections: ["9-A"], cap: 40 });
    expect(getRow("adm_seats", "adm_seat_9")).toMatchObject({ capacity: 40 });
  });
});

describe("Year-end rollover", () => {
  it("requires a reviewed plan, sign-off and exact confirmation, then starts the backend job", async () => {
    seed(base);
    const { user } = renderUI(<SettingsPage />);
    await user.click(screen.getByRole("tab", { name: "Year-End Rollover" }));
    await user.click(screen.getByRole("button", { name: "Review promotion plan" }));
    const start = await screen.findByRole("button", { name: "Start rollover to 2027-28" });
    expect(start).toBeDisabled();
    await user.click(screen.getByRole("checkbox", { name: /I confirm that final marks/ }));
    await user.click(start);
    const dlg = dialog("Start 2027-28 rollover?");
    const execute = within(dlg).getByRole("button", { name: "Execute rollover" });
    await user.type(field('Type "ROLLOVER" to confirm', dlg), "rollover");
    expect(execute).toBeDisabled();
    await user.clear(field('Type "ROLLOVER" to confirm', dlg)); await user.type(field('Type "ROLLOVER" to confirm', dlg), "ROLLOVER");
    await user.click(execute);
    expect(callableCalls.find(([name, input]) => name === "manageAcademicRollover" && (input as {action:string}).action === "execute")?.[1]).toMatchObject({ fromYear:"2026-27",planHash:"reviewed-test-plan",signed:true,confirm:"ROLLOVER" });
    expect(getRow("set_config", "meta")).toMatchObject({ academicYear:"2026-27",rolledOver:false });
    expect(screen.getByText("School records are locked while this job runs. It continues if you close this page.")).toBeInTheDocument();
  });
});

it("configures exam types and a class group's subject scheme under Assessment Scheme", async () => {
  seed({ ...base, classes: [{ id: "cls_5A", grade: "5", section: "A" }], set_config: [...base.set_config, { id: "subjects", subjects: [{ name: "Mathematics", active: true }] }] });
  const { user } = renderUI(<SettingsPage />);
  await user.click(screen.getByRole("tab", { name: "Assessment Scheme" }));
  await user.click(screen.getByRole("button", { name: "Add CBSE starter set" }));
  expect(getRow("set_exam_types", "ext_half_yearly_examination")).toMatchObject({ termId: "term_1", weight: 80, pattern: "scheme" });
  expect(rowsOf("set_exam_types")).toHaveLength(6);
  await user.click(screen.getByRole("button", { name: "New exam type" }));
  const editor = dialog("New exam type");
  fireEvent.change(field("Name", editor), { target: { value: "Pre-Board" } });
  fireEvent.change(field("Short code", editor), { target: { value: "pb" } });
  fireEvent.change(field("Weight in term (%)", editor), { target: { value: "100" } });
  await user.selectOptions(field("Marks pattern", editor), "single");
  fireEvent.change(field("Maximum marks per subject", editor), { target: { value: "100" } });
  await user.click(within(editor).getByRole("button", { name: "Save exam type" }));
  expect(getRow("set_exam_types", "ext_pre_board")).toMatchObject({ name: "Pre-Board", short: "PB", pattern: "single", singleMax: 100, weight: 100 });
  await user.selectOptions(field("Add subject to Grade 5"), "Mathematics");
  const row = screen.getByRole("region", { name: "Mathematics scheme row" });
  fireEvent.change(field("Theory maximum", row), { target: { value: "50" } });
  fireEvent.change(field("Internal maximum", row), { target: { value: "50" } });
  await user.click(screen.getByRole("button", { name: "Create scheme" }));
  expect(getRow("set_subject_schemes", "scheme_5")).toMatchObject({ groupKey: "5:", grade: "5", subjects: [expect.objectContaining({ subject: "Mathematics", theory: 50, internal: 50, enteredBy: "subjectTeacher" })] });
});

describe("Grades in Classes & Sections", () => {
  it("lists grades in school order with links to their pages, and creates a grade with sections, classes and subjects from the drawer", async () => {
    seed({ ...base, set_config: [...base.set_config, { id: "subjects", subjects: [{ name: "Mathematics", active: true }, { name: "Science", active: true }] }],
      set_sections: [
        { id: "sec_grade10", grade: "Grade 10", stream: "Secondary", sections: ["10-A"], roster: 0, cap: 40 },
        { id: "sec_grade2", grade: "Grade 2", stream: "Primary", sections: ["2-A"], roster: 0, cap: 40 },
        { id: "sec_lkg", grade: "LKG", stream: "Pre-Primary", sections: ["LKG-A"], roster: 0, cap: 30 },
      ] });
    const { user } = renderUI(<SettingsPage />);
    await user.click(screen.getByRole("tab", { name: "Classes & Sections" }));
    const links = screen.getAllByRole("link", { name: /^Open / });
    expect(links.map((link) => link.textContent)).toEqual(["LKG", "Grade 2", "Grade 10"]);
    expect(screen.getAllByRole("heading", { level: 3, name: /^(Pre-Primary|Primary|Middle|Secondary)$/ }).map((cell) => cell.textContent)).toEqual(["Pre-Primary", "Primary", "Secondary"]);
    const senior = screen.getByRole("region", { name: "Senior Secondary" });
    expect(within(senior).getByRole("button", { name: "Add department" })).toBeInTheDocument();
    expect(screen.getByText(/No departments yet/)).toBeInTheDocument();
    expect(links[2]).toHaveAttribute("href", "/settings/grades/sec_grade10");
    await user.click(within(screen.getByRole("row", { name: "Grade 2 row" })).getByText("0 / 40"));
    expect(router.push).toHaveBeenCalledWith("/settings/grades/sec_grade2");
    await user.click(screen.getByRole("button", { name: "Add grade" }));
    const drawer = dialog("Add grade");
    await user.selectOptions(field("Grade", drawer), "9");
    fireEvent.change(field("Total seats", drawer), { target: { value: "65" } });
    await user.click(within(drawer).getByRole("button", { name: "Next" }));
    await user.selectOptions(field("Sections", drawer), "2");
    fireEvent.change(field("Section A seats", drawer), { target: { value: "40" } });
    fireEvent.change(field("Section B seats", drawer), { target: { value: "25" } });
    await user.click(within(drawer).getByRole("button", { name: "Next" }));
    await user.selectOptions(field("Add subject to Grade 9", drawer), "Mathematics");
    await user.click(within(drawer).getByRole("button", { name: "Create grade" }));
    expect(getRow("set_sections", "sec_grade9")).toMatchObject({ grade: "Grade 9", stream: "Secondary", sections: ["9-A", "9-B"], cap: 65 });
    expect(getRow("classes", "cls_9A")).toMatchObject({ grade: "9", section: "A", capacity: 40, classTeacherId: "" });
    expect(getRow("classes", "cls_9B")).toMatchObject({ grade: "9", section: "B", capacity: 25 });
    expect(getRow("adm_seats", "adm_seat_9")).toMatchObject({ grade: "9", capacity: 65 });
    expect(getRow("set_subject_schemes", "scheme_9")).toMatchObject({ groupKey: "9:", subjects: [expect.objectContaining({ subject: "Mathematics", theory: 80, internal: 20 })] });
    expect(router.push).toHaveBeenCalledWith("/settings/grades/sec_grade9");
  });
  it("refuses a grade that is already configured", async () => {
    seed({ ...base, set_sections: [{ id: "sec_lkg", grade: "LKG", stream: "Pre-Primary", sections: ["LKG-A"], roster: 0, cap: 30 }] });
    const { user } = renderUI(<SettingsPage />);
    await user.click(screen.getByRole("tab", { name: "Classes & Sections" }));
    await user.click(screen.getByRole("button", { name: "Add grade" }));
    const drawer = dialog("Add grade");
    expect(within(drawer).queryByRole("option", { name: "LKG" })).not.toBeInTheDocument();
    expect(field("Grade", drawer)).toHaveValue("UKG");
  });
});
