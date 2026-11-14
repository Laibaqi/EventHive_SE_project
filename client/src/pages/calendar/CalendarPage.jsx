// Hamza: month calendar of published events. Public, so guests can browse.
// The month lives in the address (/calendar?month=2026-11), so refresh and Back keep it.
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../api';
import {
  buildMonthGrid,
  currentMonth,
  groupByDay,
  isValidMonth,
  monthLabel,
  shiftMonth,
  todayKey,
} from './dates';
import MonthGrid from './MonthGrid';
import MonthList from './MonthList';
import './calendar.css';

export default function CalendarPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const monthParam = searchParams.get('month');
  const month = isValidMonth(monthParam) ? monthParam : currentMonth();

  const [retryCount, setRetryCount] = useState(0); // bumped by "Try again" to fetch again
  const requestKey = `${month}#${retryCount}`;

  // The last reply we got, tagged with the request it answers.
  const [result, setResult] = useState({ key: null, events: [], error: '' });

  useEffect(() => {
    // If the user changes month before this reply arrives, ignore the old reply.
    let ignore = false;

    api
      .get(`/api/calendar?month=${month}`)
      .then((data) => {
        if (!ignore) setResult({ key: requestKey, events: data.events, error: '' });
      })
      .catch((err) => {
        if (!ignore) setResult({ key: requestKey, events: [], error: err.error });
      });

    return () => {
      ignore = true;
    };
  }, [month, requestKey]);

  // Still loading while the last reply is for a different month (or an older try).
  const loading = result.key !== requestKey;
  const events = loading ? [] : result.events;
  const error = loading ? '' : result.error;

  function goToMonth(newMonth) {
    setSearchParams({ month: newMonth });
  }

  const label = monthLabel(month);
  const eventsByDay = groupByDay(events);
  const today = todayKey();

  return (
    <section className="calendar">
      <div className="calendar-header">
        <div>
          <h1>Calendar</h1>
          <p className="muted calendar-note">All times are Pakistan time (PKT).</p>
        </div>

        <div className="calendar-toolbar">
          <div className="calendar-nav">
            <button type="button" className="calendar-nav-button" onClick={() => goToMonth(shiftMonth(month, -1))}>
              <span aria-hidden="true">‹ </span>Previous
            </button>
            <button type="button" className="calendar-nav-button" onClick={() => goToMonth(currentMonth())}>
              Today
            </button>
            <button type="button" className="calendar-nav-button" onClick={() => goToMonth(shiftMonth(month, 1))}>
              Next<span aria-hidden="true"> ›</span>
            </button>
          </div>
          {/* aria-live so screen readers announce the new month after Previous / Next */}
          <h2 className="calendar-month" aria-live="polite">
            {label}
          </h2>
        </div>
      </div>

      {loading && (
        <p className="calendar-message muted" role="status">
          Loading events…
        </p>
      )}

      {error && (
        <div className="calendar-message calendar-error" role="alert">
          <p className="error">{error}</p>
          <button type="button" className="button" onClick={() => setRetryCount((count) => count + 1)}>
            Try again
          </button>
        </div>
      )}

      {!loading && !error && events.length === 0 && (
        <p className="calendar-message calendar-empty">No events in {label} yet. Try another month.</p>
      )}

      {/* Both views are rendered; calendar.css shows the list below 640px and the grid above it.
          key={month} resets the grid's "+N more" state when the month changes. */}
      <MonthGrid key={month} weeks={buildMonthGrid(month)} eventsByDay={eventsByDay} today={today} />
      <MonthList eventsByDay={eventsByDay} today={today} />
    </section>
  );
}
