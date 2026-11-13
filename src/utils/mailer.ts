import nodemailer from "nodemailer";

const {SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM}= process.env;

const isConfigured= SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS;

const transporter= isConfigured? nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: Number(SMTP_PORT)===465,
    auth: {user: SMTP_USER, pass: SMTP_PASS}
}): null;

export async function sendEmail(to: string, subject: string, html: string)
{
    if (!transporter) {
    console.log("\n📧 [DEV EMAIL — no SMTP configured, logging instead]");
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`Body:\n${html}\n`);
    return;
  }

  await transporter.sendMail({
    from: EMAIL_FROM || "HireFlow <no-reply@hireflow.dev>",
    to,
    subject,
    html
  })
}