const { HttpsError } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions/v2");
const { clean } = require("./staffProfileData");

function payrollAccount(data) {
  if (!data) return null;
  const { bank, branch, accountHolder, ifsc, accountNumber } = data;
  return { bank, branch, accountHolder, ifsc, lastFour: accountNumber.slice(-4) };
}

function amountInPaise(value, label) {
  const amount = clean(value);
  if (!/^\d{1,9}(?:\.\d{1,2})?$/.test(amount)) {
    throw new HttpsError("invalid-argument", `Enter a valid ${label} with up to two decimal places.`);
  }
  const [rupees, fraction = ""] = amount.split(".");
  return Number(rupees) * 100 + Number(fraction.padEnd(2, "0"));
}

function paymentData(input) {
  const month = clean(input.month);
  const paidOn = clean(input.paidOn);
  const date = new Date(`${paidOn}T00:00:00Z`);
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || month > today.slice(0, 7) || month < "1900-01") {
    throw new HttpsError("invalid-argument", "Choose a valid payroll month.");
  }
  if (!Number.isFinite(date.valueOf()) || date.toISOString().slice(0, 10) !== paidOn || paidOn > today || paidOn < "1900-01-01") {
    throw new HttpsError("invalid-argument", "Choose a valid payment date on or before today.");
  }
  const grossPaise = amountInPaise(input.gross, "gross pay");
  const deductionsPaise = amountInPaise(input.deductions || "0", "deductions");
  if (!grossPaise || deductionsPaise > grossPaise) {
    throw new HttpsError("invalid-argument", "Gross pay must be positive and deductions cannot exceed gross pay.");
  }
  const reference = clean(input.reference);
  if (reference.length > 100) throw new HttpsError("invalid-argument", "Use at most 100 characters for the payment reference.");
  return { month, paidOn, grossPaise, deductionsPaise, netPaise: grossPaise - deductionsPaise, reference };
}

async function staffPayroll(tx, employee, input, scope, staffId) {
  if (input.action === "recordPayment") {
    const payment = paymentData(input);
    const ref = employee.collection("payments").doc(payment.month);
    const saved = await tx.get(ref);
    if (saved.exists) {
      if (Object.entries(payment).every(([field, value]) => saved.get(field) === value)) return { payment };
      throw new HttpsError("already-exists", "A payroll payment is already recorded for this month.");
    }
    tx.create(ref, { ...payment, recordedBy: scope.uid, recordedAt: new Date().toISOString() });
    return { payment };
  }

  const employeeSnapshot = await tx.get(employee);
  const existing = employeeSnapshot.get("bankAccount");
  if (input.action === "list") {
    const history = await tx.get(employee.collection("payments").orderBy("month", "desc"));
    const payments = history.docs.map((doc) => {
      const { month, paidOn, grossPaise, deductionsPaise, netPaise, reference } = doc.data();
      return { month, paidOn, grossPaise, deductionsPaise, netPaise, reference };
    });
    return { account: payrollAccount(existing), payments };
  }

  if (input.action === "revealAccount") {
    if (!existing) throw new HttpsError("not-found", "Save a payroll bank account first.");
    logger.info("Staff payroll account number revealed", { schoolId: scope.sid, staffId, actorUid: scope.uid });
    return { accountNumber: existing.accountNumber };
  }

  const bank = clean(input.bank);
  const branch = clean(input.branch);
  const accountHolder = clean(input.accountHolder);
  const ifsc = clean(input.ifsc).toUpperCase();
  const accountNumber = clean(input.accountNumber).replace(/\s/g, "") || existing?.accountNumber || "";
  if (!bank || !accountHolder || [bank, branch, accountHolder].some((value) => value.length > 120)) {
    throw new HttpsError("invalid-argument", "Enter a bank and account holder name, using at most 120 characters per field.");
  }
  if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc) || !/^\d{6,24}$/.test(accountNumber)) {
    throw new HttpsError("invalid-argument", "Enter a valid IFSC and a bank account number containing 6 to 24 digits.");
  }
  const bankAccount = { bank, branch, accountHolder, ifsc, accountNumber };
  tx.set(employee, { bankAccount, updatedAt: new Date().toISOString(), updatedBy: scope.uid }, { merge: true });
  return { account: payrollAccount(bankAccount) };
}

module.exports = { staffPayroll };
