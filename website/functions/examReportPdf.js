const path = require("node:path");
const { getFirestore } = require("firebase-admin/firestore");
const { getStorage } = require("firebase-admin/storage");
const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { randomBytes, createHash } = require("node:crypto");
const { requireAdminSession } = require("./adminSession");
const id = (v) => typeof v === "string" && /^[\w-]{1,180}$/.test(v);

async function renderReportCards(cards, images = new Map()) {
  const imageSources = new Map([...images].map(([key, bytes]) => [key, `data:image/${bytes[0] === 0xff && bytes[1] === 0xd8 ? "jpeg" : "png"};base64,${bytes.toString("base64")}`]));
  const PDFDocument = require("pdfkit");
  const doc = new PDFDocument({
    size: "A4",
    margin: 42,
    autoFirstPage: false,
    info: { Title: "Examination report cards", Author: "Edvio" },
  });
  doc.registerFont("Regular", path.join(__dirname, "assets/PlusJakartaSans-Regular.ttf"));
  doc.registerFont("Bold", path.join(__dirname, "assets/PlusJakartaSans-Bold.ttf"));
  const chunks = [],
    complete = new Promise((resolve, reject) => {
      doc.on("data", (part) => chunks.push(part));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);
    });
  for (const card of cards) {
    const template = card.template || {};
    const page = () => {
      doc.addPage();
      doc.font("Regular").fillColor("#202633");
    };
    page();
    const width = 511;
    const label = (value, x, y, w = width, size = 10, bold = false) =>
      doc
        .font(bold ? "Bold" : "Regular")
        .fontSize(size)
        .text(String(value ?? "—"), x, y, { width: w });
    const ensure = (height) => {
      if (doc.y + height > 760) {
        page();
        label(`${card.name} · ${card.exam} (continued)`, 42, 42, width, 11, true);
        doc.y += 18;
      }
    };
    const logo = imageSources.get(card.school?.logoPath);
    if (logo) doc.image(logo, 42, 42, { fit: [54, 54] });
    label(card.school?.name || "School report card", logo ? 110 : 42, 42, logo ? 443 : width, 19, true);
    label(
      [card.school?.city, card.school?.affiliation && "Affiliation " + card.school.affiliation]
        .filter(Boolean)
        .join(" · "),
      logo ? 110 : 42,
      Math.max(70, doc.y + 6),
      logo ? 443 : width,
      9,
    );
    doc.y = Math.max(115, doc.y + 22);
    label(card.exam, 42, doc.y, width, 15, true);
    label(
      `${card.academicYear}  ·  ${card.status === "Published" ? "Published report" : card.status === "Superseded" ? "Superseded report" : "DRAFT PREVIEW"}`,
      42,
      doc.y + 7,
      width,
      9,
    );
    doc.y += 22;
    label(`${card.name}  ·  ${card.cls}`, 42, doc.y, width, 12, true);
    label(`Admission no: ${card.grn || "—"}    Roll: ${card.roll || "—"}`, 42, doc.y + 6, width, 10);
    doc.y += 24;
    const columns =
      template.showComponents === false
        ? ["Subject", "Obtained / Max", "Grade", "Status"]
        : ["Subject", "Theory", "Practical", "Internal", "Total / Max", "Grade"];
    const widths = template.showComponents === false ? [215, 120, 60, 116] : [166, 64, 66, 64, 94, 57];
    const tableRow = (cells, heading = false) => {
      doc.font(heading ? "Bold" : "Regular").fontSize(9);
      const heights = cells.map((cell, i) => doc.heightOfString(String(cell), { width: widths[i] - 12 }));
      const height = Math.max(28, ...heights.map((h) => h + 14));
      ensure(height + 8);
      const y = doc.y;
      let x = 42;
      if (heading) doc.rect(42, y, width, height).fill("#EEF1F6");
      doc.fillColor("#202633");
      cells.forEach((cell, i) => {
        label(cell, x + 6, y + 7, widths[i] - 12, 9, heading);
        x += widths[i];
      });
      doc
        .strokeColor("#DDE1E7")
        .lineWidth(0.5)
        .moveTo(42, y + height)
        .lineTo(553, y + height)
        .stroke();
      doc.y = y + height;
    };
    tableRow(columns, true);
    for (const { paper, mark, result } of card.entries) {
      const numeric = paper.assessmentMode !== "grade" && !["exempt", "absent"].includes(result.state);
      const total = numeric
        ? `${result.total} / ${paper.theory + paper.internal + (paper.practical || 0)}`
        : result.state === "absent"
          ? "Absent"
          : result.state === "exempt"
            ? "Exempt"
            : "Grade only";
      const component = (key) => (numeric && paper[key] > 0 ? `${mark[key] ?? "—"}/${paper[key]}` : "—");
      tableRow(
        template.showComponents === false
          ? [paper.subject, total, result.grade, mark.status || "Present"]
          : [
              paper.subject,
              component("theory"),
              component("practical"),
              component("internal"),
              total,
              result.grade,
            ],
      );
    }
    doc.y += 18;
    ensure(100);
    label(
      `Total: ${card.total ?? "—"} / ${card.maximum ?? "—"}    Percentage: ${card.pct === null ? "—" : card.pct + "%"}    Grade: ${card.grade}`,
      42,
      doc.y,
      width,
      11,
      true,
    );
    label(
      `Result: ${card.complete ? (card.passed ? "Pass" : "Fail") : "Incomplete"}${template.showRank !== false && card.rank ? "    Rank: " + card.rank : ""}`,
      42,
      doc.y + 7,
      width,
      10,
    );
    if (template.showAttendance) {
      doc.y += 12;
      label(
        `Attendance: ${card.remarks?.attendancePresent ?? "—"} / ${card.remarks?.attendanceTotal ?? "—"} days`,
        42,
        doc.y,
        width,
        10,
      );
    }
    if (template.showRemarks !== false)
      for (const [name, key] of [
        ["Class teacher remarks", "classTeacher"],
        ["Principal remarks", "principal"],
      ]) {
        const note = card.remarks?.[key];
        if (!note) continue;
        doc.y += 14;
        const height = doc.fontSize(10).heightOfString(`${name}: ${note}`, { width });
        ensure(height + 15);
        label(`${name}: ${note}`, 42, doc.y, width, 10);
      }
    doc.y += 20;
    ensure(110);
    const imageY = doc.y;
    if (template.teacherSignatureImage)
      doc.image(template.teacherSignatureImage, 42, imageY, { fit: [170, 45] });
    if (template.principalSignatureImage)
      doc.image(template.principalSignatureImage, 323, imageY, { fit: [170, 45] });
    doc.y = imageY + 50;
    const signatureY = doc.y;
    label(template.teacherSignature || "Class teacher", 42, signatureY, 230, 10, true);
    label(template.principalSignature || "Principal", 323, signatureY, 230, 10, true);
    doc.y = signatureY + 35;
    if (template.footer) label(template.footer, 42, doc.y, width, 9);
    label(`Version ${card.batchId} · ${card.createdAt?.slice(0, 10) || ""}`, 42, 788, width, 7);
  }
  doc.end();
  return complete;
}
exports.renderReportCards = renderReportCards;

