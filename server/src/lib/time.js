// DB stores UTC; show users Pakistan time (Asia/Karachi, UTC+5).
const TZ = 'Asia/Karachi';

function toPKT(date, options = {}) {
  return new Intl.DateTimeFormat('en-PK', {
    timeZone: TZ,
    dateStyle: 'medium',
    timeStyle: 'short',
    ...options,
  }).format(new Date(date));
}

// ISO string with +05:00 offset, handy for API responses
function toPKTISO(date) {
  const d = new Date(new Date(date).getTime() + 5 * 60 * 60 * 1000);
  return d.toISOString().replace('Z', '+05:00');
}

module.exports = { TZ, toPKT, toPKTISO };
