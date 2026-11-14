// Laiba: attendee dashboard (W-04, AUTH-08). Sprint 1: a welcome and a link to the calendar.
// Tickets and the event feed come in Sprint 2.
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import VerifyBanner from '../../components/VerifyBanner';
import '../../styles/auth.css';

export default function AttendeeDashboard() {
  const { user } = useAuth();
  const firstName = user && user.name ? user.name.split(' ')[0] : '';

  return (
    <section className="eh-page">
      <VerifyBanner user={user} action="get tickets" />
      <h1 className="eh-page__title">Welcome back{firstName ? `, ${firstName}` : ''}</h1>

      <section className="eh-panel">
        <h2 className="eh-panel__title">Find something to do</h2>
        <p>See every published event by date and open any one for details.</p>
        <Link className="eh-btn eh-btn--primary" to="/calendar">
          Open the event calendar
        </Link>
      </section>

      <section className="eh-panel eh-panel--muted">
        <h2 className="eh-panel__title">My upcoming tickets</h2>
        <p className="eh-muted">You don't have any tickets yet. Tickets arrive in the next update.</p>
      </section>
    </section>
  );
}
