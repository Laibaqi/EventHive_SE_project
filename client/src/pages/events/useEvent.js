// Ushna: loads one event for the details and edit pages.
// Returns { loading, event, error, notFound }.
import { useEffect, useState } from 'react';
import { api } from '../../api';

export function useEvent(id) {
  // The last reply, tagged with the id it answers, so switching events never shows stale data.
  const [result, setResult] = useState({ id: null, event: null, error: '', status: 0 });

  useEffect(() => {
    let ignore = false;
    api
      .get(`/api/events/${id}`)
      .then((data) => {
        if (!ignore) setResult({ id, event: data.event, error: '', status: 200 });
      })
      .catch((err) => {
        if (!ignore) setResult({ id, event: null, error: err.error, status: err.status });
      });
    return () => {
      ignore = true;
    };
  }, [id]);

  const loading = result.id !== id;
  return {
    loading,
    event: loading ? null : result.event,
    error: loading ? '' : result.error,
    notFound: !loading && result.status === 404,
  };
}
