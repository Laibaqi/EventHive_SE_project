// Ushna: the organizer's own events (W-25), newest first.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api';
import { formatDateTime } from './eventFormat';
import './events.css';

export default function MyEvents() {
  const [result, setResult] = useState({ loading: true, events: [], error: '' });
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let ignore = false;
    api
      .get('/api/events/mine')
      .then((data) => {
        if (!ignore) setResult({ loading: false, events: data.events, error: '' });
      })
      .catch((err) => {
        if (!ignore) setResult({ loading: false, events: [], error: err.error });
      });
    return () => {
      ignore = true;
    };
  }, [retry]);

  const { loading, events, error } = result;

  return (
    <section>
      <div className="event-page-header">
        <h1>My events</h1>
        <Link to="/events/new" className="button">
          + Create event
        </Link>
      </div>

      {loading && <p className="muted">Loading…</p>}

      {error && (
        <div className="event-card">
          <p className="error">{error}</p>
          <button type="button" className="event-button-secondary" onClick={() => setRetry(retry + 1)}>
            Try again
          </button>
        </div>
      )}

      {!loading && !error && events.length === 0 && (
        <div className="event-empty">
          <p>You haven't created any events yet.</p>
          <Link to="/events/new" className="button">
            Create your first event
          </Link>
        </div>
      )}

      {events.length > 0 && (
        <ul className="event-list">
          {events.map((event) => (
            <li key={event.id} className="event-list-item">
              <div className="event-list-main">
                <span className={event.status === 'PUBLISHED' ? 'event-badge published' : 'event-badge draft'}>
                  {event.status === 'PUBLISHED' ? 'Published' : 'Draft'}
                </span>
                <h2 className="event-list-title">{event.title || 'Untitled event'}</h2>
                <p className="muted event-list-meta">
                  {formatDateTime(event.startAt)}
                  {event.city ? ` · ${event.city.name}` : ''}
                </p>
              </div>
              <div className="event-actions">
                <Link to={`/events/${event.id}/edit`} className="event-button-secondary">
                  Edit
                </Link>
                <Link to={`/events/${event.id}`} className="event-button-secondary">
                  View
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
