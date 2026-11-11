// Input rules for sign-up and login (AUTH-05, AUTH-03, AUTH-02, SRS Appendix G).
// Routes can use these with Zain's validate(schema); the auth functions also check
// them themselves, so they are safe to call directly (and in tests).

const { z } = require('zod');
const { HttpError } = require('./errors');

// Only these two roles can sign up. Admin accounts come from the seed script (AUTH-03).
const PUBLIC_ROLES = ['ATTENDEE', 'ORGANIZER'];

const email = z
  .string({ error: 'Enter your email' })
  .trim()
  .toLowerCase()
  .max(254, 'Email must be 254 characters or fewer')
  .email('Enter a valid email address');

// Same rule Zain uses for reset / change password.
const password = z
  .string({ error: 'Enter a password' })
  .min(8, 'Password must be at least 8 characters')
  // bcrypt only reads the first 72 bytes, so longer passwords would be silently cut.
  .max(72, 'Password must be 72 characters or fewer')
  .regex(/[A-Za-z]/, 'Password needs at least one letter')
  .regex(/[0-9]/, 'Password needs at least one digit');

const name = z
  .string({ error: 'Enter your full name' })
  .trim()
  .min(2, 'Name must be at least 2 characters')
  .max(80, 'Name must be 80 characters or fewer');

// Pakistani mobile: 03xx xxxxxxx or +92 3xx xxxxxxx. Saved as +923001234567.
const PK_MOBILE = /^(?:\+92|0)3\d{9}$/;
const phone = z.preprocess(
  (v) => (v === '' || v === null ? undefined : v),
  z
    .string()
    .transform((s) => s.replace(/[\s-]/g, ''))
    .refine((s) => PK_MOBILE.test(s), 'Enter a Pakistani mobile number, e.g. 0300 1234567 or +92 300 1234567')
    .transform((s) => (s.startsWith('0') ? '+92' + s.slice(1) : s))
    .optional()
);

const role = z
  .string({ error: 'Choose Attendee or Organizer' })
  .refine((r) => PUBLIC_ROLES.includes(r), 'You can only sign up as an Attendee or an Organizer');

const registerSchema = z.object({ name, email, password, phone, role });

// Login only checks that both boxes are filled. We don't say which part is wrong.
const loginSchema = z.object({
  email: z.string({ error: 'Enter your email' }).trim().toLowerCase().min(1, 'Enter your email').max(254),
  password: z.string({ error: 'Enter your password' }).min(1, 'Enter your password').max(1000),
});

// Runs a schema and throws 400 { error, field } on the first problem (same output as validate()).
function parseOrThrow(schema, data) {
  const result = schema.safeParse(data ?? {});
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new HttpError(400, issue.message, issue.path.length ? issue.path.join('.') : null);
  }
  return result.data;
}

module.exports = { PUBLIC_ROLES, password, registerSchema, loginSchema, parseOrThrow };
