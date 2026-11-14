// Laiba: organizer dashboard (W-05, AUTH-08).
// "Create event" button + the organizer's events from Ushna's GET /api/events/mine.
// Unverified organizers see the banner and a greyed Create button (AUTH-05).
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../auth/AuthContext';
import VerifyBanner from '../../components/VerifyBanner';
import { formatPKT } from '../../lib/authRules';
import '../../styles/auth.css';

const STATUS_LABEL = { DRAFT: 'Draft', PUBLISHED: 'Published' };

// Ushna's reply shape isn't fixed yet: accept [..] or { events: [..] }.
const toList = (data) => (Array.isArray(data) ? data : (data && data.events) || []);
const cityOf = (e) => (e.city && e.city.name) || e.cityName || (e.venue && e.venue.city && e.venue.city.name) || '–';

export default function OrganizerDashboard() {
  const { user } = useAuth();
  const [events, setEvents] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    api
      .get('/api/events/mine')
      .then((data) => alive && setEvents(toList(data)))
      .catch((err) => alive && setError(err.status === 404 ? "My events isn't available yet." : err.error));
    return () => {
      alive = false;
    };
  }, []);

  const verified = Boolean(user && user.emailVerified);

  return (
    <section className="eh-page">
      <VerifyBanner user={user} action="create events" />

      <div className="eh-page__head">
        <h1 className="eh-page__title">My events</h1>
        {verified ? (
          <Link className="eh-btn eh-btn--primary" to="/events/new">
            + Create event
          </Link>
        ) : (
          <div className="eh-disabled-wrap">
            <button className="eh-btn eh-btn--primary" type="button" disabled aria-describedby="create-hint">
              + Create event
            </button>
            <span id="create-hint" className="eh-help">Verify your email to create events.</span>
          </div>
        )}
      </div>

      {error && <div className="eh-alert">{error}</div>}
      {!error && events === null && <p className="eh-muted">Loading your events…</p>}

      {events && events.length === 0 && (
        <div className="eh-empty">
          <p>You haven't created any events yet.</p>
          {verified && (
            <Link className="eh-btn eh-btn--primary" to="/events/new">
              Create your first event
            </Link>
          )}
        </div>
      )}

      {events && events.length > 0 && (
        <div className="eh-table-wrap">
          <table className="eh-table">
            <thead>
              <tr>
                <th scope="col">Event</th>
                <th scope="col">Date (PKT)</th>
                <th scope="col">City</th>
                <th scope="col">Status</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id}>
                  <td data-label="Event">{e.title || 'Untitled draft'}</td>
                  <td data-label="Date (PKT)">{formatPKT(e.startAt)}</td>
                  <td data-label="City">{cityOf(e)}</td>
                  <td data-label="Status">
                    <span className={`eh-pill eh-pill--${String(e.status).toLowerCase()}`}>
                      {STATUS_LABEL[e.status] || e.status}
                    </span>
                  </td>
                  <td data-label="Actions">
                    <span className="eh-actions">
                      <Link to={`/events/${e.id}/edit`}>Edit</Link>
                      {e.status === 'PUBLISHED' && <Link to={`/events/${e.id}`}>View</Link>}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="eh-muted">
            {events.length} {events.length === 1 ? 'event' : 'events'} · <Link to="/events/mine">Open My events</Link>
          </p>
        </div>
      )}
    </section>
  );
}
