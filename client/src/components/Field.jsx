// One labelled form field with a hint and an error under it (W-02: "Errors show under the
// field, field border thicker"). The error is linked with aria-describedby for screen readers.
import { useId } from 'react';

export default function Field({ label, hint, error, children, optional = false }) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint && hintId, error && errorId].filter(Boolean).join(' ') || undefined;

  // children is a function so the input gets the right id and aria attributes
  return (
    <div className={`eh-field${error ? ' eh-field--error' : ''}`}>
      <label htmlFor={id} className="eh-field__label">
        {label}
        {optional && <span className="eh-field__optional"> (optional)</span>}
      </label>
      {children({ id, 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined })}
      {hint && !error && (
        <p id={hintId} className="eh-field__hint">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="eh-field__error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
