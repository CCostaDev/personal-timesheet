// ============================================================
// payperiods.js — the agency's pay calendar (Payment dates Regular).
// Each period covers whole ISO weeks (the same numbers Tamigo uses).
// When the agency publishes the 2027 dates, add them to the list.
// ============================================================
import { ymd, addDays, parse } from "./dates.js";

export const PAY_PERIODS = [
  { year: 2025, from: 51, to: 52, payday: "2026-01-07" },
  { year: 2026, from: 1,  to: 3,  payday: "2026-01-21" },
  { year: 2026, from: 4,  to: 7,  payday: "2026-02-18" },
  { year: 2026, from: 8,  to: 11, payday: "2026-03-18" },
  { year: 2026, from: 12, to: 16, payday: "2026-04-22" },
  { year: 2026, from: 17, to: 20, payday: "2026-05-20" },
  { year: 2026, from: 21, to: 24, payday: "2026-06-24" },
  { year: 2026, from: 25, to: 29, payday: "2026-07-22" },
  { year: 2026, from: 30, to: 33, payday: "2026-08-19" },
  { year: 2026, from: 34, to: 38, payday: "2026-09-23" },
  { year: 2026, from: 39, to: 42, payday: "2026-10-21" },
  { year: 2026, from: 43, to: 46, payday: "2026-11-18" },
  { year: 2026, from: 47, to: 50, payday: "2026-12-23" },
  // Week 51 of 2026 isn't on the agency's list — ask them when it's paid.
  { year: 2026, from: 52, to: 53, payday: "2027-01-06" },
];

// Monday of ISO week `week` in ISO year `year`
export function mondayOfIsoWeek(year, week) {
  const jan4 = new Date(year, 0, 4);
  const monWeek1 = addDays(jan4, -((jan4.getDay() + 6) % 7));
  return addDays(monWeek1, (week - 1) * 7);
}

// Adds real start/end dates to each period
function withDates(p) {
  const start = mondayOfIsoWeek(p.year, p.from);
  const end = addDays(mondayOfIsoWeek(p.year, p.to), 6);
  return { ...p, start: ymd(start), end: ymd(end) };
}

// The period a given date ("YYYY-MM-DD") falls in, or null if unknown
export function periodFor(date) {
  for (const p of PAY_PERIODS) {
    const q = withDates(p);
    if (date >= q.start && date <= q.end) return q;
  }
  return null;
}

export function daysUntil(date, from) {
  return Math.round((parse(date) - parse(from)) / 864e5);
}
