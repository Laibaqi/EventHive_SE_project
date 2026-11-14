// Yellow banner on every dashboard until the email is verified (W-03 panel D, AUTH-05).
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';

export default function VerifyBanner({ user, action = 'create events' }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  if (!user || user.emailVerified) return null;

  async function resend() {
    setBusy(true);
    setNote('');
    try {
      const res = await api.post('/api/auth/resend-otp', { email: user.email });
      setNote(res.message);
    } catch (err) {
      setNote(err.error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="eh-banner" role="status">
      <span className="eh-banner__icon" aria-hidden="true">!</span>
      <div className="eh-banner__text">
        <strong>Verify your email to {action}.</strong> We sent a 6-digit code to {user.email}.
        {note && <div className="eh-banner__note">{note}</div>}
      </div>
      <div className="eh-banner__actions">
        <Link className="eh-btn eh-btn--small" to={`/verify-otp?email=${encodeURIComponent(user.email)}`}>
          Enter code
        </Link>
        <button type="button" className="eh-btn eh-btn--small eh-btn--ghost" onClick={resend} disabled={busy}>
          {busy ? 'Sending…' : 'Resend code'}
        </button>
      </div>
    </div>
  );
}
