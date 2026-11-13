// Where the login is kept in the browser. api.js and AuthContext both use these,
// so the token and user are always read and cleared in one place.
const TOKEN_KEY = 'eventhive_token';
const USER_KEY = 'eventhive_user';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getSavedUser() {
  const saved = localStorage.getItem(USER_KEY);
  if (!saved) return null;
  try {
    return JSON.parse(saved);
  } catch {
    // Damaged value in storage: treat it as logged out.
    return null;
  }
}

export function saveLogin(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearLogin() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}
