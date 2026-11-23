// Financial state remains authoritative. A manual unpaid/overdue label lasts only
// while its amount, paid total and due date still match the reviewed invoice.
function invoiceDisplayStatus(invoice, today) {
  const paid = invoice.paid ?? 0;
  if (Math.round((invoice.amount - paid) * 100) <= 0) return "Paid";
  const override = invoice.statusOverride;
  if (override && ["Pending", "Overdue"].includes(override.status) && override.amount === invoice.amount
      && override.paid === paid && override.due === (invoice.due || "")) return override.status;
  return invoice.due && invoice.due < today ? "Overdue" : paid > 0 ? "Partial" : "Pending";
}
exports.invoiceDisplayStatus = invoiceDisplayStatus;

async function assertInvoiceStudentWritable(tx, school, invoice) {
  const { HttpsError } = require("firebase-functions/v2/https");
  const id = invoice.get("studentId"), grn = invoice.get("grn");
  let student;
  if (typeof id === "string" && id && id.length <= 128 && !/[\/]/.test(id)) {
    student = await tx.get(school.collection("students").doc(id));
  } else if (typeof grn === "string" && grn && grn.length <= 200) {
    const found = await tx.get(school.collection("students").where("grn", "==", grn).limit(2));
    if (found.size > 1) throw new HttpsError("failed-precondition", "This invoice's student identity is ambiguous. Correct its student link first.");
    student = found.docs[0];
  }
  if (!student?.exists || student.get("deleted")) throw new HttpsError("failed-precondition", "Removed or unavailable student records are read-only.");
}
exports.assertInvoiceStudentWritable = assertInvoiceStudentWritable;
