// Each role's home page. Same paths the server returns in login's "dashboard" field.
const dashboards = {
  ATTENDEE: '/dashboard/attendee',
  ORGANIZER: '/dashboard/organizer',
  ADMIN: '/dashboard/admin',
};

export function dashboardFor(role) {
  return dashboards[role] || '/dashboard/attendee';
}
