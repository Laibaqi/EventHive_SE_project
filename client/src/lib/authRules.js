// Screen-side checks for the sign-up and login forms. Same rules and messages as the
// server's src/auth/schemas.js (SRS Appendix G: "checked on screen AND server").
// The server is still the final judge; these just give instant feedback.

export function checkRegister({ name, email, password, phone, role, privacy }) {
  const errors = {};
  const n = name.trim();
  const e = email.trim();
  const p = phone.replace(/[\s-]/g, '');

  if (!n) errors.name = 'Enter your full name';
  else if (n.length < 2) errors.name = 'Name must be at least 2 characters';
  else if (n.length > 80) errors.name = 'Name must be 80 characters or fewer';

  if (!e) errors.email = 'Enter your email';
  else if (e.length > 254) errors.email = 'Email must be 254 characters or fewer';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) errors.email = 'Enter a valid email address';

  if (!password) errors.password = 'Enter a password';
  else if (password.length < 8) errors.password = 'Password must be at least 8 characters';
  else if (password.length > 72) errors.password = 'Password must be 72 characters or fewer';
  else if (!/[A-Za-z]/.test(password)) errors.password = 'Password needs at least one letter';
  else if (!/[0-9]/.test(password)) errors.password = 'Password needs at least one digit';

  if (p && !/^(?:\+92|0)3\d{9}$/.test(p)) {
    errors.phone = 'Enter a Pakistani mobile number, e.g. 0300 1234567 or +92 300 1234567';
  }

  if (!['ATTENDEE', 'ORGANIZER'].includes(role)) errors.role = 'Choose Attendee or Organizer';
  if (!privacy) errors.privacy = 'Please confirm you have read the privacy notice';

  return errors;
}

export function checkLogin({ email, password }) {
  const errors = {};
  if (!email.trim()) errors.email = 'Enter your email';
  if (!password) errors.password = 'Enter your password';
  return errors;
}

// Only allow coming back to a page on our own site after login (stops ?next=https://evil.com).
export function safeNext(path) {
  return typeof path === 'string' && path.startsWith('/') && !path.startsWith('//') ? path : null;
}

// Show a UTC time in Pakistan time (team rule: store UTC, show PKT).
export function formatPKT(iso) {
  if (!iso) return 'Not set';
  return new Intl.DateTimeFormat('en-PK', {
    timeZone: 'Asia/Karachi',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso));
}
