// 403: the user is logged in but their role can't open this page.
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { dashboardFor } from '../auth/dashboards';

export default function Forbidden() {
  const { user } = useAuth();

  return (
    <section className="message-page">
      <h1>No access</h1>
      <p className="muted">You don't have access to this page.</p>
      <Link to={dashboardFor(user && user.role)} className="button">
        Go to my dashboard
      </Link>
    </section>
  );
}
