// NOTF-02 — Sprint 1 email templates on one shared layout (W-59):
// logo · greeting · short intro · details box · button(s) · footer. No marketing (BR-19).
// Each template takes plain data and returns { subject, html, text }.

const APP = 'EventHive';

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function layout({ title, greeting, intro, details = [], buttons = [], note = '' }) {
  const rows = details
    .map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#555">${esc(k)}</td><td style="padding:4px 0"><b>${esc(v)}</b></td></tr>`)
    .join('');
  const btns = buttons
    .map(
      (b) =>
        `<a href="${esc(b.url)}" style="display:inline-block;margin:0 8px 8px 0;padding:10px 18px;border-radius:6px;` +
        `background:${b.secondary ? '#ffffff' : '#1f4e79'};color:${b.secondary ? '#1f4e79' : '#ffffff'};` +
        `border:1px solid #1f4e79;text-decoration:none;font-weight:bold">${esc(b.label)}</a>`
    )
    .join('');
  const html = `<!doctype html><html><body style="margin:0;background:#f4f6f8;font-family:Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;padding:24px">
<tr><td style="font-size:20px;font-weight:bold;color:#1f4e79;padding-bottom:16px">${APP}</td></tr>
<tr><td style="font-size:16px;padding-bottom:8px">${esc(greeting)}</td></tr>
<tr><td style="font-size:14px;color:#333;padding-bottom:16px">${esc(intro)}</td></tr>
${rows ? `<tr><td style="background:#f4f6f8;border-radius:6px;padding:12px;font-size:14px"><table>${rows}</table></td></tr>` : ''}
<tr><td style="padding-top:16px">${btns}</td></tr>
${note ? `<tr><td style="font-size:12px;color:#777;padding-top:8px">${esc(note)}</td></tr>` : ''}
<tr><td style="font-size:11px;color:#999;padding-top:24px;border-top:1px solid #eee">
You received this because of an action on your ${APP} account or event. ${APP} never sends marketing emails.</td></tr>
</table></td></tr></table></body></html>`;
  const text = [
    greeting,
    '',
    intro,
    ...details.map(([k, v]) => `${k}: ${v}`),
    '',
    ...buttons.map((b) => `${b.label}: ${b.url}`),
    note ? `\n${note}` : '',
    `\n— ${APP}`,
  ].join('\n');
  return { title, html, text };
}

const templates = {
  // OTP — signup verification (Laiba) and forgot password (Zain)
  otp: ({ name, code, purpose = 'continue', minutes = 10 }) => {
    const l = layout({
      title: 'Your EventHive code',
      greeting: `Hello ${name || 'there'},`,
      intro: `Use this code to ${purpose}:`,
      details: [['Your code', code]],
      note: `The code expires in ${minutes} minutes and works once. If you did not ask for it, ignore this email.`,
    });
    return { subject: `Your EventHive code: ${code}`, html: l.html, text: l.text };
  },

  // Laiba — AUTH-05
  verify: ({ name, link }) => {
    const l = layout({
      title: 'Verify your email',
      greeting: `Hello ${name},`,
      intro: 'Please confirm your email address to finish setting up your EventHive account.',
      buttons: [{ label: 'Verify email', url: link }],
      note: 'This link works once and expires in 24 hours.',
    });
    return { subject: 'Verify your EventHive email', html: l.html, text: l.text };
  },

  // Zain — AUTH-06
  reset: ({ name, link }) => {
    const l = layout({
      title: 'Reset your password',
      greeting: `Hello ${name || 'there'},`,
      intro: 'We received a request to reset your password. If it was not you, ignore this email.',
      buttons: [{ label: 'Set new password', url: link }],
      note: 'This link works once and expires in 30 minutes.',
    });
    return { subject: 'Reset your EventHive password', html: l.html, text: l.text };
  },

  // Huzaifa — APPR-03 (W-57)
  venueRequest: ({ venueName, eventTitle, when, capacity, organizer, approveLink, declineLink }) => {
    const l = layout({
      title: 'Venue booking request',
      greeting: `Hello ${venueName},`,
      intro: 'A City Mayor has approved this event at your venue. Please confirm whether you can host it. No login needed.',
      details: [
        ['Event', eventTitle],
        ['When (PKT)', when],
        ['Capacity', capacity],
        ['Organizer', organizer],
      ],
      buttons: [
        { label: 'Approve booking', url: approveLink },
        { label: 'Decline booking', url: declineLink, secondary: true },
      ],
      note: 'Each link works once. If you decline, you can add a comment for the organizer.',
    });
    return { subject: `Booking request: ${eventTitle}`, html: l.html, text: l.text };
  },

  // Laiba — APPR-01 (sent to every Mayor of the event's city)
  mayorNewEvent: ({ mayorName, cityName, eventTitle, organizer, when, venue, link }) => {
    const l = layout({
      title: 'New event to review',
      greeting: `Hello ${mayorName},`,
      intro: `A new event in ${cityName} is waiting for approval.`,
      details: [
        ['Event', eventTitle],
        ['Organizer', organizer],
        ['When (PKT)', when],
        ['Venue', venue],
      ],
      buttons: [{ label: 'Review event', url: link }],
      note: 'Any Mayor of your city can decide; the first decision counts.',
    });
    return { subject: `New event to review: ${eventTitle}`, html: l.html, text: l.text };
  },
};

module.exports = { templates, layout, esc };
