// sendEmail(template, to, data)
// Development (no BREVO_API_KEY and no SMTP_HOST in .env): prints the email to the console, sends nothing.
// Live site: Brevo's HTTPS email API if BREVO_API_KEY is set (Railway blocks SMTP ports 465/587 on
// trial/hobby plans, but normal HTTPS works), otherwise Nodemailer over SMTP. 3 attempts with back-off.
// Never throws on a send failure: returns { ok:false } so sign-up / forgot password still answer the user.
//
//   await sendEmail('otp', user.email, { name: user.name, code, purpose: 'verify your email', minutes: 10 });
//
// Attachments (e.g. the ticket QR code as a PNG):
//   await sendEmail('ticketConfirmed', to, data, { attachments: [{ filename: 'ticket-12-qr.png', content: pngBuffer }] });
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

// "EventHive <eventhive.teams@gmail.com>" -> { name: 'EventHive', email: 'eventhive.teams@gmail.com' }
function parseFrom(from) {
  const m = /^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/.exec(from || '');
  return m ? { name: m[1].trim() || 'EventHive', email: m[2].trim() } : { name: 'EventHive', email: String(from || '').trim() };
}

let fetchImpl = (...args) => fetch(...args);

// Brevo transactional email API (https://developers.brevo.com/reference/sendtransacemail).
// The sender address must be verified in Brevo (Senders & IPs > Senders).
async function sendWithBrevo({ from, to, subject, html, text, attachments }) {
  const res = await fetchImpl('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': process.env.BREVO_API_KEY, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      sender: parseFrom(from),
      to: [{ email: to }],
      subject,
      htmlContent: html,
      textContent: text,
      ...(attachments && attachments.length
        ? { attachment: attachments.map((a) => ({ name: a.filename, content: Buffer.from(a.content).toString('base64') })) }
        : {}),
    }),
    signal: AbortSignal.timeout(15000),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Brevo ${res.status}: ${body.message || body.code || 'send failed'}`);
  return { messageId: body.messageId };
}

async function sendEmail(template, to, data = {}, { retryDelayMs = 1000, attachments = [] } = {}) {
  const build = templates[template];
  if (!build) throw new Error(`Unknown email template: ${template}`); // programmer mistake -> throw
  const { subject, html, text } = build(data);

  const useBrevo = Boolean(process.env.BREVO_API_KEY);
  if (!useBrevo && !process.env.SMTP_HOST) {
    const files = attachments.length ? `\nAttachments: ${attachments.map((a) => a.filename).join(', ')}` : '';
    console.log(`\n========== [DEV EMAIL: ${template}] ==========\nTo: ${to}\nSubject: ${subject}${files}\n\n${text}\n==============================================\n`);
    return { ok: true, dev: true };
  }

  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const message = { from: process.env.MAIL_FROM || 'EventHive <no-reply@eventhive.app>', to, subject, html, text };
      if (attachments.length) message.attachments = attachments; // Nodemailer format: { filename, content }
      const info = useBrevo ? await sendWithBrevo(message) : await getTransporter().sendMail(message);
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
/** For tests: replace fetch (used for Brevo) with a fake. */
function _setFetch(f) { fetchImpl = f || ((...args) => fetch(...args)); }

module.exports = { sendEmail, parseFrom, _setTransporter, _setFetch };
