// Zain: forgot password, asks for the email (W-15, AUTH-06).
// Enter email -> "Check your email" message -> link to the reset page.
// The server gives the same reply for every email, so this page never says
// whether an account exists.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api';
import Field from '../../components/Field';
import '../../styles/auth.css';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState('');

  async function submit(e) {
    e.preventDefault();
    setFormError('');
    const value = email.trim();
    if (!value) return setEmailError('Enter your email');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return setEmailError('Enter a valid email address');
    setEmailError('');

    setBusy(true);
    try {
      await api.post('/api/auth/forgot', { email: value });
      setSentTo(value);
    } catch (err) {
      if (err.field === 'email') setEmailError(err.error);
      else setFormError(err.error); // too many tries (429), server problem, no connection
    } finally {
      setBusy(false);
    }
  }

  if (sentTo) {
    return (
      <section className="eh-auth">
        <div className="eh-card eh-card--center">
          <div className="eh-tick" aria-hidden="true">✉</div>
          <h1 className="eh-card__title">Check your email</h1>
          <p>
            If an account exists for <strong>{sentTo}</strong>, we sent a 6-digit code. It works for 10 minutes.
          </p>
          <Link className="eh-btn eh-btn--primary eh-btn--block" to={`/reset-password?email=${encodeURIComponent(sentTo)}`}>
            Enter the code
          </Link>
          <p className="eh-card__foot">
            Nothing arrived? Check spam, wait a minute, then{' '}
            <button type="button" className="eh-link-btn" onClick={() => setSentTo('')}>
              try again
            </button>
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="eh-auth">
      <form className="eh-card" onSubmit={submit} noValidate>
        <h1 className="eh-card__title">Forgot your password?</h1>
        <p className="eh-card__lead">Enter your email and we'll send you a 6-digit code to reset it.</p>

        {formError && (
          <div className="eh-alert" role="alert">
            {formError}
          </div>
        )}

        <Field label="Email" error={emailError}>
          {(a) => (
            <input
              {...a}
              className="eh-input"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setEmailError('');
              }}
            />
          )}
        </Field>

        <button className="eh-btn eh-btn--primary eh-btn--block" type="submit" disabled={busy}>
          {busy ? 'Sending…' : 'Send code'}
        </button>

        <p className="eh-card__foot">
          Remembered it? <Link to="/login">Log in</Link>
        </p>
      </form>
    </section>
  );
}
