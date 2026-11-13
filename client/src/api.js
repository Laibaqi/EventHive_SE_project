// One fetch helper for the whole app.
//
// Usage:
//   import { api } from '../api';
//   const data = await api.get('/api/calendar?month=2026-11');
//   const data = await api.post('/api/auth/login', { email, password });
//
// On an error reply it throws an ApiError with the server's { error, field },
// so a form can show the message under the right input:
//   try {
//     await api.post('/api/auth/register', form);
//   } catch (err) {
//     setErrors({ [err.field || 'form']: err.error });
//   }
//
// A 401 on a request made while logged in means the session is no longer valid
// (expired, logged out elsewhere, password reset), so we clear the login and go to /login.
// A 401 without a token (e.g. wrong password on the login form) is just returned as an error.

import { getToken, clearLogin } from './auth/storage';

const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export class ApiError extends Error {
  constructor(status, message, field) {
    super(message);
    this.status = status;
    this.error = message;
    this.field = field;
  }
}

// Some replies have no body (e.g. 204 from logout), so reading JSON can fail.
async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function request(method, path, body) {
  const token = getToken();
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(baseUrl + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "Can't reach the server. Check your connection and try again.", null);
  }

  const data = await readJson(response);
  if (response.ok) return data;

  if (response.status === 401 && token) {
    clearLogin();
    window.location.assign('/login');
  }

  const message = (data && data.error) || 'Something went wrong. Please try again.';
  const field = (data && data.field) || null;
  throw new ApiError(response.status, message, field);
}

export const api = {
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, body),
  patch: (path, body) => request('PATCH', path, body),
  delete: (path) => request('DELETE', path),
};
