const nodemailer = require("nodemailer");

let transporter;

function getTransporter() {
  if (transporter) return transporter;
  if (!process.env.SMTP_HOST) return null;
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER ? {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    } : undefined,
  });
  return transporter;
}

async function queueTripEmail({ to, subject, text }) {
  const tx = getTransporter();
  if (!tx || !to) return { queued: false };
  setImmediate(() => {
    tx.sendMail({
      from: process.env.EMAIL_FROM || "TravelShare <no-reply@travelshare.local>",
      to,
      subject,
      text,
    }).catch(() => {});
  });
  return { queued: true };
}

module.exports = { queueTripEmail };
