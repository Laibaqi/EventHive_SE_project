// Keeps the logged-in user and token for the whole app.
//
// Laiba, after a successful login:
//   const { login } = useAuth();
//   const data = await api.post('/api/auth/login', { email, password });
//   login(data.token, data.user);
//   navigate(data.dashboard);
//
// Anywhere else:
//   const { user, isLoggedIn, logout } = useAuth();
//   user = { id, name, email, role, emailVerified }

import { createContext, useContext, useState } from 'react';
import { api } from '../api';
import { getToken, getSavedUser, saveLogin, clearLogin } from './storage';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // Read once on page load so a refresh keeps the user logged in.
  const [token, setToken] = useState(getToken);
  const [user, setUser] = useState(getSavedUser);

  function login(newToken, newUser) {
    saveLogin(newToken, newUser);
    setToken(newToken);
    setUser(newUser);
  }

  async function logout() {
    try {
      // Ends the session on the server too, so the old token stops working.
      await api.post('/api/auth/logout');
    } catch {
      // Even if the server can't be reached, the user is logged out on this device.
    }
    clearLogin();
    setToken(null);
    setUser(null);
  }

  const value = {
    token,
    user,
    isLoggedIn: Boolean(token && user),
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Kept in this file so everyone imports it from one place (team brief).
// eslint-disable-next-line react/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return context;
}
