// Laiba: enter the 6-digit email code (W-03, AUTH-05).
// Code box, Verify, "Resend code" with the 60-second wait, and the server's messages for
// wrong / expired / too many tries.
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../auth/AuthContext';
import { dashboardFor } from '../../auth/dashboards';
import Field from '../../components/Field';
import '../../styles/auth.css';

const WAIT_SECONDS = 60;

export default function VerifyOtp() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user, token, login } = useAuth();

  const [email, setEmail] = useState(params.get('email') || (user && user.email) || '');
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [verified, setVerified] = useState(false);
  // Sign-up adds &sent=1: a code was just sent, so start with the 60-second wait.
  const [wait, setWait] = useState(params.get('sent') ? WAIT_SECONDS : 0);

  useEffect(() => {
    if (wait <= 0) return undefined;
    const t = setTimeout(() => setWait((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  async function verify(e) {
    e.preventDefault();
    setCodeError('');
    setEmailError('');
    setNote('');
    if (!email.trim()) return setEmailError('Enter your email');
    if (!/^\d{6}$/.test(code)) return setCodeError('Enter the 6-digit code from your email');

    setBusy(true);
    try {
      await api.post('/api/auth/verify-otp', { email: email.trim(), code });
      // Already logged in as this person? Mark them verified and go back to the dashboard.
      if (user && token && user.email === email.trim().toLowerCase()) {
        login(token, { ...user, emailVerified: true });
        navigate(dashboardFor(user.role));
        return;
      }
      setVerified(true);
    } catch (err) {
      if (err.field === 'email') setEmailError(err.error);
      else setCodeError(err.error);
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setCodeError('');
    setNote('');
    if (!email.trim()) return setEmailError('Enter your email');
    try {
      const res = await api.post('/api/auth/resend-otp', { email: email.trim() });
      setNote(res.message);
      setWait(WAIT_SECONDS);
    } catch (err) {
      const seconds = /(\d+) seconds/.exec(err.error || '');
      if (seconds) setWait(Number(seconds[1]));
      setNote(err.error);
    }
  }

  if (verified) {
    return (
      <section className="eh-auth">
        <div className="eh-card eh-card--center">
          <div className="eh-tick" aria-hidden="true">✓</div>
          <h1 className="eh-card__title">Email verified</h1>
          <p>Your account is ready. You can now log in.</p>
          <Link className="eh-btn eh-btn--primary eh-btn--block" to={`/login?email=${encodeURIComponent(email.trim())}`}>
            Log in
          </Link>
        </div>
      </section>
    );
  }

  const knownEmail = Boolean(params.get('email'));

  return (
    <section className="eh-auth">
      <form className="eh-card" onSubmit={verify} noValidate>
        <h1 className="eh-card__title">Check your email</h1>
        <p className="eh-card__lead">
          {knownEmail ? (
            <>
              We sent a 6-digit code to <strong>{email}</strong>. It works for 10 minutes.
            </>
          ) : (
            'Enter the 6-digit code we emailed you.'
          )}
        </p>

        {!knownEmail && (
          <Field label="Email" error={emailError}>
            {(a) => (
              <input {...a} className="eh-input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            )}
          </Field>
        )}
        {knownEmail && emailError && <p className="eh-field__error" role="alert">{emailError}</p>}

        <Field label="6-digit code" error={codeError}>
          {(a) => (
            <input
              {...a}
              className="eh-input eh-input--code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="••••••"
              value={code}
              onChange={(e) => {
                setCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                setCodeError('');
              }}
            />
          )}
        </Field>

        <button className="eh-btn eh-btn--primary eh-btn--block" type="submit" disabled={busy}>
          {busy ? 'Checking…' : 'Verify'}
        </button>

        <div className="eh-resend">
          <span>Didn't get it?</span>
          <button type="button" className="eh-link-btn" onClick={resend} disabled={wait > 0}>
            {wait > 0 ? `Resend code in ${wait}s` : 'Resend code'}
          </button>
        </div>
        {note && (
          <p className="eh-help" role="status">
            {note}
          </p>
        )}

        <p className="eh-card__foot">
          Wrong email? <Link to="/register">Sign up again</Link> · <Link to="/login">Log in</Link>
        </p>
      </form>
    </section>
  );
}
