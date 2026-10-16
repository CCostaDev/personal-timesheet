// ============================================================
// calc.js — the maths: hours, km, euros, and what needs attention.
// No DOM code here, so it's easy to test or reuse.
// ============================================================
import { minutes, today, parse, addDays, ymd } from "./dates.js";

// A shift looks like:
// { date, start, end, breakMin, status: "planned"|"worked"|"cancelled",
//   outKm, backKm, tamigoHours, tamigoKm, note }

export function hours(shift) {
  if (!shift || !shift.start || !shift.end) return 0;
  let m = minutes(shift.end) - minutes(shift.start);
  if (m < 0) m += 24 * 60; // finishes after midnight
  m -= Number(shift.breakMin) || 0;
  return Math.max(0, m) / 60;
}

export function km(shift) {
  if (!shift) return 0;
  return (Number(shift.outKm) || 0) + (Number(shift.backKm) || 0);
}

export const euro = (n) => "€" + n.toFixed(2);

// Totals for a list of shifts. Only worked shifts count as earned.
export function totals(shifts, settings) {
  let h = 0, k = 0, plannedH = 0, plannedK = 0;
  for (const s of shifts) {
    if (s.status === "worked") { h += hours(s); k += km(s); }
    else if (s.status === "planned") { plannedH += hours(s); plannedK += km(s); }
  }
  return {
    hours: h,
    km: k,
    pay: h * settings.hourlyRate,
    mileage: k * settings.kmRate,
    plannedHours: plannedH,
    plannedKm: plannedK,
  };
}

// Earnings for a range, plus how much of it Tamigo has already accepted.
export function earnings(shifts, settings) {
  const t = totals(shifts, settings);
  let acceptedPay = 0, acceptedMileage = 0;
  for (const s of shifts) {
    if (s.status !== "worked") continue;
    if (s.tamigoHours) acceptedPay += hours(s) * settings.hourlyRate;
    if (s.tamigoKm) acceptedMileage += km(s) * settings.kmRate;
  }
  return {
    ...t,
    total: t.pay + t.mileage,
    accepted: acceptedPay + acceptedMileage,
    // what the still-planned shifts would add if you work them
    projected: t.plannedHours * settings.hourlyRate + t.plannedKm * settings.kmRate,
  };
}

export function shiftsBetween(data, from, to) {
  return Object.values(data.shifts)
    .filter((s) => s.date >= from && s.date <= to)
    .sort((a, b) => a.date.localeCompare(b.date));
}

// Everything on the Today page's "Needs a look" list.
export function attention(data) {
  const t = today();
  const items = [];
  const past = Object.values(data.shifts)
    .filter((s) => s.date < t || (s.date === t && s.status === "worked"))
    .sort((a, b) => b.date.localeCompare(a.date));

  for (const s of past) {
    if (s.status === "planned") {
      items.push({ type: "confirm", shift: s });
      continue;
    }
    if (s.status !== "worked") continue;
    if (!s.start || !s.end) items.push({ type: "times", shift: s });
    if (!s.tamigoHours) items.push({ type: "hours", shift: s });
    if (km(s) === 0) items.push({ type: "nokm", shift: s });
    else if (!s.tamigoKm) items.push({ type: "km", shift: s });
  }
  return items;
}

export function upcoming(data, days = 14) {
  const from = ymd(addDays(parse(today()), 1));
  const to = ymd(addDays(parse(today()), days));
  return shiftsBetween(data, from, to).filter((s) => s.status === "planned");
}
