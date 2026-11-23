const test = require("node:test");
const assert = require("node:assert/strict");
const { staffSelfCard, STAFF_SELF_VERSION } = require("./staffSelf");

const details = {
  firstName: "Fathima", lastName: "Beevi", empId: "FUS-0064", category: "Teaching", designation: "Teacher", department: "Academics",
  gender: "Female", nationality: "IN", maritalStatus: "Married",
  phone: "9876543210", contactEmail: "f@x.in", bloodGroup: "O+", joined: "2012-06-01", birthDate: "1985-02-10", teachingExperience: 12, tet: "Yes",
  tetCertificate: "KTET-991", primarySubject: "English", additionalSubjects: ["Hindi", "Art"], previousSchool: "St. Mary's",
  employmentType: "Permanent", employmentStatus: "Active", probationMonths: "6", contractStart: "2012-06-01",
  emergency: { name: "Rasheed", relationship: "Spouse", mobile: "9876500000", alternate: "9876500001", address: "Private lane" },
  qualifications: [{ level: "Postgraduate", course: "M.A. English", institution: "Kannur University", year: "2008", grade: "First" }],
  currentAddress: { line1: "12 Beach Rd", city: "Kannur", district: "Kannur", state: "Kerala", country: "IN", pin: "670001" },
  permanentAddress: { line1: "ignored when sameAddress" }, sameAddress: true,
  appPassword: { sealed: "never" }, loginLock: { until: 1 },
};

test("staff_self carries the full self-view of the HR profile, the document list and masked payroll", () => {
  const card = staffSelfCard(details, {
    name: "Fathima Beevi", empId: "FUS-0064", status: "Active", now: "2026-11-23T10:00:00.000Z",
    documents: [{ id: "doc1", category: "identity", name: "aadhaar.pdf", uploadedAt: "2026-11-01T10:00:00.000Z" }, { id: "doc2", category: "weird", name: "x.png", uploadedAt: "2026-11-02T10:00:00.000Z" }],
    payroll: {
      account: { bank: "SBI", branch: "Kannur", accountHolder: "Fathima Beevi", ifsc: "SBIN0001234", accountNumber: "123456789012", lastFour: "9012" },
      payments: [{ month: "2026-10", paidOn: "2026-10-31", grossPaise: 4500000, deductionsPaise: 200000, netPaise: 4300000, reference: "NEFT-1" }],
    },
  });
  assert.equal(card.version, STAFF_SELF_VERSION);
  assert.equal(card.name, "Fathima Beevi");
  assert.equal(card.phone, "9876543210");
  assert.equal(card.teachingExperience, "12");
  assert.deepEqual(card.basic, { firstName: "Fathima", middleName: "", lastName: "Beevi", gender: "Female", nationality: "IN", maritalStatus: "Married" });
  assert.equal(card.addresses.current.line1, "12 Beach Rd");
  assert.equal(card.addresses.same, true);
  assert.equal(card.addresses.permanent.line1, "12 Beach Rd", "permanent follows current when the office ticked 'same'");
  assert.deepEqual(card.emergency, { name: "Rasheed", relationship: "Spouse", mobile: "9876500000", alternate: "9876500001", address: "Private lane" });
  assert.deepEqual(card.employment, { probationMonths: "6", contractStart: "2012-06-01", contractEnd: "", employmentStatus: "Active" });
  assert.equal(card.teaching.primarySubject, "English");
  assert.deepEqual(card.teaching.additionalSubjects, ["Hindi", "Art"]);
  assert.equal(card.teaching.tetCertificate, "KTET-991");
  assert.deepEqual(card.qualifications, [{ level: "Postgraduate", course: "M.A. English", specialization: "", institution: "Kannur University", year: "2008", grade: "First" }]);
  assert.deepEqual(card.documents, [
    { id: "doc1", category: "identity", label: "Identity proof", name: "aadhaar.pdf", uploadedAt: "2026-11-01T10:00:00.000Z" },
    { id: "doc2", category: "weird", label: "Other document", name: "x.png", uploadedAt: "2026-11-02T10:00:00.000Z" },
  ]);
  assert.deepEqual(card.payroll.account, { accountHolder: "Fathima Beevi", bank: "SBI", branch: "Kannur", ifsc: "SBIN0001234", lastFour: "9012" });
  assert.equal("accountNumber" in card.payroll.account, false, "the full account number never reaches the app");
  assert.deepEqual(card.payroll.payments, [{ month: "2026-10", paidOn: "2026-10-31", grossPaise: 4500000, deductionsPaise: 200000, netPaise: 4300000, reference: "NEFT-1" }]);
  assert.equal(JSON.stringify(card).includes("never"), false, "the sealed app password never reaches the card");
  assert.equal("loginLock" in card, false);
  assert.equal(card.updatedAt, "2026-11-23T10:00:00.000Z");
});

test("staff_self keeps separate addresses when the office did not tick 'same'", () => {
  const card = staffSelfCard({ ...details, sameAddress: false, permanentAddress: { line1: "Old house", pin: "670002" } });
  assert.equal(card.addresses.same, false);
  assert.equal(card.addresses.permanent.line1, "Old house");
  assert.equal(card.addresses.permanent.city, "");
});

test("staff_self tolerates a bare or malformed profile", () => {
  const card = staffSelfCard(null, { now: "2026-11-23T10:00:00.000Z" });
  assert.equal(card.name, "");
  assert.deepEqual(card.qualifications, []);
  assert.deepEqual(card.documents, []);
  assert.deepEqual(card.payroll, { account: null, payments: [] });
  assert.equal(card.emergency.name, "");
  assert.equal(card.addresses.current.line1, "");
  const odd = staffSelfCard({ qualifications: "no", additionalSubjects: 5, emergency: "x" }, { documents: "none", payroll: { payments: 1 } });
  assert.deepEqual(odd.qualifications, []);
  assert.deepEqual(odd.teaching.additionalSubjects, []);
  assert.deepEqual(odd.documents, []);
});
