// Ushna: edit an event (W-26). Same form as Create, filled in.
// For published events the fields that can't change are locked (greyed out with a note).
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import EventForm from './EventForm';
import { useEvent } from './useEvent';

export default function EditEvent() {
  const { id } = useParams();
  const { user } = useAuth();
  const { loading, event, error, notFound } = useEvent(id);

  if (loading) return <p className="muted">Loading…</p>;

  if (notFound || error) {
    return (
      <section className="message-page">
        <h1>{notFound ? 'Event not found' : 'Something went wrong'}</h1>
        <p className="muted">{notFound ? "This event doesn't exist or isn't yours." : error}</p>
        <Link to="/events/mine" className="button">
          Back to My events
        </Link>
      </section>
    );
  }

  if (event.organizerId !== user.id) {
    return (
      <section className="message-page">
        <h1>Not your event</h1>
        <p className="muted">You can only edit your own events.</p>
        <Link to={`/events/${event.id}`} className="button">
          View event
        </Link>
      </section>
    );
  }

  const published = event.status === 'PUBLISHED';
  return (
    <section>
      <h1>Edit event</h1>
      <p className="muted">
        {published
          ? 'This event is published, so only the description and capacity can change (capacity can only go up).'
          : 'This is a draft. You can change anything, then publish it from the Review step.'}
      </p>
      {/* key: a different event gets a fresh form */}
      <EventForm key={event.id} initialEvent={event} />
    </section>
  );
}
