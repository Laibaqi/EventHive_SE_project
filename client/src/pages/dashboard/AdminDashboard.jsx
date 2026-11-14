// Laiba: admin dashboard (AUTH-08). Sprint 1: a welcome message; admin tools come in Sprint 2.
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import '../../styles/auth.css';

export default function AdminDashboard() {
  const { user } = useAuth();
  const firstName = user && user.name ? user.name.split(' ')[0] : '';

  return (
    <section className="eh-page">
      <h1 className="eh-page__title">Welcome{firstName ? `, ${firstName}` : ''}</h1>
      <section className="eh-panel">
        <h2 className="eh-panel__title">Admin</h2>
        <p>Cities, genres, tags and the activity log arrive in the next update.</p>
        <Link className="eh-btn" to="/calendar">
          Open the event calendar
        </Link>
      </section>
    </section>
  );
}
