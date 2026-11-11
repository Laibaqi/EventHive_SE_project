// sendEmail(template, to, data)
// Development (no SMTP_HOST in .env): prints the email to the console, sends nothing, needs no install.
// Live site: Nodemailer over SMTP, 3 attempts with back-off. Never throws on a send failure:
// returns { ok:false } so sign-up / forgot password still answer the user.
//
//   await sendEmail('otp', user.email, { name: user.name, code, purpose: 'verify your email', minutes: 10 });
const { templates } = require('./emailTemplates');

let transporter;
function getTransporter() {
  if (!transporter) {
    const nodemailer = require('nodemailer'); // only needed on the live site: npm install nodemailer
    const port = Number(process.env.SMTP_PORT || 587);
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transporter;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function sendEmail(template, to, data = {}, { retryDelayMs = 1000 } = {}) {
  const build = templates[template];
  if (!build) throw new Error(`Unknown email template: ${template}`); // programmer mistake -> throw
  const { subject, html, text } = build(data);

  if (!process.env.SMTP_HOST) {
    console.log(`\n========== [DEV EMAIL: ${template}] ==========\nTo: ${to}\nSubject: ${subject}\n\n${text}\n==============================================\n`);
    return { ok: true, dev: true };
  }

  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const info = await getTransporter().sendMail({
        from: process.env.MAIL_FROM || 'EventHive <no-reply@eventhive.app>',
        to, subject, html, text,
      });
      return { ok: true, messageId: info.messageId };
    } catch (err) {
      lastError = err;
      if (attempt < 3) await sleep(retryDelayMs * 2 ** (attempt - 1));
    }
  }

  console.error(`[email] ${template} to ${to} failed after 3 attempts: ${lastError?.message}`);
  try {
    const { audit, ACTIONS } = require('./audit');
    await audit(null, ACTIONS.EMAIL_FAILED, 'Email', null, { template, to, error: lastError?.message });
  } catch (_) { /* logging must never break the request */ }
  return { ok: false, error: lastError?.message };
}

/** For tests: replace the SMTP transporter with a fake. */
function _setTransporter(t) { transporter = t; }

module.exports = { sendEmail, _setTransporter };
