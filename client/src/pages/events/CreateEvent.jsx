// Ushna: create an event (W-21 to W-24). The form itself is in EventForm.jsx.
import EventForm from './EventForm';

export default function CreateEvent() {
  return (
    <section>
      <h1>Create event</h1>
      <p className="muted">Save a draft at any step. When everything is filled in, publish it from the Review step.</p>
      <EventForm />
    </section>
  );
}
