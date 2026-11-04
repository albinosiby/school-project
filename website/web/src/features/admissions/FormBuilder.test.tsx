import { describe, expect, it } from "vitest";
import { FormBuilder } from "./FormBuilder";
import { DynamicForm } from "./DynamicForm";
import { dialog, field, fieldError, getRow, renderUI, screen, seed, within, writes } from "@/test/render";
import type { FormDoc, FormSection } from "./types";

const sections: FormSection[] = [{ id: "sec_basic", title: "Candidate Basic Information", description: "", mandatory: true, fields: [
  { id: "f_name", key: "name", label: "Student Full Name", type: "text", required: true, core: true },
  { id: "f_blood", key: "bloodGroup", label: "Blood Group", type: "select", required: false, options: ["A+", "B+"] },
] }];
const form: FormDoc = { id: "form", name: "Admission Form", version: 1, status: "published", publishedAt: "2026-11-01T10:00:00Z", publishedBy: "Setup", sections, published: sections, history: [{ version: 1, at: "2026-11-01T10:00:00Z", by: "Setup", note: "Default" }] };
const config = { id: "config", appFee: 2500, tokenAmount: 50000, offerValidityDays: 7, submissionCap: 500, safeguards: { razorpay: false, otp: false, dedupe: true, receipts: false }, marketingSpend: {}, stats: { scansToday: 0, visitors: 0, begun: 0, hourly: [] } };

async function addField() {
  seed({ adm_form: [form as never], adm_config: [config], me: [{ id: "me", name: "Principal Rao" }] });
  const r = renderUI(<FormBuilder />);
  await r.user.click(screen.getByRole("button", { name: /Add Field to Candidate Basic Information/ }));
  return { ...r, d: dialog("Add field") };
}
const fieldsOf = () => (getRow<FormDoc>("adm_form", "form")!.sections[0]!.fields);

describe("Form builder — add field", () => {
  it("requires a label", async () => {
    const { user, d } = await addField();
    await user.click(within(d).getByRole("button", { name: "Save field" }));
    expect(fieldError("Label", d)).toBe("Label is required");
    expect(writes).toHaveLength(0);
  });
  it("needs at least two options for a dropdown", async () => {
    const { user, d } = await addField();
    await user.type(field("Label", d), "House");
    await user.selectOptions(field("Field type", d), "select");
    await user.type(field("Options (one per line)", d), "Red{enter}red");
    await user.click(within(d).getByRole("button", { name: "Save field" }));
    expect(fieldError("Options (one per line)", d)).toBe("Add at least two options (one per line)");
    expect(writes).toHaveLength(0);
  });
  it("refuses a key another field already uses", async () => {
    const { user, d } = await addField();
    await user.type(field("Label", d), "Blood type");
    await user.type(field("Field key", d), "bloodGroup");
    await user.click(within(d).getByRole("button", { name: "Save field" }));
    expect(fieldError("Field key", d)).toBe('Another field already uses the key "bloodGroup"');
    await user.clear(field("Field key", d));
    await user.type(field("Field key", d), "2nd");
    await user.click(within(d).getByRole("button", { name: "Save field" }));
    expect(fieldError("Field key", d)).toBe("Key must start with a letter and use only letters, digits and _");
    expect(writes).toHaveLength(0);
  });
  it("saves the field to the draft schema with a generated key and the options", async () => {
    const { user, d } = await addField();
    await user.type(field("Label", d), "  Transport Needed ");
    await user.selectOptions(field("Field type", d), "radio");
    await user.type(field("Options (one per line)", d), "Yes{enter}No");
    await user.click(within(d).getByRole("checkbox", { name: "Required" }));
    await user.click(within(d).getByRole("button", { name: "Save field" }));
    const f = fieldsOf()[2]!;
    expect(f).toMatchObject({ key: "transport_needed", label: "Transport Needed", type: "radio", required: true, options: ["Yes", "No"] });
    expect(f.id).toMatch(/^f_/);
    // the published schema is untouched until Publish
    expect(getRow<FormDoc>("adm_form", "form")!.published[0]!.fields).toHaveLength(2);
  });
  it("suffixes a generated key that collides", async () => {
    const { user, d } = await addField();
    await user.type(field("Label", d), "Name");
    await user.click(within(d).getByRole("button", { name: "Save field" }));
    expect(fieldsOf()[2]!.key).toBe("name_2");
  });
  it("publishing bumps the version and records the release note", async () => {
    const { user, d } = await addField();
    await user.type(field("Label", d), "Allergies");
    await user.click(within(d).getByRole("button", { name: "Save field" }));
    await user.click(screen.getByRole("button", { name: "Publish v2" }));
    const p = dialog("Publish v2");
    await user.type(field("Release note", p), "Added allergies");
    await user.click(within(p).getByRole("button", { name: "Publish now" }));
    const doc = getRow<FormDoc>("adm_form", "form")!;
    expect(doc).toMatchObject({ version: 2, status: "published", publishedBy: "Principal Rao" });
    expect(doc.published[0]!.fields.map((x) => x.key)).toEqual(["name", "bloodGroup", "allergies"]);
    expect(doc.history[0]).toMatchObject({ version: 2, by: "Principal Rao", note: "Added allergies" });
  });
});

