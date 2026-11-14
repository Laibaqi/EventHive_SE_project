// Ushna: event details. Public, because guests open it from the calendar.
import { useParams } from 'react-router-dom';

export default function EventDetails() {
  const { id } = useParams();

  return (
    <section>
      <h1>Event details</h1>
      <p className="muted">Coming soon. Event id: {id}</p>
    </section>
  );
}
