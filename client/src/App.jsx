// Every Sprint 1 screen and who owns it. Each owner fills in their own page file;
// this file only needs changing when a new route is added.

import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './auth/ProtectedRoute';
import { useAuth } from './auth/AuthContext';
import { dashboardFor } from './auth/dashboards';

// Laiba
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import VerifyOtp from './pages/auth/VerifyOtp';
import AttendeeDashboard from './pages/dashboard/AttendeeDashboard';
import OrganizerDashboard from './pages/dashboard/OrganizerDashboard';
import AdminDashboard from './pages/dashboard/AdminDashboard';
// Zain
import ForgotPassword from './pages/password/ForgotPassword';
import ResetPassword from './pages/password/ResetPassword';
import ChangePassword from './pages/password/ChangePassword';
// Ushna
import CreateEvent from './pages/events/CreateEvent';
import MyEvents from './pages/events/MyEvents';
import EventDetails from './pages/events/EventDetails';
import EditEvent from './pages/events/EditEvent';
// Hamza
import CalendarPage from './pages/calendar/CalendarPage';
import NotFound from './pages/NotFound';

// "/" sends logged-in users to their dashboard and guests to the calendar.
function Home() {
  const { user, isLoggedIn } = useAuth();
  return <Navigate to={isLoggedIn ? dashboardFor(user.role) : '/calendar'} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />

        {/* Laiba: sign-up, OTP, login */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/verify-otp" element={<VerifyOtp />} />

        {/* Laiba: role dashboards */}
        <Route
          path="/dashboard/attendee"
          element={
            <ProtectedRoute roles={['ATTENDEE']}>
              <AttendeeDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/organizer"
          element={
            <ProtectedRoute roles={['ORGANIZER']}>
              <OrganizerDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/admin"
          element={
            <ProtectedRoute roles={['ADMIN']}>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />

        {/* Zain: passwords */}
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route
          path="/settings/password"
          element={
            <ProtectedRoute>
              <ChangePassword />
            </ProtectedRoute>
          }
        />

        {/* Ushna: events. React Router matches /events/new before /events/:id on its own. */}
        <Route
          path="/events/new"
          element={
            <ProtectedRoute roles={['ORGANIZER']}>
              <CreateEvent />
            </ProtectedRoute>
          }
        />
        <Route
          path="/events/mine"
          element={
            <ProtectedRoute roles={['ORGANIZER']}>
              <MyEvents />
            </ProtectedRoute>
          }
        />
        <Route path="/events/:id" element={<EventDetails />} />
        <Route
          path="/events/:id/edit"
          element={
            <ProtectedRoute roles={['ORGANIZER']}>
              <EditEvent />
            </ProtectedRoute>
          }
        />

        {/* Hamza: calendar (public) and 404 */}
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
