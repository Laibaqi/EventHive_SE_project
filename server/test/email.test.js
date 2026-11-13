const test = require('node:test');
const assert = require('node:assert/strict');
const { templates } = require('../src/lib/emailTemplates');
const { sendEmail, _setTransporter } = require('../src/lib/email');

test('TC-EMAIL-01: OTP email shows the code and the 10-minute expiry', () => {
  const m = templates.otp({ name: 'Ali', code: '482913', purpose: 'verify your email', minutes: 10 });
  assert.match(m.subject, /482913/);
  assert.ok(m.html.includes('482913'));
  assert.ok(m.text.includes('10 minutes'));
});

test('TC-EMAIL-02: names are HTML-escaped (no script injection)', () => {
  const m = templates.otp({ name: '<script>x</script>', code: '111111' });
  assert.ok(!m.html.includes('<script>'));
});

test('TC-EMAIL-03: in development the email is printed, not sent', async () => {
  delete process.env.SMTP_HOST;
  const logs = [];
  const orig = console.log; console.log = (s) => logs.push(String(s));
  try {
    const r = await sendEmail('otp', 'ali@test.pk', { name: 'Ali', code: '123456' });
    assert.deepEqual(r, { ok: true, dev: true });
    assert.ok(logs.join('\n').includes('123456'));
  } finally { console.log = orig; }
});

test('TC-EMAIL-04: on the live site a failing send is tried 3 times and never throws', async () => {
  process.env.SMTP_HOST = 'smtp.test';
  let calls = 0;
  _setTransporter({ sendMail: async () => { calls++; throw new Error('smtp down'); } });
  const orig = console.error; console.error = () => {};
  try {
    const r = await sendEmail('otp', 'ali@test.pk', { code: '123456' }, { retryDelayMs: 1 });
    assert.equal(r.ok, false);
    assert.equal(calls, 3);
  } finally { console.error = orig; delete process.env.SMTP_HOST; _setTransporter(undefined); }
});

test('TC-EMAIL-05: a working send returns ok on the first try', async () => {
  process.env.SMTP_HOST = 'smtp.test';
  _setTransporter({ sendMail: async () => ({ messageId: 'abc' }) });
  try {
    assert.deepEqual(await sendEmail('otp', 'ali@test.pk', { code: '123456' }), { ok: true, messageId: 'abc' });
  } finally { delete process.env.SMTP_HOST; _setTransporter(undefined); }
});

test('TC-AUDT-03: every action name Laiba logs is accepted', async () => {
  const { audit } = require('../src/lib/audit');
  const rows = [];
  const fakeDb = { auditLog: { create: async ({ data }) => { rows.push(data); return data; } } };
  for (const name of ['USER_REGISTERED', 'EMAIL_VERIFIED', 'LOGIN', 'LOGIN_FAILED']) {
    await audit(1, name, 'User', 1, {}, fakeDb);
  }
  assert.equal(rows.length, 4);
});