async function downloadExamReport(req) {
  const uid = req.auth?.uid,
    input = req.data || {};
  if (!uid) throw new HttpsError("unauthenticated", "Sign in first.");
  if (!id(input.schoolId) || !id(input.batchId) || (input.studentId && !id(input.studentId)))
    throw new HttpsError("invalid-argument", "Choose a report card.");
  const db = getFirestore(),
    school = db.collection("schools").doc(input.schoolId);
  const [actor, owner, platform, batch] = await Promise.all([
    db.doc(`users/${uid}`).get(),
    db.doc(`platform_admins/${uid}`).get(),
    db.doc(`platform_schools/${input.schoolId}`).get(),
    school.collection("exm_report_batches").doc(input.batchId).get(),
  ]);
  const parent =
    actor.get("role") === "parent" &&
    actor.get("schoolId") === input.schoolId &&
    input.studentId &&
    (actor.get("studentIds") || []).includes(input.studentId) &&
    (!actor.get("parentCredentialVersion") ||
      req.auth.token?.parentCredentialVersion === actor.get("parentCredentialVersion")) &&
    batch.get("status") === "Published";
  const admin = owner.exists || (actor.get("role") === "admin" && actor.get("schoolId") === input.schoolId);
  if ((!parent && !admin) || platform.get("status") === "suspended" || !batch.exists)
    throw new HttpsError("permission-denied", "This report is unavailable for your account.");
  if (admin) await requireAdminSession(req);
  if (input.linkOnly === true) {
    // Short-lived capability for a phone's external PDF viewer. No public Storage token is issued.
    if (!parent)
      throw new HttpsError("permission-denied", "Open published report links from the parent account.");
    const token = randomBytes(32).toString("hex"),
      key = createHash("sha256").update(token).digest("hex");
    await db
      .collection("exam_download_links")
      .doc(key)
      .create({
        uid,
        schoolId: input.schoolId,
        batchId: input.batchId,
        studentId: input.studentId,
        credentialVersion: actor.get("parentCredentialVersion") || "",
        expiresAt: Date.now() + 5 * 60 * 1000,
      });
    const project = db.projectId;
    const origin =
      process.env.FUNCTIONS_EMULATOR === "true"
        ? `http://${process.env.EXAM_LINK_EMULATOR_HOST || "127.0.0.1:5001"}/${project}/asia-south1/openExamReport`
        : `https://asia-south1-${project}.cloudfunctions.net/openExamReport`;
    return { url: `${origin}?token=${token}` };
  }
  let query = school.collection("exm_report_cards").where("batchId", "==", input.batchId);
  if (input.studentId) query = query.where("studentId", "==", input.studentId);
  const snap = await query.get();
  if (snap.empty || snap.size > 180)
    throw new HttpsError("failed-precondition", "No report cards are available in this batch.");
  const cards = snap.docs.map((d) => ({ ...d.data(), status: batch.get("status") })),
    images = new Map();
  for (const logoPath of new Set(cards.map((c) => c.school?.logoPath).filter(Boolean))) {
    if (
      !logoPath.startsWith(`schools/${input.schoolId}/branding/`) &&
      !logoPath.startsWith(`schools/${input.schoolId}/exam-branding/`)
    )
      continue;
    const file = getStorage().bucket().file(logoPath);
    if (!(await file.exists())[0]) continue;
    const [meta] = await file.getMetadata();
    if (Number(meta.size) <= 2 * 1024 * 1024 && ["image/png", "image/jpeg"].includes(meta.contentType))
      images.set(logoPath, (await file.download())[0]);
  }
  const buffer = await renderReportCards(cards, images);
  if (buffer.length > 7 * 1024 * 1024)
    throw new HttpsError("resource-exhausted", "Download individual reports; this batch PDF is too large.");
  return {
    content: buffer.toString("base64"),
    filename: `report-${input.batchId}${input.studentId ? "-" + input.studentId : ""}.pdf`,
  };
}
exports.downloadExamReport = onCall({ timeoutSeconds: 120, memory: "512MiB" }, downloadExamReport);
exports.openExamReport = onRequest({ timeoutSeconds: 120, memory: "512MiB" }, async (req, res) => {
  res.set("Cache-Control", "private, no-store");
  if (req.method !== "GET" || typeof req.query.token !== "string" || !/^[a-f\d]{64}$/.test(req.query.token)) {
    res.status(404).send("Report link unavailable.");
    return;
  }
  const db = getFirestore(),
    ref = db
      .collection("exam_download_links")
      .doc(createHash("sha256").update(req.query.token).digest("hex"));
  const link = await ref.get();
  if (!link.exists || link.get("expiresAt") <= Date.now()) {
    res.status(410).send("This report link expired. Open a new link from the parent app.");
    return;
  }
  try {
    const data = link.data();
    if ((await require("firebase-admin/auth").getAuth().getUser(data.uid)).disabled)
      throw new Error("Account disabled");
    const result = await downloadExamReport({
      auth: { uid: data.uid, token: { parentCredentialVersion: data.credentialVersion } },
      data,
    });
    res
      .set("Content-Type", "application/pdf")
      .set("Content-Disposition", `attachment; filename="${result.filename}"`)
      .status(200)
      .send(Buffer.from(result.content, "base64"));
  } catch {
    res.status(403).send("This report is no longer available. Open the parent app to check its status.");
  }
});
