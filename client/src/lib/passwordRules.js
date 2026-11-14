// Screen-side password rule for the password pages (W-15, W-16, W-47).
// Same rule and messages as the server (src/auth/schemas.js): 8-72 characters,
// at least one letter and one digit. The server is still the final judge.
export function checkNewPassword(password) {
  if (!password) return 'Enter a password';
  if (password.length < 8) return 'Password must be at least 8 characters';
  if (password.length > 72) return 'Password must be 72 characters or fewer';
  if (!/[A-Za-z]/.test(password)) return 'Password needs at least one letter';
  if (!/[0-9]/.test(password)) return 'Password needs at least one digit';
  return '';
}
