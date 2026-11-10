const nodemailer = require("nodemailer");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");
const { defineSecret } = require("firebase-functions/params");
const { logger } = require("firebase-functions/v2");

const staffSmtpUrl = defineSecret("STAFF_SMTP_URL");
const resendDelayMs = 60_000;

function createInvitationTransport() {
  const url = staffSmtpUrl.value();
  if (!url) throw Object.assign(new Error("SMTP is not configured"), { code: "smtp/not-configured" });
  return nodemailer.createTransport({
    url, requireTLS: true, connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 15_000,
  });
}

async function sendStaffInvitation({ uid, email, name }, { resend = false } = {}) {
  const db = getFirestore();
  // This collection is private to the backend. It stores delivery state, never the setup link.
  const delivery = db.collection("staff_invite_delivery").doc(uid);
  try {
    const claimed = await db.runTransaction(async (tx) => {
      const previous = (await tx.get(delivery)).data();
      if (previous?.state === "sent" && !resend) return "sent";
      const now = Date.now();
      if ((previous?.state === "sending" || previous?.state === "sent") &&
          now - previous.attemptedAt < resendDelayMs) return "wait";
      tx.set(delivery, { state: "sending", attemptedAt: now });
      return "send";
    });
    if (claimed !== "send") return claimed === "sent";
  } catch (error) {
    logger.error("Could not reserve staff invitation delivery", { uid, code: error.code });
    return false;
  }

  let sent = false;
  try {
    const from = process.env.STAFF_INVITE_FROM?.trim();
    if (!from) throw Object.assign(new Error("Staff email is not configured"), { code: "smtp/not-configured" });
    const transport = createInvitationTransport();
    const link = await getAuth().generatePasswordResetLink(email);
    const result = await transport.sendMail({
      from,
      to: { name, address: email },
      subject: "Set up your Edvio staff account",
      text: `Hi ${name},\n\nYour Edvio staff account is ready. Use this link to set your password:\n${link}\n\nIf you were not expecting this email, you can ignore it.\n\nEdvio`,
    });
    sent = result.accepted.length > 0;
  } catch (error) {
    logger.warn("Staff invitation email failed", { uid, code: error.code });
  }
  await delivery.update({ state: sent ? "sent" : "failed" }).catch((error) => {
    logger.error("Could not record staff invitation delivery", { uid, code: error.code });
  });
  return sent;
}

module.exports = { createInvitationTransport, sendStaffInvitation, staffSmtpUrl };
