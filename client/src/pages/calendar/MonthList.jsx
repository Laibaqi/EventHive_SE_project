// Hamza: phone view. A simple list of the month's events, grouped by day.
import EventChip from './EventChip';
import { dayHeading } from './dates';

export default function MonthList({ eventsByDay, today }) {
  // Day keys are YYYY-MM-DD, so sorting them as text puts them in date order.
  const days = Object.keys(eventsByDay).sort();
  if (days.length === 0) return null;

  return (
    <div className="calendar-list">
      {days.map((dayKey) => (
        <section key={dayKey} className="calendar-list-day">
          <h3 className={dayKey === today ? 'calendar-list-heading calendar-today' : 'calendar-list-heading'}>
            {dayHeading(dayKey)}
            {dayKey === today && ' · Today'}
          </h3>
          <ul>
            {eventsByDay[dayKey].map((event) => (
              <li key={event.id}>
                <EventChip event={event} showPlace />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
