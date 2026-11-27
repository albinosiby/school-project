const test = require("node:test");
const assert = require("node:assert/strict");
const { detailsOut, detailsPatch } = require("./classTeacherStudents");

const student = (fields) => ({ get: (k) => fields[k] });
const cur = {
  firstName: "Ann", caste: "X", category: "General", religion: "Y", gender: "Female", nationality: "IN",
  contacts: { father: { name: "Raj", phone: "9876543210", email: "", occupation: "Driver", relationship: "Father", address: "" }, guardian: { name: "Raj", phone: "9876543210" } },
  primary: "father", secondary: "", emergencyPhone: "", bloodGroup: "O+", conditions: "Asthma", assistance: "",
  residence: { addressLine1: "12 Beach Rd", city: "Kannur", pin: "670001" },
};

test("the teacher view leaves out caste, category and religion and fills every contact", () => {
  const v = detailsOut(student({ dob: "2014-02-01", bus: "Bus 3", grn: "G-12" }), cur);
  assert.equal(v.exists, true);
  assert.equal(v.caste, undefined);
  assert.equal(v.category, undefined);
  assert.equal(v.religion, undefined);
  assert.equal(v.contacts.father.occupation, "Driver");
  assert.deepEqual(v.contacts.mother, { name: "", phone: "", email: "", occupation: "", relationship: "", address: "" });
  assert.equal(v.primary, "father");
  assert.equal(v.bloodGroup, "O+");
  assert.equal(v.dob, "2014-02-01");
  assert.equal(v.admissionNumber, "G-12");
  assert.equal(detailsOut(student({}), undefined).exists, false);
});

test("contacts, primary, emergency, address and medical can change; the primary contact is returned to mirror", () => {
  const { patch, changed, main } = detailsPatch(cur, {
    contacts: { mother: { name: "Mary", phone: "98765 43211", relationship: "Mother" } },
    primary: "mother", secondary: "father", emergencyPhone: "+91 9876543212",
    residence: { city: "Thalassery" }, bloodGroup: "a+", conditions: "  Asthma, uses inhaler  ",
    firstName: "Hacked", caste: "Z",
  });
  assert.equal(patch.contacts.mother.name, "Mary");
  assert.equal(patch.contacts.father.name, "Raj", "other contacts are kept");
  assert.equal(patch.primary, "mother");
  assert.equal(patch.residence.addressLine1, "12 Beach Rd");
  assert.equal(patch.residence.city, "Thalassery");
  assert.equal(patch.bloodGroup, "A+");
  assert.equal(patch.conditions, "Asthma, uses inhaler");
  assert.equal(patch.firstName, undefined, "fields outside the allowlist are ignored");
  assert.equal(patch.caste, undefined);
  assert.deepEqual(main, { name: "Mary", phone: "98765 43211", email: "", occupation: "", relationship: "Mother", address: "" });
  assert.ok(changed.includes("medical conditions"));
});

test("bad input is refused", () => {
  assert.throws(() => detailsPatch(cur, { contacts: { father: { phone: "123" } } }), /valid mobile number for the father/);
  assert.throws(() => detailsPatch(cur, { contacts: { mother: { phone: "9876543211" } } }), /mother's name/);
  assert.throws(() => detailsPatch(cur, { primary: "mother" }), /primary contact needs a name/);
  assert.throws(() => detailsPatch(cur, { secondary: "father" }), /different second contact/);
  assert.throws(() => detailsPatch(cur, { bloodGroup: "Z" }), /blood group/);
  assert.throws(() => detailsPatch(cur, { emergencyPhone: "12" }), /emergency number/);
  assert.throws(() => detailsPatch(cur, { firstName: "x" }), /Nothing to update/);
  assert.equal(detailsPatch(cur, { conditions: "" }).main, null, "medical-only changes do not touch the guardian");
});
