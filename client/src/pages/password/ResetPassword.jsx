// Zain: reset password with the emailed code (W-16, AUTH-06).
// Email + 6-digit code + new password + confirm. On success go to /login with "Password changed".
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../../api';
import Field from '../../components/Field';
import { checkNewPassword } from '../../lib/passwordRules';
import '../../styles/auth.css';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const knownEmail = params.get('email') || '';
  const [form, setForm] = useState({ email: knownEmail, code: '', newPassword: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (key) => (e) => {
    const value = key === 'code' ? e.target.value.replace(/\D/g, '').slice(0, 6) : e.target.value;
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((errs) => ({ ...errs, [key]: undefined }));
  };

  async function submit(e) {
    e.preventDefault();
    setFormError('');

    const found = {};
    if (!form.email.trim()) found.email = 'Enter your email';
    if (!/^\d{6}$/.test(form.code)) found.code = 'Enter the 6-digit code from your email';
    const ruleMessage = checkNewPassword(form.newPassword);
    if (ruleMessage) found.newPassword = ruleMessage;
    if (!found.newPassword && form.confirm !== form.newPassword) found.confirm = 'The two passwords do not match';
    setErrors(found);
    if (Object.keys(found).length) return;

    setBusy(true);
    try {
      await api.post('/api/auth/reset', {
        email: form.email.trim(),
        code: form.code,
        newPassword: form.newPassword,
      });
      navigate(`/login?changed=1&email=${encodeURIComponent(form.email.trim())}`, { replace: true });
    } catch (err) {
      if (err.field === 'code' || err.field === 'newPassword' || err.field === 'email') {
        setErrors({ [err.field]: err.error });
      } else {
        setFormError(err.error); // too many tries (429), server problem, no connection
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="eh-auth">
      <form className="eh-card" onSubmit={submit} noValidate>
        <h1 className="eh-card__title">Reset your password</h1>
        <p className="eh-card__lead">
          {knownEmail ? (
            <>
              Enter the 6-digit code we sent to <strong>{knownEmail}</strong> and choose a new password.
            </>
          ) : (
            'Enter your email, the 6-digit code we sent you, and a new password.'
          )}
        </p>

        {formError && (
          <div className="eh-alert" role="alert">
            {formError}
          </div>
        )}

        {!knownEmail && (
          <Field label="Email" error={errors.email}>
            {(a) => <input {...a} className="eh-input" type="email" autoComplete="email" value={form.email} onChange={set('email')} />}
          </Field>
        )}
        {knownEmail && errors.email && (
          <p className="eh-field__error" role="alert">
            {errors.email}
          </p>
        )}

        <Field label="6-digit code" error={errors.code}>
          {(a) => (
            <input
              {...a}
              className="eh-input eh-input--code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="••••••"
              value={form.code}
              onChange={set('code')}
            />
          )}
        </Field>

        <Field label="New password" hint="At least 8 characters, with a letter and a digit." error={errors.newPassword}>
          {(a) => (
            <input {...a} className="eh-input" type="password" autoComplete="new-password" value={form.newPassword} onChange={set('newPassword')} />
          )}
        </Field>

        <Field label="Confirm new password" error={errors.confirm}>
          {(a) => (
            <input {...a} className="eh-input" type="password" autoComplete="new-password" value={form.confirm} onChange={set('confirm')} />
          )}
        </Field>

        <button className="eh-btn eh-btn--primary eh-btn--block" type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Change password'}
        </button>

        <p className="eh-card__foot">
          No code, or it expired? <Link to="/forgot-password">Get a new one</Link>
        </p>
      </form>
    </section>
  );
}
