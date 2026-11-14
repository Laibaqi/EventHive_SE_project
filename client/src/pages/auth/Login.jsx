// Laiba: login page (W-01, AUTH-02).
// One login for every role, the lock message, a "Forgot password?" link to Zain's page,
// then login(token, user) and go to the dashboard, or back to the page the user wanted
// (Hamza's ProtectedRoute passes it as state.from; ?next= also works).
import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../auth/AuthContext';
import { dashboardFor } from '../../auth/dashboards';
import Field from '../../components/Field';
import { checkLogin, safeNext } from '../../lib/authRules';
import '../../styles/auth.css';

export default function Login() {
  const [params] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isLoggedIn, login } = useAuth();

  const [form, setForm] = useState({ email: params.get('email') || '', password: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [locked, setLocked] = useState(false);
  const [busy, setBusy] = useState(false);

  const next = safeNext((location.state && location.state.from) || params.get('next'));
  const passwordChanged = params.get('changed') === '1' || (location.state && location.state.passwordChanged);

  const set = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setErrors((errs) => ({ ...errs, [key]: undefined }));
  };

  async function submit(e) {
    e.preventDefault();
    setFormError('');
    setLocked(false);
    const found = checkLogin(form);
    setErrors(found);
    if (Object.keys(found).length) return;

    setBusy(true);
    try {
      const res = await api.post('/api/auth/login', { email: form.email.trim(), password: form.password });
      login(res.token, res.user);
      navigate(next || res.dashboard || dashboardFor(res.user.role), { replace: true });
    } catch (err) {
      if (err.field) setErrors({ [err.field]: err.error });
      else {
        setFormError(err.error); // wrong details (401), locked (423) or too many tries (429)
        setLocked(err.status === 423);
      }
    } finally {
      setBusy(false);
    }
  }

  // Already logged in: go to the dashboard (or back to the page they wanted).
  if (isLoggedIn) return <Navigate to={next || dashboardFor(user.role)} replace />;

  return (
    <section className="eh-auth">
      <form className="eh-card" onSubmit={submit} noValidate>
        <h1 className="eh-card__title">Log in to EventHive</h1>
        <p className="eh-card__lead">One login for attendees, organizers and admins.</p>

        {passwordChanged && (
          <div className="eh-alert eh-alert--ok" role="status">
            Password changed. Log in with your new password.
          </div>
        )}
        {next && !formError && (
          <div className="eh-alert eh-alert--info" role="status">
            Log in to continue. You'll come straight back.
          </div>
        )}
        {formError && (
          <div className="eh-alert" role="alert">
            {formError}
            {locked && (
              <>
                {' '}
                <Link to="/forgot-password">Reset password →</Link>
              </>
            )}
          </div>
        )}

        <Field label="Email" error={errors.email}>
          {(a) => <input {...a} className="eh-input" type="email" autoComplete="email" value={form.email} onChange={set('email')} />}
        </Field>

        <Field label="Password" error={errors.password}>
          {(a) => (
            <input {...a} className="eh-input" type="password" autoComplete="current-password" value={form.password} onChange={set('password')} />
          )}
        </Field>

        <p className="eh-help eh-help--right">
          <Link to="/forgot-password">Forgot password?</Link>
        </p>

        <button className="eh-btn eh-btn--primary eh-btn--block" type="submit" disabled={busy}>
          {busy ? 'Logging in…' : 'Log in'}
        </button>

        <p className="eh-card__foot">
          New to EventHive? <Link to="/register">Create an account</Link>
        </p>
      </form>
    </section>
  );
}
