// Top bar: logo, links for the user's role, the user's name and Logout.
// Below 640px the links fold into a menu button so nothing is cut off on phones.

import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { dashboardFor } from '../auth/dashboards';

const guestLinks = [
  { to: '/calendar', label: 'Calendar' },
  { to: '/login', label: 'Log in' },
  { to: '/register', label: 'Sign up' },
];

const roleLinks = {
  ATTENDEE: [
    { to: '/dashboard/attendee', label: 'Dashboard' },
    { to: '/calendar', label: 'Calendar' },
  ],
  ORGANIZER: [
    { to: '/dashboard/organizer', label: 'Dashboard' },
    { to: '/events/new', label: 'Create event' },
    { to: '/events/mine', label: 'My events' },
    { to: '/calendar', label: 'Calendar' },
  ],
  ADMIN: [
    { to: '/dashboard/admin', label: 'Dashboard' },
    { to: '/calendar', label: 'Calendar' },
  ],
};

export default function Navbar() {
  const { user, isLoggedIn, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const links = isLoggedIn ? roleLinks[user.role] || [] : guestLinks;
  const homePath = isLoggedIn ? dashboardFor(user.role) : '/calendar';

  function closeMenu() {
    setMenuOpen(false);
  }

  async function handleLogout() {
    closeMenu();
    await logout();
    navigate('/login');
  }

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <Link to={homePath} className="logo" onClick={closeMenu}>
          <img src="/favicon.svg" alt="" width="28" height="28" />
          <span>EventHive</span>
        </Link>

        <button
          type="button"
          className="menu-button"
          aria-label="Open menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(!menuOpen)}
        >
          {menuOpen ? '✕' : '☰'}
        </button>

        <nav className={menuOpen ? 'nav-links open' : 'nav-links'}>
          {links.map((link) => (
            <NavLink key={link.to} to={link.to} onClick={closeMenu}>
              {link.label}
            </NavLink>
          ))}

          {isLoggedIn && (
            <div className="user-area">
              <NavLink to="/settings/password" onClick={closeMenu} title="Change password">
                {user.name}
              </NavLink>
              <button type="button" className="logout-button" onClick={handleLogout}>
                Logout
              </button>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
