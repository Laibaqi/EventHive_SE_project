// Laiba: sign-up page (W-02, AUTH-05, AUTH-03).
// Role choice (Attendee / Organizer only), errors under each field, privacy notice,
// then POST /api/auth/register and go to /verify-otp?email=...
import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../auth/AuthContext';
import { dashboardFor } from '../../auth/dashboards';
import Field from '../../components/Field';
import { checkRegister } from '../../lib/authRules';
import '../../styles/auth.css';

const ROLES = [
  { value: 'ATTENDEE', title: 'Attendee', text: 'Find events and get tickets' },
  { value: 'ORGANIZER', title: 'Organizer', text: 'Create and run events' },
];

export default function Register() {
  const navigate = useNavigate();
  const { user, isLoggedIn } = useAuth();
  const [form, setForm] = useState({ role: 'ATTENDEE', name: '', phone: '', email: '', password: '', privacy: false });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (key) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((errs) => ({ ...errs, [key]: undefined }));
  };

  async function submit(e) {
    e.preventDefault();
    setFormError('');
    const found = checkRegister(form);
    setErrors(found);
    if (Object.keys(found).length) return; // nothing is sent until every field passes

    setBusy(true);
    try {
      const { name, email, password, phone, role } = form;
      const res = await api.post('/api/auth/register', { name, email, password, phone: phone || undefined, role });
      navigate(`/verify-otp?email=${encodeURIComponent(res.email || email.trim().toLowerCase())}&sent=1`);
    } catch (err) {
      if (err.field) setErrors({ [err.field]: err.error });
      else setFormError(err.error);
    } finally {
      setBusy(false);
    }
  }

  // Already logged in: no need to sign up again.
  if (isLoggedIn) return <Navigate to={dashboardFor(user.role)} replace />;

  const emailTaken = errors.email && /already exists/i.test(errors.email);

  return (
    <section className="eh-auth">
      <form className="eh-card" onSubmit={submit} noValidate>
        <h1 className="eh-card__title">Create your EventHive account</h1>

        {formError && (
          <div className="eh-alert" role="alert">
            {formError}
          </div>
        )}

        <fieldset className="eh-roles">
          <legend className="eh-field__label">I want to…</legend>
          {ROLES.map((r) => (
            <label key={r.value} className={`eh-role${form.role === r.value ? ' eh-role--on' : ''}`}>
              <input type="radio" name="role" value={r.value} checked={form.role === r.value} onChange={set('role')} />
              <span className="eh-role__title">{r.title}</span>
              <span className="eh-role__text">{r.text}</span>
            </label>
          ))}
          {errors.role && <p className="eh-field__error" role="alert">{errors.role}</p>}
        </fieldset>

        <Field label="Full name" hint="2 to 80 characters" error={errors.name}>
          {(a) => <input {...a} className="eh-input" autoComplete="name" value={form.name} onChange={set('name')} />}
        </Field>

        <Field label="Phone" optional hint="03xx xxxxxxx or +92 3xx xxxxxxx" error={errors.phone}>
          {(a) => <input {...a} className="eh-input" type="tel" autoComplete="tel" value={form.phone} onChange={set('phone')} />}
        </Field>

        <Field label="Email" error={errors.email}>
          {(a) => <input {...a} className="eh-input" type="email" autoComplete="email" value={form.email} onChange={set('email')} />}
        </Field>
        {emailTaken && (
          <p className="eh-help">
            <Link to={`/login?email=${encodeURIComponent(form.email.trim())}`}>Log in instead?</Link>
          </p>
        )}

        <Field label="Password" hint="At least 8 characters, with a letter and a digit" error={errors.password}>
          {(a) => (
            <input {...a} className="eh-input" type="password" autoComplete="new-password" value={form.password} onChange={set('password')} />
          )}
        </Field>

        <div className="eh-privacy">
          <strong>Privacy notice.</strong> We only collect your name, email and (if you add it) phone number, to run
          your account and tickets. Organizers see your name on their attendee list.
          <label className="eh-check">
            <input type="checkbox" checked={form.privacy} onChange={set('privacy')} />
            I have read the privacy notice
          </label>
          {errors.privacy && <p className="eh-field__error" role="alert">{errors.privacy}</p>}
        </div>

        <button className="eh-btn eh-btn--primary eh-btn--block" type="submit" disabled={busy}>
          {busy ? 'Creating account…' : 'Create account'}
        </button>

        <p className="eh-card__foot">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </form>
    </section>
  );
}
