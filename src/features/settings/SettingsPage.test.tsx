import { describe, expect, it } from "vitest";
import { fireEvent } from "@testing-library/react";
import { SettingsPage } from "./SettingsPage";
import { dialog, field, fieldError, getRow, renderUI, rowsOf, screen, seed, within, writes, writesTo } from "@/test/render";

const profile = { id: "profile", name: "Greenfield International School", affiliation: "1930281", schoolCode: "", email: "office@greenfield.edu", phone: "+91 11 2345 6789", address: "Sector 12, New Delhi", seal: "", digitalKey: "" };
const base = {
  set_config: [profile, { id: "meta", academicYear: "2026-27", rolledOver: false, rolloverStep: 3 }],
  school: [{ id: "school", name: "Greenfield International School", short: "Greenfield Int.", board: "CBSE", affiliation: "1930281", academicYear: "2026-27", term: "Term 2" }],
  set_terms: [{ id: "term_1", name: "Term 1", start: "2026-04-01", end: "2026-09-30", days: 183, status: "Closed" }],
  set_grading: [{ id: "gr_0", grade: "A1", min: 91, point: 10 }, { id: "gr_1", grade: "A2", min: 81, point: 9 }, { id: "gr_8", grade: "E", min: 0, point: 0 }],
};
const saveAll = () => screen.getByRole("button", { name: /Save All Settings/ });

describe("School profile", () => {
  it("shows the field errors and writes nothing when invalid", async () => {
    seed(base);
    const { user } = renderUI(<SettingsPage />);
    await user.clear(field("OFFICIAL INSTITUTION NAME"));
    await user.clear(field("OFFICIAL ADMINISTRATIVE EMAIL")); await user.type(field("OFFICIAL ADMINISTRATIVE EMAIL"), "office@greenfield");
    await user.clear(field("REGISTRAR PBX HOTLINE")); await user.type(field("REGISTRAR PBX HOTLINE"), "12345");
    await user.clear(field("CBSE AFFILIATION NO."));
    await user.clear(field("CAMPUS PHYSICAL LOCATION"));
    await user.click(saveAll());
    expect(fieldError("OFFICIAL INSTITUTION NAME")).toBe("Institution name is required");
    expect(fieldError("OFFICIAL ADMINISTRATIVE EMAIL")).toBe("Enter a valid email");
    expect(fieldError("REGISTRAR PBX HOTLINE")).toBe("Enter a valid phone number");
    expect(fieldError("CBSE AFFILIATION NO.")).toBe("Required");
    expect(fieldError("CAMPUS PHYSICAL LOCATION")).toBe("Required");
    expect(await screen.findByText("Fix the highlighted fields")).toBeInTheDocument();
    expect(writes).toHaveLength(0);
  });

  it("saves set_config/profile and keeps school/school (read by the apps) in step", async () => {
    seed(base);
    const { user } = renderUI(<SettingsPage />);
    await user.clear(field("CBSE AFFILIATION NO.")); await user.type(field("CBSE AFFILIATION NO."), "1930999");
    await user.click(saveAll());
    expect(getRow("set_config", "profile")).toMatchObject({ affiliation: "1930999" });
    expect(getRow("school", "school")).toMatchObject({ name: "Greenfield International School", affiliation: "1930999", board: "CBSE", term: "Term 2" });
    expect(await screen.findByText("All settings saved")).toBeInTheDocument();
    expect(rowsOf("set_audit")).toEqual([expect.objectContaining({ action: "Saved settings", actor: "Administrator" })]);
  });

  it("creates school/school when it is missing", async () => {
    seed({ ...base, school: [] });
    const { user } = renderUI(<SettingsPage />);
    await user.click(saveAll());
    expect(getRow("school", "school")).toMatchObject({ name: "Greenfield International School", short: "Greenfield International School", affiliation: "1930281" });
  });
});

describe("Grading bands", () => {
  it("refuses a lower grade with an equal or higher minimum", async () => {
    seed(base);
    const { user } = renderUI(<SettingsPage />);
    fireEvent.change(screen.getByLabelText("Minimum percent for A2"), { target: { value: "95" } });
    await user.click(saveAll());
    expect(screen.getByRole("alert").textContent).toBe("A1 must need a higher percentage than A2");
    expect(writes).toHaveLength(0);
  });

  it("saves a valid band minimum", async () => {
    seed(base);
    const { user } = renderUI(<SettingsPage />);
    fireEvent.change(screen.getByLabelText("Minimum percent for A2"), { target: { value: "85" } });
    await user.click(saveAll());
    expect(getRow("set_grading", "gr_1")).toMatchObject({ min: 85 });
  });
});

describe("Terms", () => {
  async function newTerm() {
    seed(base);
    const r = renderUI(<SettingsPage />);
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
  it("validates sections, capacity and roster", async () => {
    seed(base);
    const { user } = renderUI(<SettingsPage />);
    await user.click(screen.getByRole("button", { name: /New Section/ }));
    const dlg = dialog("New section");
    const err = () => within(dlg).getByRole("alert").textContent;
    await user.click(within(dlg).getByRole("button", { name: "Save" }));
    expect(err()).toBe("Grade and at least one section are required");
    await user.type(field("Grade level", dlg), "Grade 9");
    await user.type(field("Sections (comma separated)", dlg), "9-A, 9-a");
    await user.click(within(dlg).getByRole("button", { name: "Save" }));
    expect(err()).toBe("Sections must be unique");
    await user.clear(field("Sections (comma separated)", dlg)); await user.type(field("Sections (comma separated)", dlg), "9-A, 9-B");
    fireEvent.change(field("Capacity", dlg), { target: { value: "0" } });
    await user.click(within(dlg).getByRole("button", { name: "Save" }));
    expect(err()).toBe("Capacity must be a whole number of at least 1");
    fireEvent.change(field("Capacity", dlg), { target: { value: "40" } });
    fireEvent.change(field("Roster", dlg), { target: { value: "41" } });
    await user.click(within(dlg).getByRole("button", { name: "Save" }));
    expect(err()).toBe("Roster must be a whole number between 0 and the capacity");
    expect(writes).toHaveLength(0);
    fireEvent.change(field("Roster", dlg), { target: { value: "38" } });
    await user.click(within(dlg).getByRole("button", { name: "Save" }));
    expect(rowsOf("set_sections")).toEqual([expect.objectContaining({ grade: "Grade 9", sections: ["9-A", "9-B"], roster: 38, cap: 40 })]);
  });
});

describe("Year-end rollover", () => {
  it("needs the sign-off and the typed confirmation, then marks the year rolled over", async () => {
    seed(base);
    const { user } = renderUI(<SettingsPage />);
    const exec = screen.getByRole("button", { name: /Execute AY 2027-28 Rollover/ });
    expect(exec).toBeDisabled();
    await user.click(screen.getByRole("checkbox", { name: /I confirm that Term 2 final marks/ }));
    await user.click(exec);
    const dlg = dialog("Execute AY 2027-28 rollover?");
    const go = within(dlg).getByRole("button", { name: "Execute rollover" });
    await user.type(field('Type "ROLLOVER" to confirm', dlg), "rollover");
    expect(go).toBeDisabled();
    await user.clear(field('Type "ROLLOVER" to confirm', dlg)); await user.type(field('Type "ROLLOVER" to confirm', dlg), "ROLLOVER");
    await user.click(go);
    expect(getRow("set_config", "meta")).toMatchObject({ rolledOver: true, rolloverStep: 4 });
    expect(writesTo("set_audit")).toHaveLength(1);
  });
});
