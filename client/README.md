# EventHive Client

React (Vite) + React Router front end.

## Setup
1. `cd client`
2. `npm install`
3. `cp .env.example .env` (points the app at the API, default `http://localhost:4000`)
4. Start the server first (see `server/README.md`), then `npm run dev`
5. Open http://localhost:5173

## Where things are
| File | What it does |
| --- | --- |
| `src/App.jsx` | Every route and which page it shows |
| `src/components/Navbar.jsx` | Top bar: logo, links by role, user's name, Logout |
| `src/api.js` | `api.get/post/patch/delete` for calling the server |
| `src/auth/AuthContext.jsx` | Logged-in user and token: `useAuth()`, `login()`, `logout()` |
| `src/auth/ProtectedRoute.jsx` | Sends logged-out users to /login, wrong role sees 403 |
| `src/pages/...` | One file per screen; each owner fills in their own |

## Calling the API
```jsx
import { api } from '../../api';

try {
  const data = await api.post('/api/auth/login', { email, password });
} catch (err) {
  // err.error = message, err.field = which input it belongs to (or null)
  setErrors({ [err.field || 'form']: err.error });
}
```
- The login token is added automatically.
- A 401 while logged in (expired or ended session) clears the login and goes to /login.

## Logging in (Laiba)
```jsx
const { login } = useAuth();
const data = await api.post('/api/auth/login', { email, password });
login(data.token, data.user);
navigate(data.dashboard);
```
Anywhere else: `const { user, isLoggedIn, logout } = useAuth();`

## Protecting a page
```jsx
<ProtectedRoute roles={['ORGANIZER']}>
  <CreateEvent />
</ProtectedRoute>
```
Leave out `roles` to allow any logged-in user.

## Pages and owners
| Route | Page | Owner |
| --- | --- | --- |
| `/login`, `/register`, `/verify-otp` | Login, Sign up, Enter code | Laiba |
| `/dashboard/attendee`, `/dashboard/organizer`, `/dashboard/admin` | Role dashboards | Laiba |
| `/forgot-password`, `/reset-password`, `/settings/password` | Passwords | Zain |
| `/events/new`, `/events/mine`, `/events/:id`, `/events/:id/edit` | Events | Ushna |
| `/calendar`, `*` (404) | Calendar, Not found | Hamza |

## Deploying (Vercel)
- Root directory: `client`
- Environment variable: `VITE_API_URL` = the live API URL
- `vercel.json` sends every path to `index.html`, so refreshing on `/calendar` doesn't give a 404.
