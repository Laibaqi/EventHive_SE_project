// Hamza: month grid (Monday to Sunday) for tablets and desktops.
import { useState } from 'react';
import EventChip from './EventChip';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MAX_CHIPS = 3; // more than this in a day shows "+N more"

export default function MonthGrid({ weeks, eventsByDay, today }) {
  // The day whose "+N more" was clicked, so it shows all its events.
  const [expandedDay, setExpandedDay] = useState(null);

  return (
    <div className="calendar-grid">
      {WEEKDAYS.map((name) => (
        <div key={name} className="calendar-weekday">
          {name}
        </div>
      ))}

      {weeks.flat().map((dayKey, index) => {
        if (!dayKey) {
          return <div key={`blank-${index}`} className="calendar-day calendar-day-blank" />;
        }

        const dayEvents = eventsByDay[dayKey] || [];
        const isExpanded = expandedDay === dayKey;
        const shownEvents = isExpanded ? dayEvents : dayEvents.slice(0, MAX_CHIPS);
        const hiddenCount = dayEvents.length - shownEvents.length;
        const isToday = dayKey === today;

        return (
          <div key={dayKey} className={isToday ? 'calendar-day calendar-today' : 'calendar-day'}>
            <span className="calendar-day-number" aria-current={isToday ? 'date' : undefined}>
              {Number(dayKey.slice(8))}
            </span>

            {shownEvents.map((event) => (
              <EventChip key={event.id} event={event} />
            ))}

            {hiddenCount > 0 && (
              <button type="button" className="calendar-more" onClick={() => setExpandedDay(dayKey)}>
                +{hiddenCount} more
              </button>
            )}
            {isExpanded && dayEvents.length > MAX_CHIPS && (
              <button type="button" className="calendar-more" onClick={() => setExpandedDay(null)}>
                Show less
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
