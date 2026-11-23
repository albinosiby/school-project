// staff_self/{staffId}: what a staff member may see of their own HR record in the apps — the office's profile
// (basic details, addresses, emergency contact, employment, teaching details, qualifications), the list of uploaded
// documents (names only, never the files), the payroll bank account with a masked number, and the payroll history.
// Built on the server from staff_hr, staff, staff_payroll and Storage; never from the client, and it never carries the
// sealed app password, the login lock or the full account number. Rules let only that staff member read it.
const { getFirestore } = require("firebase-admin/firestore");
const { logger } = require("firebase-functions/v2");
const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const documentTypes = require("./staffDocumentTypes.json");

/** Bump when the card's shape changes: an older card is rebuilt the next time the staff member signs in. */
const STAFF_SELF_VERSION = 2;
const text = (value, max = 160) => (typeof value === "string" ? value.trim().slice(0, max) : typeof value === "number" ? String(value) : "");
const list = (value, max, each) => (Array.isArray(value) ? value.slice(0, max).map(each) : []);
const address = (a) => ({
  line1: text(a?.line1, 200), line2: text(a?.line2, 200), city: text(a?.city, 120), district: text(a?.district, 120),
  state: text(a?.state, 120), country: text(a?.country, 80), pin: text(a?.pin, 20),
});

function staffSelfCard(details, { name = "", empId = "", status = "", documents = [], payroll = null, now = new Date().toISOString() } = {}) {
  const d = details && typeof details === "object" ? details : {};
  const payments = list(payroll?.payments, 36, (p) => ({
    month: text(p?.month, 7), paidOn: text(p?.paidOn, 10), grossPaise: Number(p?.grossPaise) || 0,
    deductionsPaise: Number(p?.deductionsPaise) || 0, netPaise: Number(p?.netPaise) || 0, reference: text(p?.reference, 100),
  }));
  const account = payroll?.account ? {
    accountHolder: text(payroll.account.accountHolder, 120), bank: text(payroll.account.bank, 120), branch: text(payroll.account.branch, 120),
    ifsc: text(payroll.account.ifsc, 11), lastFour: text(payroll.account.lastFour, 4),
  } : null;
  return {
    version: STAFF_SELF_VERSION,
    name: text(name, 120) || [d.firstName, d.middleName, d.lastName].map((v) => text(v, 60)).filter(Boolean).join(" "),
    empId: text(empId || d.empId, 40),
    status: text(status || d.employmentStatus, 40),
    category: text(d.category, 40), designation: text(d.designation, 100), department: text(d.department, 120),
    phone: text(d.phone, 28), alternatePhone: text(d.alternatePhone, 28), email: text(d.contactEmail, 254),
    bloodGroup: text(d.bloodGroup, 10), joined: text(d.joined, 10), birthDate: text(d.birthDate, 10),
    employmentType: text(d.employmentType, 40), workShift: text(d.workShift, 60), teachingLevel: text(d.teachingLevel, 60),
    teachingExperience: text(d.teachingExperience, 10), tet: text(d.tet, 3),
    basic: {
      firstName: text(d.firstName, 60), middleName: text(d.middleName, 60), lastName: text(d.lastName, 60),
      gender: text(d.gender, 30), nationality: text(d.nationality, 80), maritalStatus: text(d.maritalStatus, 30),
    },
    addresses: { current: address(d.currentAddress), permanent: address(d.sameAddress === true ? d.currentAddress : d.permanentAddress), same: d.sameAddress === true },
    emergency: {
      name: text(d.emergency?.name, 120), relationship: text(d.emergency?.relationship, 80), mobile: text(d.emergency?.mobile, 28),
      alternate: text(d.emergency?.alternate, 28), address: text(d.emergency?.address, 300),
    },
    employment: {
      probationMonths: text(d.probationMonths, 4), contractStart: text(d.contractStart, 10), contractEnd: text(d.contractEnd, 10),
      employmentStatus: text(d.employmentStatus, 40),
    },
    teaching: {
      primarySubject: text(d.primarySubject, 120), additionalSubjects: list(d.additionalSubjects, 30, (s) => text(s, 120)).filter(Boolean),
      previousSchool: text(d.previousSchool, 160), previousDesignation: text(d.previousDesignation, 120),
      tetCertificate: text(d.tetCertificate, 80), teachingQualification: text(d.teachingQualification, 120), specialization: text(d.specialization, 160),
      // non-teaching and driver details share the card
      workExperience: text(d.workExperience, 10), previousOrganization: text(d.previousOrganization, 160), skills: text(d.skills, 300),
      professionalCertification: text(d.professionalCertification, 160), licenseNumber: text(d.licenseNumber, 60), licenseExpiry: text(d.licenseExpiry, 10),
    },
    qualifications: list(d.qualifications, 20, (r) => ({
      level: text(r?.level, 120), course: text(r?.course, 120), specialization: text(r?.specialization, 120),
      institution: text(r?.institution, 160), year: text(r?.year, 4), grade: text(r?.grade, 60),
    })),
    documents: list(documents, 40, (f) => ({
      id: text(f?.id, 80), category: text(f?.category, 40), label: documentTypes[f?.category] || "Other document",
      name: text(f?.name, 255), uploadedAt: text(f?.uploadedAt, 40),
    })),
    payroll: { account, payments },
    updatedAt: now,
  };
}

