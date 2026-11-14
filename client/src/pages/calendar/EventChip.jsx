// Hamza: one event on the calendar. Clicking it opens Ushna's details page.
import { Link } from 'react-router-dom';
import { formatTime } from './dates';

export default function EventChip({ event, showPlace = false }) {
  const title = event.title || 'Untitled event';
  const time = formatTime(event.startAt);
  const place = [event.venue?.name, event.city?.name].filter(Boolean).join(' · ');

  return (
    // title= shows the full text on hover, because long titles are cut off in the grid.
    <Link to={`/events/${event.id}`} className="calendar-chip" title={`${time} ${title}`}>
      <span className="calendar-chip-time">{time}</span>
      <span className="calendar-chip-title">{title}</span>
      {showPlace && place && <span className="calendar-chip-place">{place}</span>}
    </Link>
  );
}
