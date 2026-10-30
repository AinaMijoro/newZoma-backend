const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

async function sendOrderEmail({ to, subject, text }) {
  return transporter.sendMail({
    from: `"Zoma" <${process.env.GMAIL_USER}>`,
    to,
    subject,
    text,
  });
}

module.exports = { sendOrderEmail };