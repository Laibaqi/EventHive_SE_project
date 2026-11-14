// Zain: change password while logged in (the password part of W-47, AUTH-06).
// Current password + new password + confirm. The server ends this account's other sessions
// and returns a fresh token, so this browser stays logged in.
import { useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../auth/AuthContext';
import Field from '../../components/Field';
import { checkNewPassword } from '../../lib/passwordRules';
import '../../styles/auth.css';

const EMPTY = { currentPassword: '', newPassword: '', confirm: '' };

export default function ChangePassword() {
  const { user, login } = useAuth();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const set = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setErrors((errs) => ({ ...errs, [key]: undefined }));
    setDone(false);
  };

  async function submit(e) {
    e.preventDefault();
    setFormError('');
    setDone(false);

    const found = {};
    if (!form.currentPassword) found.currentPassword = 'Enter your current password';
    const ruleMessage = checkNewPassword(form.newPassword);
    if (ruleMessage) found.newPassword = ruleMessage;
    else if (form.newPassword === form.currentPassword) found.newPassword = 'New password must be different from your current password';
    else if (form.confirm !== form.newPassword) found.confirm = 'The two passwords do not match';
    setErrors(found);
    if (Object.keys(found).length) return;

    setBusy(true);
    try {
      const res = await api.post('/api/auth/change-password', {
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });
      // Other sessions are now logged out; keep this one by saving the fresh token.
      if (res && res.token) login(res.token, user);
      setForm(EMPTY);
      setDone(true);
    } catch (err) {
      if (err.field === 'currentPassword' || err.field === 'newPassword') {
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
        <h1 className="eh-card__title">Change password</h1>
        <p className="eh-card__lead">Your other devices will be logged out when you change it.</p>

        {done && (
          <div className="eh-alert eh-alert--ok" role="status">
            Password changed. Use your new password next time you log in.
          </div>
        )}
        {formError && (
          <div className="eh-alert" role="alert">
            {formError}
          </div>
        )}

        <Field label="Current password" error={errors.currentPassword}>
          {(a) => (
            <input {...a} className="eh-input" type="password" autoComplete="current-password" value={form.currentPassword} onChange={set('currentPassword')} />
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
      </form>
    </section>
  );
}
