// Wraps a page that needs a login.
//   <ProtectedRoute>                        any logged-in user
//   <ProtectedRoute roles={['ORGANIZER']}>  only these roles; others see a 403 message
//
// Logged-out users go to /login. The page they wanted is passed in state.from,
// so the login page can send them back there afterwards if it wants to.

import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import Forbidden from '../pages/Forbidden';

export default function ProtectedRoute({ roles, children }) {
  const { user, isLoggedIn } = useAuth();
  const location = useLocation();

  if (!isLoggedIn) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Forbidden />;
  }

  return children;
}
