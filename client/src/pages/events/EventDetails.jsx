// Ushna: event details. Public, because guests open it from Hamza's calendar.
// Drafts are only visible to their owner (the API sends 404 to everyone else).
import { Link, useLocation, useParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { TIER_LABELS, formatPrice, formatRange, sortTiers } from './eventFormat';
import { useEvent } from './useEvent';
import './events.css';

export default function EventDetails() {
  const { id } = useParams();
  const location = useLocation();
  const { user } = useAuth();
  const { loading, event, error, notFound } = useEvent(id);

  if (loading) return <p className="muted">Loading…</p>;

  if (notFound || error) {
    return (
      <section className="message-page">
        <h1>{notFound ? 'Event not found' : 'Something went wrong'}</h1>
        <p className="muted">{notFound ? "This event doesn't exist or isn't published yet." : error}</p>
        <Link to="/calendar" className="button">
          Back to calendar
        </Link>
      </section>
    );
  }

  const isOwner = Boolean(user && user.id === event.organizerId);
  const isDraft = event.status !== 'PUBLISHED';
  const notice = location.state?.notice;

  return (
    <article className="event-details">
      {notice && (
        <p className="event-notice" role="status">
          {notice}
        </p>
      )}

      <Link to={isOwner ? '/events/mine' : '/calendar'} className="event-link">
        ← {isOwner ? 'My events' : 'Calendar'}
      </Link>

      <header className="event-details-header">
        <div>
          {isDraft && <span className="event-badge draft">Draft: only you can see this</span>}
          {event.genre && <span className="event-badge genre">{event.genre.name}</span>}
          <h1>{event.title || 'Untitled event'}</h1>
        </div>
        {isOwner && (
          <Link to={`/events/${event.id}/edit`} className="button">
            Edit
          </Link>
        )}
      </header>

      <div className="event-card event-facts">
        <div>
          <h2>When</h2>
          <p>{formatRange(event.startAt, event.endAt)}</p>
          <p className="muted">Pakistan time (PKT)</p>
        </div>
        <div>
          <h2>Where</h2>
          {event.venue ? (
            <>
              <p>{event.venue.name}</p>
              <p className="muted">
                {event.venue.address}
                {event.city ? `, ${event.city.name}` : ''}
              </p>
            </>
          ) : (
            <p className="muted">Venue not set</p>
          )}
        </div>
        <div>
          <h2>Capacity</h2>
          <p>{event.capacity ? `${event.capacity} people` : <span className="muted">Not set</span>}</p>
        </div>
      </div>

      <section className="event-card">
        <h2>About this event</h2>
        {event.description ? (
          <p className="event-pre">{event.description}</p>
        ) : (
          <p className="muted">No description yet.</p>
        )}
      </section>

      <section className="event-card">
        <h2>Tickets</h2>
        {event.tiers.length === 0 ? (
          <p className="muted">No ticket types yet.</p>
        ) : (
          <ul className="event-tickets">
            {sortTiers(event.tiers).map((tier) => (
              <li key={tier.id}>
                <span>{TIER_LABELS[tier.type]}</span>
                <strong>{formatPrice(tier.price)}</strong>
              </li>
            ))}
          </ul>
        )}
      </section>
    </article>
  );
}