/**
 * Rebuild staff_self/{staffId} from the office's records; removes it when the staff member is gone. Needs the
 * admin SDK's Storage access for the document list, so it only runs on the server.
 */
async function refreshStaffSelf(sid, staffId, { listDocuments } = {}) {
  const db = getFirestore();
  const school = db.collection("schools").doc(sid);
  const self = school.collection("staff_self").doc(staffId);
  const staffRef = school.collection("staff").doc(staffId);
  const employee = db.collection("staff_payroll").doc(sid).collection("employees").doc(staffId);
  const [member, hr, account, payments] = await Promise.all([
    staffRef.get(), school.collection("staff_hr").doc(staffId).get(), employee.get(),
    employee.collection("payments").orderBy("month", "desc").limit(36).get(),
  ]);
  if (!member.exists || member.get("deleted") === true) { await self.delete(); return null; }
  let documents = [];
  try {
    documents = await (listDocuments || require("./staffDocuments").listStaffDocuments)(staffRef);
  } catch (error) {
    logger.warn("Staff documents could not be listed for the self card", { schoolId: sid, staffId, error: String(error) });
  }
  const bank = account.get("bankAccount");
  const card = staffSelfCard(hr.get("details"), {
    name: member.get("name"), empId: member.get("empId"), status: member.get("status"), documents,
    payroll: {
      account: bank ? { ...bank, lastFour: String(bank.accountNumber || "").slice(-4) } : null,
      payments: payments.docs.map((doc) => doc.data()),
    },
  });
  await self.set(card);
  return card;
}

/** Builds the card once for a staff member who signs in before the office has saved anything since the shape changed. */
async function ensureStaffSelf(sid, staffId) {
  const self = await getFirestore().collection("schools").doc(sid).collection("staff_self").doc(staffId).get();
  if (self.exists && self.get("version") === STAFF_SELF_VERSION) return;
  await refreshStaffSelf(sid, staffId);
}

const trigger = (document) => onDocumentWritten({ document, retry: true }, (event) => refreshStaffSelf(event.params.sid, event.params.staffId));
/** staff_hr/{staffId} written (the office saved a profile) → staff_self/{staffId} follows; staff deleted → removed. */
const onStaffHrWritten = trigger("schools/{sid}/staff_hr/{staffId}");
const onStaffPayrollAccountWritten = trigger("staff_payroll/{sid}/employees/{staffId}");
const onStaffPayrollPaymentWritten = trigger("staff_payroll/{sid}/employees/{staffId}/payments/{month}");

module.exports = { STAFF_SELF_VERSION, staffSelfCard, refreshStaffSelf, ensureStaffSelf, onStaffHrWritten, onStaffPayrollAccountWritten, onStaffPayrollPaymentWritten };
