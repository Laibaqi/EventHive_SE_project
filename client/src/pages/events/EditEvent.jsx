// Ushna: edit an event.
import { useParams } from 'react-router-dom';

export default function EditEvent() {
  const { id } = useParams();

  return (
    <section>
      <h1>Edit event</h1>
      <p className="muted">Coming soon. Event id: {id}</p>
    </section>
  );
}
