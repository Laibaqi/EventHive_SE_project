// Ushna: the 4-step event form (W-21 to W-24). Used by both CreateEvent and EditEvent.
//   1 Basics · 2 Where and when · 3 Tickets · 4 Review (then Publish)
// "Save draft" works on every step. Server errors { error, field } appear under the right
// field, and the form jumps to the step that holds it.
// A published event only lets the description and capacity change; everything else is locked.

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../api';
import {
  TIER_LABELS,
  TIER_TYPES,
  eventToForm,
  formToPayload,
  formatPrice,
  formatRange,
  stepForField,
  toApiTimes,
} from './eventFormat';
import './events.css';

const STEPS = ['Basics', 'Where and when', 'Tickets', 'Review'];
const NEW_VENUE = '__new';
const emptyVenue = { name: '', address: '', contactEmail: '' };

export default function EventForm({ initialEvent = null }) {
  const navigate = useNavigate();
  const isPublished = initialEvent?.status === 'PUBLISHED';

  const [form, setForm] = useState(() => eventToForm(initialEvent));
  const [eventId, setEventId] = useState(initialEvent?.id ?? null);
  const [step, setStep] = useState(1);
  const [lookups, setLookups] = useState({ cities: [], genres: [] });
  const [venueData, setVenueData] = useState({ cityId: '', venues: [] });
  const [newVenue, setNewVenue] = useState(null); // the "Add new venue" mini form, when open
  const [errors, setErrors] = useState({});
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  // Dropdown lists: cities and genres once, venues whenever the city changes.
  useEffect(() => {
    api
      .get('/api/lookups')
      .then(setLookups)
      .catch((err) => setErrors({ form: err.error }));
  }, []);

  useEffect(() => {
    if (!form.cityId) return;
    let ignore = false;
    api
      .get(`/api/venues?cityId=${form.cityId}`)
      .then((data) => {
        if (!ignore) setVenueData({ cityId: form.cityId, venues: data.venues });
      })
      .catch((err) => {
        if (!ignore) setErrors((e) => ({ ...e, venueId: err.error }));
      });
    return () => {
      ignore = true;
    };
  }, [form.cityId]);

  const venues = venueData.cityId === form.cityId ? venueData.venues : [];

  // ---------- Changing values ----------

  function clearError(...fields) {
    setErrors((e) => {
      const next = { ...e, form: undefined };
      for (const f of fields) next[f] = undefined;
      return next;
    });
    setNotice('');
  }

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    clearError(field);
  }

  function chooseCity(cityId) {
    setForm((f) => ({ ...f, cityId, venueId: '' })); // a venue belongs to one city
    setNewVenue(null);
    clearError('cityId', 'venueId');
  }

  function chooseVenue(value) {
    if (value === NEW_VENUE) {
      setNewVenue(emptyVenue);
      return;
    }
    setNewVenue(null);
    set('venueId', value);
  }

  function setTier(index, key, value) {
    setForm((f) => ({
      ...f,
      tiers: f.tiers.map((t, i) => {
        if (i !== index) return t;
        const changed = { ...t, [key]: value };
        if (key === 'type' && value === 'SPECIAL_GUEST') changed.price = '0'; // always free
        return changed;
      }),
    }));
    clearError('tiers', `tiers.${index}.type`, `tiers.${index}.price`, `tiers.${index}.limit`);
  }

  function addTier() {
    setForm((f) => ({ ...f, tiers: [...f.tiers, { type: '', price: '', limit: '' }] }));
    clearError('tiers');
  }

  function removeTier(index) {
    setForm((f) => ({ ...f, tiers: f.tiers.filter((_, i) => i !== index) }));
    setErrors({});
  }

  // ---------- Talking to the API ----------

  function showError(err) {
    setErrors({ [err.field || 'form']: err.error });
    const errorStep = stepForField(err.field);
    if (errorStep) setStep(errorStep);
  }

  // First save creates the draft; after that we update it.
  async function save() {
    const payload = formToPayload(form, isPublished);
    if (eventId) return (await api.patch(`/api/events/${eventId}`, payload)).event;
    const created = (await api.post('/api/events', payload)).event;
    setEventId(created.id);
    return created;
  }

  async function handleSave() {
    setBusy(true);
    setErrors({});
    try {
      await save();
      setNotice(isPublished ? 'Changes saved.' : 'Draft saved. You can finish it later from My events.');
    } catch (err) {
      showError(err);
    } finally {
      setBusy(false);
    }
  }

  async function handlePublish() {
    setBusy(true);
    setErrors({});
    try {
      const saved = await save(); // publish exactly what is on screen
      await api.post(`/api/events/${saved.id}/publish`);
      navigate(`/events/${saved.id}`, { state: { notice: 'Your event is published. It now shows on the calendar.' } });
    } catch (err) {
      showError(err);
      setBusy(false);
    }
  }

  async function addVenue() {
    setBusy(true);
    try {
      const { venue } = await api.post('/api/venues', { ...newVenue, cityId: Number(form.cityId) });
      setVenueData((v) => ({ ...v, venues: [...v.venues, venue].sort((a, b) => a.name.localeCompare(b.name)) }));
      setNewVenue(null);
      set('venueId', String(venue.id));
    } catch (err) {
      setErrors({ [`venue.${err.field || 'form'}`]: err.error });
    } finally {
      setBusy(false);
    }
  }

  // ---------- Small pieces ----------

  const fieldError = (name) =>
    errors[name] ? (
      <p className="error event-field-error" role="alert">
        {errors[name]}
      </p>
    ) : null;

  const lockedNote = isPublished ? <p className="event-locked-note">Can't change after publishing.</p> : null;

  const genreName = lookups.genres.find((g) => String(g.id) === form.genreId)?.name || initialEvent?.genre?.name;
  const cityName = lookups.cities.find((c) => String(c.id) === form.cityId)?.name || initialEvent?.city?.name;
  const venue = venues.find((v) => String(v.id) === form.venueId) || initialEvent?.venue;
  const times = toApiTimes(form.date, form.startTime, form.endTime);
  const usedTypes = form.tiers.map((t) => t.type);
  const limitTotal = form.tiers.reduce((sum, t) => sum + (Number(t.limit) || 0), 0);
  const notSet = <span className="muted">Not set</span>;

  // ---------- Steps ----------

  return (
    <form className="event-form" onSubmit={(e) => e.preventDefault()} noValidate>
      <ol className="event-steps">
        {STEPS.map((label, i) => (
          <li key={label}>
            <button
              type="button"
              className={step === i + 1 ? 'event-step active' : 'event-step'}
              aria-current={step === i + 1 ? 'step' : undefined}
              onClick={() => setStep(i + 1)}
            >
              <span className="event-step-number">{i + 1}</span> {label}
            </button>
          </li>
        ))}
      </ol>

      {errors.form && (
        <p className="error event-form-error" role="alert">
          {errors.form}
        </p>
      )}

      {step === 1 && (
        <fieldset className="event-card">
          <legend>Basics</legend>

          <label className="event-field">
            <span>Title</span>
            <input
              value={form.title}
              maxLength={100}
              disabled={isPublished}
              onChange={(e) => set('title', e.target.value)}
              placeholder="e.g. Lahore Music Night"
            />
            <span className="event-counter">{form.title.length}/100 (at least 5)</span>
            {lockedNote}
            {fieldError('title')}
          </label>

          <label className="event-field">
            <span>Description</span>
            <textarea
              value={form.description}
              maxLength={2000}
              rows={6}
              onChange={(e) => set('description', e.target.value)}
              placeholder="What is the event about? Who is it for?"
            />
            <span className="event-counter">{form.description.length}/2000</span>
            {fieldError('description')}
          </label>

          <label className="event-field">
            <span>Genre</span>
            <select value={form.genreId} disabled={isPublished} onChange={(e) => set('genreId', e.target.value)}>
              <option value="">Choose a genre</option>
              {lookups.genres.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
            {lockedNote}
            {fieldError('genreId')}
          </label>
        </fieldset>
      )}

      {step === 2 && (
        <fieldset className="event-card">
          <legend>Where and when</legend>

          <label className="event-field">
            <span>City</span>
            <select value={form.cityId} disabled={isPublished} onChange={(e) => chooseCity(e.target.value)}>
              <option value="">Choose a city</option>
              {lookups.cities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {fieldError('cityId')}
          </label>

          <label className="event-field">
            <span>Venue</span>
            <select
              value={newVenue ? NEW_VENUE : form.venueId}
              disabled={isPublished || !form.cityId}
              onChange={(e) => chooseVenue(e.target.value)}
            >
              <option value="">{form.cityId ? 'Choose a venue' : 'Choose a city first'}</option>
              {venues.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
              {form.cityId && <option value={NEW_VENUE}>+ Add new venue</option>}
            </select>
            {venue && !newVenue && <span className="event-hint">{venue.address}</span>}
            {lockedNote}
            {fieldError('venueId')}
          </label>

          {newVenue && (
            <div className="event-subcard">
              <h3>New venue in {cityName}</h3>
              {['name', 'address', 'contactEmail'].map((key) => (
                <label className="event-field" key={key}>
                  <span>{key === 'name' ? 'Venue name' : key === 'address' ? 'Address' : 'Contact email (optional)'}</span>
                  <input
                    type={key === 'contactEmail' ? 'email' : 'text'}
                    value={newVenue[key]}
                    maxLength={key === 'name' ? 100 : 200}
                    onChange={(e) => {
                      setNewVenue((v) => ({ ...v, [key]: e.target.value }));
                      clearError(`venue.${key}`);
                    }}
                  />
                  {fieldError(`venue.${key}`)}
                </label>
              ))}
              {fieldError('venue.cityId')}
              {fieldError('venue.form')}
              <div className="event-actions">
                <button type="button" className="button" disabled={busy} onClick={addVenue}>
                  Add venue
                </button>
                <button type="button" className="event-button-secondary" onClick={() => setNewVenue(null)}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="event-row">
            <label className="event-field">
              <span>Date</span>
              <input type="date" value={form.date} disabled={isPublished} onChange={(e) => set('date', e.target.value)} />
            </label>
            <label className="event-field">
              <span>Start time</span>
              <input
                type="time"
                value={form.startTime}
                disabled={isPublished}
                onChange={(e) => set('startTime', e.target.value)}
              />
            </label>
            <label className="event-field">
              <span>End time</span>
              <input type="time" value={form.endTime} disabled={isPublished} onChange={(e) => set('endTime', e.target.value)} />
            </label>
          </div>
          <p className="event-hint">
            Pakistan time (PKT). An end time earlier than the start time means the event ends the next day.
          </p>
          {lockedNote}
          {fieldError('startAt')}
          {fieldError('endAt')}
        </fieldset>
      )}

      {step === 3 && (
        <fieldset className="event-card">
          <legend>Tickets</legend>

          <label className="event-field event-field-small">
            <span>Capacity</span>
            <input
              type="number"
              min={isPublished ? initialEvent.capacity : 1}
              max={500}
              step={1}
              value={form.capacity}
              onChange={(e) => set('capacity', e.target.value)}
            />
            <span className="event-hint">
              {isPublished ? `Can only go up (now ${initialEvent.capacity}, max 500).` : 'Whole number from 1 to 500.'}
            </span>
            {fieldError('capacity')}
          </label>

          <h3 className="event-subheading">Ticket types</h3>
          {lockedNote}
          {form.tiers.length === 0 && <p className="muted">No ticket types yet. Add at least one before publishing.</p>}

          {form.tiers.map((tier, i) => (
            <div className="event-tier" key={i}>
              <label className="event-field">
                <span>Type</span>
                <select value={tier.type} disabled={isPublished} onChange={(e) => setTier(i, 'type', e.target.value)}>
                  <option value="">Choose</option>
                  {TIER_TYPES.filter((t) => t === tier.type || !usedTypes.includes(t)).map((t) => (
                    <option key={t} value={t}>
                      {TIER_LABELS[t]}
                    </option>
                  ))}
                </select>
                {fieldError(`tiers.${i}.type`)}
              </label>
              <label className="event-field">
                <span>Price (PKR)</span>
                <input
                  type="number"
                  min={0}
                  max={1000000}
                  step={1}
                  value={tier.price}
                  disabled={isPublished || tier.type === 'SPECIAL_GUEST'}
                  onChange={(e) => setTier(i, 'price', e.target.value)}
                  placeholder="0 = free"
                />
                {tier.type === 'SPECIAL_GUEST' && <span className="event-hint">Always free</span>}
                {fieldError(`tiers.${i}.price`)}
              </label>
              <label className="event-field">
                <span>Limit (optional)</span>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={tier.limit}
                  disabled={isPublished}
                  onChange={(e) => setTier(i, 'limit', e.target.value)}
                />
                {fieldError(`tiers.${i}.limit`)}
              </label>
              {!isPublished && (
                <button type="button" className="event-remove" onClick={() => removeTier(i)} aria-label={`Remove ticket type ${i + 1}`}>
                  Remove
                </button>
              )}
            </div>
          ))}

          {!isPublished && form.tiers.length < TIER_TYPES.length && (
            <button type="button" className="event-button-secondary" onClick={addTier}>
              + Add ticket type
            </button>
          )}
          {limitTotal > 0 && (
            <p className="event-hint">
              Limits add up to {limitTotal}
              {form.capacity ? ` of ${form.capacity}` : ''}.
            </p>
          )}
          {fieldError('tiers')}
        </fieldset>
      )}

      {step === 4 && (
        <section className="event-card">
          <h2 className="event-review-title">Review</h2>
          <dl className="event-review">
            <ReviewRow label="Title" onEdit={() => setStep(1)}>{form.title || notSet}</ReviewRow>
            <ReviewRow label="Description" onEdit={() => setStep(1)}>
              {form.description ? <span className="event-pre">{form.description}</span> : notSet}
            </ReviewRow>
            <ReviewRow label="Genre" onEdit={() => setStep(1)}>{genreName || notSet}</ReviewRow>
            <ReviewRow label="Venue" onEdit={() => setStep(2)}>
              {venue ? `${venue.name}, ${venue.address}${cityName ? `, ${cityName}` : ''}` : notSet}
            </ReviewRow>
            <ReviewRow label="Date and time" onEdit={() => setStep(2)}>
              {times.startAt ? `${formatRange(times.startAt, times.endAt)} (PKT)` : notSet}
            </ReviewRow>
            <ReviewRow label="Capacity" onEdit={() => setStep(3)}>{form.capacity || notSet}</ReviewRow>
            <ReviewRow label="Tickets" onEdit={() => setStep(3)}>
              {form.tiers.some((t) => t.type) ? (
                <ul className="event-plain-list">
                  {form.tiers
                    .filter((t) => t.type)
                    .map((t) => (
                      <li key={t.type}>
                        {TIER_LABELS[t.type]}: {t.price === '' ? 'no price' : formatPrice(t.price)}
                        {t.limit ? ` (limit ${t.limit})` : ''}
                      </li>
                    ))}
                </ul>
              ) : (
                notSet
              )}
            </ReviewRow>
          </dl>
        </section>
      )}

      {notice && (
        <p className="event-notice" role="status">
          {notice}
        </p>
      )}

      <div className="event-actions event-actions-bar">
        {step > 1 && (
          <button type="button" className="event-button-secondary" onClick={() => setStep(step - 1)}>
            Back
          </button>
        )}
        <button type="button" className="event-button-secondary" disabled={busy} onClick={handleSave}>
          {isPublished ? 'Save changes' : 'Save draft'}
        </button>
        {step < 4 && (
          <button type="button" className="button" onClick={() => setStep(step + 1)}>
            Next
          </button>
        )}
        {step === 4 && !isPublished && (
          <button type="button" className="button" disabled={busy} onClick={handlePublish}>
            {busy ? 'Publishing…' : 'Publish'}
          </button>
        )}
        {eventId && (
          <Link to={`/events/${eventId}`} className="event-link">
            View event
          </Link>
        )}
      </div>
    </form>
  );
}

function ReviewRow({ label, onEdit, children }) {
  return (
    <div className="event-review-row">
      <dt>{label}</dt>
      <dd>{children}</dd>
      <dd>
        <button type="button" className="event-edit-link" onClick={onEdit}>
          Edit
        </button>
      </dd>
    </div>
  );
}