describe("DynamicForm validation", () => {
  const live: FormSection[] = [{ id: "s", title: "Details", description: "", mandatory: true, fields: [
    { id: "1", key: "name", label: "Student Full Name", type: "text", required: true },
    { id: "2", key: "phone", label: "WhatsApp Number", type: "tel", required: true },
    { id: "3", key: "email", label: "Email Address", type: "email", required: false },
    { id: "4", key: "aadhaar", label: "Aadhaar", type: "text", required: false },
    { id: "5", key: "gender", label: "Gender", type: "radio", required: true, options: ["Male", "Female"] },
  ] }];
  it("shows the exact errors and does not submit", async () => {
    const calls: Record<string, string>[] = [];
    const { user } = renderUI(<DynamicForm sections={live} onSubmit={(v) => { calls.push(v); }} />);
    await user.click(screen.getByRole("button", { name: "Submit enquiry" }));
    expect(fieldError("Student Full Name")).toBe("Student Full Name is required");
    expect(fieldError("WhatsApp Number")).toBe("WhatsApp Number is required");
    expect(screen.getByText("Gender is required")).toBeInTheDocument();
    await user.type(field("WhatsApp Number"), "12345");
    await user.type(field("Email Address"), "a@b");
    await user.type(field("Aadhaar"), "1234");
    await user.click(screen.getByRole("button", { name: "Submit enquiry" }));
    expect(fieldError("WhatsApp Number")).toBe("Enter a valid mobile number");
    expect(fieldError("Email Address")).toBe("Enter a valid email address");
    expect(fieldError("Aadhaar")).toBe("Aadhaar must be 12 digits");
    expect(calls).toHaveLength(0);
  });
  it("submits trimmed-valid answers and clears the form", async () => {
    const calls: Record<string, string>[] = [];
    const { user } = renderUI(<DynamicForm sections={live} onSubmit={(v) => { calls.push(v); }} />);
    await user.type(field("Student Full Name"), "Riya");
    await user.type(field("WhatsApp Number"), "+91 98100 00001");
    await user.click(screen.getByRole("radio", { name: "Female" }));
    await user.click(screen.getByRole("button", { name: "Submit enquiry" }));
    expect(calls).toEqual([{ name: "Riya", phone: "+91 98100 00001", gender: "Female" }]);
    expect(field("Student Full Name")).toHaveValue("");
  });
  it("shows the onSubmit failure inside the form", async () => {
    const { user } = renderUI(<DynamicForm sections={live} onSubmit={() => { throw new Error("Online submissions are closed for now (cap reached). Please contact the admissions office."); }} />);
    await user.type(field("Student Full Name"), "Riya");
    await user.type(field("WhatsApp Number"), "9810000001");
    await user.click(screen.getByRole("radio", { name: "Male" }));
    await user.click(screen.getByRole("button", { name: "Submit enquiry" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Online submissions are closed for now (cap reached). Please contact the admissions office.");
  });
  it("preview mode never submits", async () => {
    const calls: unknown[] = [];
    renderUI(<DynamicForm sections={live} preview onSubmit={() => { calls.push(1); }} />);
    expect(screen.getByRole("button", { name: "Submit (disabled in preview)" })).toBeDisabled();
    expect(calls).toHaveLength(0);
  });
});
