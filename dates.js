// ============================================================
// dates.js — small date helpers. Dates are stored as "YYYY-MM-DD"
// strings in local time, so there are no timezone surprises.
// ============================================================

export const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const DAY_LONG = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
export const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const pad = (n) => String(n).padStart(2, "0");

export function ymd(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function parse(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
export function today() { return ymd(new Date()); }

export function addDays(d, n) {
  const x = new Date(d); x.setDate(x.getDate() + n); return x;
}
// Monday-based weekday index: Mon = 0 … Sun = 6
export function weekday(d) { return (d.getDay() + 6) % 7; }

export function mondayOf(d) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return addDays(x, -weekday(x));
}

// ISO week number — the same number Tamigo shows as the pay period, e.g. [42]
export function isoWeek(d) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t - yearStart) / 864e5 + 1) / 7);
}

export function short(d) { return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`; }
export function dayLabel(s) { const d = parse(s); return `${DAY_SHORT[weekday(d)]} ${short(d)}`; }
export function longLabel(d) { return `${DAY_LONG[weekday(d)]} ${d.getDate()} ${MONTHS[d.getMonth()]}`; }

export function minutes(hm) {
  if (!hm) return null;
  const [h, m] = hm.split(":").map(Number);
  return h * 60 + m;
}
