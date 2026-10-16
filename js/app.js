// ============================================================
// app.js — pages, buttons and the shift editor.
//
// How it works:
//   1. `data` is loaded once from storage.js.
//   2. Any change edits `data`, then calls commit() → saves + redraws.
//   3. Each page has a render function: renderHome, renderWeek, ...
//   4. The URL hash (#home, #week, ...) decides which page shows.
// To add a page: add a <section data-view="x"> in index.html,
// a tab link, and a renderX() registered in VIEWS below.
// ============================================================
import * as store from "./storage.js";
import * as D from "./dates.js";
import * as C from "./calc.js";
import * as P from "./payperiods.js";

let data = store.load();
let weekStart = D.mondayOf(new Date());

const $ = (id) => document.getElementById(id);
const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function commit(message) {
  if (!store.save(data)) {
    toast("Couldn't save — phone storage may be full");
    return;
  }
  render();
  if (message) toast(message);
}

function toast(text) {
  const el = $("toast");
  el.textContent = text; el.hidden = false;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => (el.hidden = true), 2400);
}

function presetLabel(s) {
  const p = data.settings.presets.find((p) => p.start === s.start && p.end === s.end);
  return p ? p.label : (s.start ? "Custom" : "No times");
}
function timesText(s) { return s.start ? `${s.start}–${s.end || "?"}` : "Times not set"; }

function newShift(date) {
  const st = data.settings;
  return {
    date,
    start: "", end: "",
    breakMin: st.breakMin,
    status: date < D.today() ? "worked" : "planned",
    outKm: st.outKm, backKm: st.backKm,
    tamigoHours: false, tamigoKm: false,
    note: "",
  };
}

// ============================================================
// Home
// ============================================================
function greeting() {
  const h = new Date().getHours();
  const hello = h < 12 ? "Good Morning" : h < 19 ? "Good Afternoon" : "Good Evening";
  return `${hello}, ${esc(data.settings.name || "Cristiano")}`;
}

function renderHome() {
  const now = new Date();
  const t = D.today();
  const s = data.shifts[t];
  const off = data.unavailable[t];

  // --- Today card
  let todayHtml;
  if (s && s.status !== "cancelled") {
    const done = s.status === "worked";
    todayHtml = `
      <div class="label">${done ? "Worked today" : "On today"} · ${esc(presetLabel(s))}</div>
      <div class="big">${esc(timesText(s))}</div>
      <div class="sub num">${C.hours(s).toFixed(1)} h · ${C.km(s).toFixed(1)} km · ${C.euro(C.km(s) * data.settings.kmRate)} mileage</div>
      <div class="row">
        ${done ? "" : `<button class="primary small" data-act="worked" data-date="${t}">Mark as worked</button>`}
        <button class="small" data-act="edit" data-date="${t}">Edit</button>
      </div>`;
  } else if (off) {
    todayHtml = `<div class="label">Today</div><div class="big">Unavailable</div>${off.reason ? `<div class="sub">${esc(off.reason)}</div>` : ""}`;
  } else {
    todayHtml = `
      <div class="label">Today</div>
      <div class="big">Day off</div>
      <div class="row"><button class="small" data-act="edit" data-date="${t}">Add a shift for today</button></div>`;
  }

  // --- Needs a look
  const items = C.attention(data);
  const rows = items.map((it) => {
    const s = it.shift, day = D.dayLabel(s.date);
    switch (it.type) {
      case "confirm": return row(`Did you work ${day}?`, `${presetLabel(s)} · ${timesText(s)}`,
        `<button class="primary small" data-act="worked" data-date="${s.date}">Worked</button>
         <button class="small" data-act="cancel" data-date="${s.date}">Didn't</button>`);
      case "times": return row(`Add your times · ${day}`, "Hours can't be counted without them",
        `<button class="small" data-act="edit" data-date="${s.date}">Edit</button>`);
      case "hours": return row(`Hours accepted in Tamigo? · ${day}`, `${C.hours(s).toFixed(2)} h · ${timesText(s)}`,
        `<button class="small" data-act="tickH" data-date="${s.date}">Accepted</button>`);
      case "km": return row(`Km claim in Tamigo? · ${day}`, `${C.km(s).toFixed(1)} km · ${C.euro(C.km(s) * data.settings.kmRate)}`,
        `<button class="small" data-act="tickK" data-date="${s.date}">Added</button>`);
      case "nokm": return row(`No km entered · ${day}`, "Add your mileage for this day",
        `<button class="small" data-act="edit" data-date="${s.date}">Edit</button>`);
    }
  });
  if (backupDue()) rows.unshift(row("Time for a backup", backupAgeText(),
    `<button class="small" data-act="backup">Back up</button>`));

  // --- Coming up
  const up = C.upcoming(data, 14);
  const offSoon = Object.values(data.unavailable)
    .filter((u) => u.date > t && u.date <= D.ymd(D.addDays(now, 14)));
  const coming = [
    ...up.map((s) => ({ date: s.date, html: row(D.dayLabel(s.date), `${presetLabel(s)} · ${timesText(s)}`, `<button class="small" data-act="edit" data-date="${s.date}">Edit</button>`) })),
    ...offSoon.map((u) => ({ date: u.date, html: row(D.dayLabel(u.date), `<span class="chip warn">Unavailable</span> ${esc(u.reason || "")}`, "") })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  $("view-home").innerHTML = `
    <header>
      <h1>${greeting()}</h1>
      <div class="sub">${D.longLabel(now)} · week ${D.isoWeek(now)}</div>
    </header>
    <div class="card today">${todayHtml}</div>
    ${payCard(t)}

    <div class="label">Needs a look${rows.length ? ` · ${rows.length}` : ""}</div>
    <div class="list">${rows.join("") || `<div class="empty">You're all caught up. Everything you worked is checked off in Tamigo.</div>`}</div>

    <div class="label">Next two weeks</div>
    <div class="list">${coming.map((c) => c.html).join("") || `<div class="empty">No shifts planned yet. Add them in the Week tab.</div>`}</div>
  `;
}

// "This pay period" card: earnings for the agency's current pay block.
function payCard(t) {
  const st = data.settings;
  const p = P.periodFor(t);
  const year = C.earnings(C.shiftsBetween(data, `${t.slice(0, 4)}-01-01`, t), st);
  const ytd = `<div class="pay-foot"><span>${t.slice(0, 4)} so far</span><span class="num">${C.euro(year.total)}</span></div>`;

  if (!p) {
    return `<div class="card"><div class="label">Pay period</div>
      <div class="sub">No pay date known for week ${D.isoWeek(D.parse(t))}. Add it in js/payperiods.js.</div>${ytd}</div>`;
  }

  const e = C.earnings(C.shiftsBetween(data, p.start, p.end), st);
  const days = P.daysUntil(p.payday, t);
  const when = days === 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`;
  const pct = e.total ? Math.round((e.accepted / e.total) * 100) : 0;
  const weeks = p.from === p.to ? `week ${p.from}` : `weeks ${p.from}–${p.to}`;

  return `
    <div class="card pay">
      <div class="pay-head">
        <div><div class="label">Pay period · ${weeks}</div>
          <div class="sub">${D.short(D.parse(p.start))} – ${D.short(D.parse(p.end))}</div></div>
        <div class="payday"><span class="label">Payday</span><b>${D.dayLabel(p.payday)}</b><span class="sub">${when}</span></div>
      </div>
      <div class="pay-total num">${C.euro(e.total)}</div>
      <div class="pay-rows">
        <div><span class="sub">Gross pay</span><span class="num">${e.hours.toFixed(2)} h · ${C.euro(e.pay)}</span></div>
        <div><span class="sub">Mileage</span><span class="num">${e.km.toFixed(1)} km · ${C.euro(e.mileage)}</span></div>
      </div>
      <div class="meter" role="img" aria-label="${pct}% accepted in Tamigo"><span style="width:${pct}%"></span></div>
      <div class="sub">${C.euro(e.accepted)} of ${C.euro(e.total)} accepted in Tamigo${e.projected ? ` · ${C.euro(e.projected)} more planned` : ""}</div>
      ${ytd}
    </div>`;
}

function row(title, sub, actions) {
  return `<div class="item"><div class="main"><b>${esc(title)}</b><span class="sub">${sub}</span></div><div class="actions">${actions}</div></div>`;
}

// ============================================================
// Week
// ============================================================
function renderWeek() {
  const end = D.addDays(weekStart, 6);
  const from = D.ymd(weekStart), to = D.ymd(end);
  const tot = C.totals(C.shiftsBetween(data, from, to), data.settings);
  const t = D.today();

  let days = "";
  for (let i = 0; i < 7; i++) {
    const date = D.ymd(D.addDays(weekStart, i));
    const s = data.shifts[date];
    const off = data.unavailable[date];
    const left = `<div><div class="dname">${D.DAY_SHORT[i]}</div><div class="ddate num">${D.short(D.addDays(weekStart, i))}</div></div>`;
    const cls = `day${s && s.status !== "cancelled" ? "" : " off"}${date === t ? " is-today" : ""}`;

    if (!s) {
      const mid = off ? `<div class="chips"><span class="chip warn">Unavailable</span></div>${off.reason ? `<div class="note">${esc(off.reason)}</div>` : ""}` : "Off";
      days += `<button class="${cls}" data-act="edit" data-date="${date}">${left}<div class="dmain">${mid}</div><div class="add">+ Add</div></button>`;
      continue;
    }

    const chips = [];
    if (s.status === "planned") chips.push(`<span class="chip plain">Planned · ${esc(presetLabel(s))}</span>`);
    if (s.status === "cancelled") chips.push(`<span class="chip">Didn't work</span>`);
    if (s.status === "worked") {
      if (!s.start || !s.end) chips.push(`<span class="chip warn">Times missing</span>`);
      chips.push(`<span class="chip ${s.tamigoHours ? "ok" : ""}" data-act="toggleH" data-date="${date}">${s.tamigoHours ? "✓ " : ""}Hours in Tamigo</span>`);
      if (C.km(s) > 0) chips.push(`<span class="chip ${s.tamigoKm ? "ok" : ""}" data-act="toggleK" data-date="${date}">${s.tamigoKm ? "✓ " : ""}Km in Tamigo</span>`);
    }
    const counts = s.status === "worked";
    days += `
      <button class="${cls}" data-act="edit" data-date="${date}">
        ${left}
        <div class="dmain">
          ${s.start ? `<span class="times">${esc(timesText(s))}</span>` : ""}
          <div class="chips">${chips.join("")}</div>
          ${s.note ? `<div class="note">${esc(s.note)}</div>` : ""}
        </div>
        <div class="dright">
          <div class="h">${C.hours(s) ? C.hours(s).toFixed(2) + " h" : "– h"}</div>
          ${counts ? `<div>${C.km(s).toFixed(1)} km</div><div>${C.euro(C.km(s) * data.settings.kmRate)}</div>` : ""}
        </div>
      </button>`;
  }

  $("view-week").innerHTML = `
    <header>
      <h1>Week ${D.isoWeek(weekStart)}</h1>
      <div class="sub">Plan your shifts, then confirm the ones you worked.</div>
    </header>
    <div class="weekbar">
      <button class="ghost" data-act="prevWeek" aria-label="Previous week">←</button>
      <div class="lbl"><span class="sub num">${D.short(weekStart)} – ${D.short(end)}/${end.getFullYear()}</span></div>
      <button class="ghost" data-act="thisWeek">Today</button>
      <button class="ghost" data-act="nextWeek" aria-label="Next week">→</button>
    </div>
    <div class="stats">
      <div class="stat"><div class="label">Worked</div><div class="v">${tot.hours.toFixed(2)} h</div></div>
      <div class="stat"><div class="label">Km</div><div class="v">${tot.km.toFixed(1)}</div></div>
      <div class="stat"><div class="label">Mileage</div><div class="v">${C.euro(tot.mileage)}</div></div>
      <div class="stat"><div class="label">Gross pay</div><div class="v">${C.euro(tot.pay)}</div></div>
    </div>
    ${tot.plannedHours ? `<div class="note">Still planned this week: ${tot.plannedHours.toFixed(2)} h</div>` : ""}
    <div class="list">${days}</div>
    <button data-act="weekCsv">Download week ${D.isoWeek(weekStart)} as CSV</button>
  `;
}

function weekCsv() {
  const head = ["Date", "Day", "Status", "Start", "End", "Break (min)", "Hours", "To work (km)", "Back (km)", "Total km", "Mileage €", "Hours in Tamigo", "Km in Tamigo", "Note"];
  const rows = [head];
  for (let i = 0; i < 7; i++) {
    const date = D.ymd(D.addDays(weekStart, i)), s = data.shifts[date];
    if (!s) continue;
    rows.push([date, D.DAY_SHORT[i], s.status, s.start, s.end, s.breakMin, C.hours(s).toFixed(2), s.outKm, s.backKm,
      C.km(s).toFixed(1), (C.km(s) * data.settings.kmRate).toFixed(2), s.tamigoHours ? "yes" : "no", s.tamigoKm ? "yes" : "no", s.note]);
  }
  store.downloadFile({ name: `timesheet-week-${D.isoWeek(weekStart)}.csv`, text: toCsv(rows), type: "text/csv" });
}

function toCsv(rows) {
  return rows.map((r) => r.map((v) => {
    v = String(v ?? "");
    return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  }).join(",")).join("\n");
}

// ============================================================
// Days off (availability)
// ============================================================
function upcomingOff() {
  const t = D.today();
  return Object.values(data.unavailable).filter((u) => u.date >= t).sort((a, b) => a.date.localeCompare(b.date));
}

function renderAvailability() {
  const list = upcomingOff();
  $("view-availability").innerHTML = `
    <header>
      <h1>Days off</h1>
      <div class="sub">Days you can't work, ready to send to your team leader.</div>
    </header>
    <form class="card" id="offForm">
      <div class="grid2">
        <label>From<input type="date" id="uFrom" required></label>
        <label>To (optional)<input type="date" id="uTo"></label>
      </div>
      <label>Reason (optional)<input type="text" id="uReason" placeholder="Exam, appointment, holiday…"></label>
      <button class="primary" type="submit">Mark unavailable</button>
    </form>
    <div class="list">
      ${list.map((u) => row(D.dayLabel(u.date), esc(u.reason || ""), `<button class="small danger" data-act="removeOff" data-date="${u.date}">Remove</button>`)).join("")
        || `<div class="empty">No upcoming days off.</div>`}
    </div>
    <div class="row">
      <button class="grow" data-act="copyOff" ${list.length ? "" : "disabled"}>Copy message for team leader</button>
      <button data-act="csvOff" ${list.length ? "" : "disabled"}>CSV</button>
    </div>
    <textarea id="offText" rows="7" readonly hidden></textarea>
  `;
  $("offForm").onsubmit = (e) => {
    e.preventDefault();
    const from = $("uFrom").value, to = $("uTo").value || from, reason = $("uReason").value.trim();
    if (to < from) { toast("'To' is before 'From'"); return; }
    let d = D.parse(from), n = 0;
    while (D.ymd(d) <= to && n < 92) {
      const k = D.ymd(d);
      data.unavailable[k] = { date: k, reason };
      d = D.addDays(d, 1); n++;
    }
    commit(n === 1 ? "Day marked unavailable" : `${n} days marked unavailable`);
  };
}

function offMessage() {
  const lines = upcomingOff().map((u) => `- ${D.dayLabel(u.date)}/${u.date.slice(0, 4)}${u.reason ? ` (${u.reason})` : ""}`);
  return `Hi,\n\nThese are the days I'm not available to work:\n${lines.join("\n")}\n\nThanks,\n${data.settings.signOff || "Cristiano"}`;
}

async function copyOff() {
  const text = offMessage();
  try {
    await navigator.clipboard.writeText(text);
    toast("Copied — paste it into Google Chat");
  } catch {
    const ta = $("offText"); ta.value = text; ta.hidden = false; ta.focus(); ta.select();
    toast("Select the text below to copy it");
  }
}

// ============================================================
// Settings
// ============================================================
const BACKUP_DAYS = 30;
function backupAgeDays() {
  const b = data.lastBackup;
  return b ? Math.floor((Date.now() - new Date(b)) / 864e5) : null;
}
function backupDue() {
  if (!Object.keys(data.shifts).length) return false;
  const age = backupAgeDays();
  return age === null || age >= BACKUP_DAYS;
}
function backupAgeText() {
  const age = backupAgeDays();
  if (age === null) return "You haven't saved a backup yet";
  if (age === 0) return "Last backup: today";
  return `Last backup: ${age} day${age === 1 ? "" : "s"} ago`;
}

function renderSettings() {
  const st = data.settings;
  const nShifts = Object.keys(data.shifts).length;
  $("view-settings").innerHTML = `
    <header><h1>Settings</h1></header>

    <form class="card" id="setForm">
      <h2>You</h2>
      <div class="grid2">
        <label>Name on Today page<input type="text" id="sName" value="${esc(st.name)}"></label>
        <label>Sign-off in messages<input type="text" id="sSign" value="${esc(st.signOff)}"></label>
      </div>

      <h2>Pay &amp; mileage</h2>
      <div class="grid2">
        <label>Hourly rate (€)<input type="number" id="sHourly" step="0.01" min="0" value="${st.hourlyRate}"></label>
        <label>Mileage (€/km)<input type="number" id="sKmRate" step="0.01" min="0" value="${st.kmRate}"></label>
        <label>To work (km)<input type="number" id="sOut" step="0.1" min="0" value="${st.outKm}"></label>
        <label>Back home (km)<input type="number" id="sBack" step="0.1" min="0" value="${st.backKm}"></label>
        <label>Break (min)<input type="number" id="sBreak" step="5" min="0" value="${st.breakMin}"></label>
      </div>

      <h2>Shift types</h2>
      ${st.presets.map((p, i) => `
        <div class="grid3">
          <label>Name<input type="text" id="pL${i}" value="${esc(p.label)}"></label>
          <label>Start<input type="time" id="pS${i}" value="${p.start}"></label>
          <label>End<input type="time" id="pE${i}" value="${p.end}"></label>
        </div>`).join("")}

      <button class="primary" type="submit">Save settings</button>
    </form>

    <div class="card">
      <h2>Your data</h2>
      <div class="sub">Everything is stored only on this phone (${nShifts} shift${nShifts === 1 ? "" : "s"} saved). ${esc(backupAgeText())}.</div>
      <div class="note">Download a backup before updating the app or clearing Safari data. Save it to Files, then restore it here if anything goes missing.</div>
      <button class="primary" data-act="backup">Download full backup</button>
      <label class="btn" for="restoreFile" style="color:var(--ink);font-size:0.95rem">Restore from backup…</label>
      <input type="file" id="restoreFile" accept="application/json,.json" hidden>
      <div id="restoreConfirm" class="card" hidden style="border-color:var(--danger)">
        <div id="restoreText"></div>
        <div class="row">
          <button class="danger grow" data-act="restoreYes">Replace my data</button>
          <button data-act="restoreNo">Cancel</button>
        </div>
      </div>
    </div>
  `;

  $("setForm").onsubmit = (e) => {
    e.preventDefault();
    const num = (id, fallback) => { const v = parseFloat($(id).value); return Number.isFinite(v) ? v : fallback; };
    data.settings = {
      ...st,
      name: $("sName").value.trim() || "Cristiano",
      signOff: $("sSign").value.trim() || "Cristiano",
      hourlyRate: num("sHourly", st.hourlyRate),
      kmRate: num("sKmRate", st.kmRate),
      outKm: num("sOut", st.outKm),
      backKm: num("sBack", st.backKm),
      breakMin: num("sBreak", st.breakMin),
      presets: st.presets.map((p, i) => ({ ...p, label: $(`pL${i}`).value.trim() || p.label, start: $(`pS${i}`).value || p.start, end: $(`pE${i}`).value || p.end })),
    };
    commit("Settings saved");
  };

  $("restoreFile").onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      pendingRestore = store.parseBackup(await file.text());
      const n = Object.keys(pendingRestore.shifts).length;
      $("restoreText").textContent = `This backup has ${n} shift${n === 1 ? "" : "s"}. Restoring replaces everything currently on this phone.`;
      $("restoreConfirm").hidden = false;
    } catch (err) {
      toast(err.message);
    }
    e.target.value = "";
  };
}
let pendingRestore = null;

async function backup() {
  data.lastBackup = new Date().toISOString();
  store.save(data);
  await store.downloadFile(store.backupFile(data));
  render();
}

// ============================================================
// Shift editor (bottom sheet)
// ============================================================
let editingDate = null;
let deleteArmed = false;

function openEditor(date) {
  const existing = data.shifts[date];
  const s = existing || newShift(date);
  editingDate = existing ? date : null;
  deleteArmed = false;

  $("sheetTitle").textContent = `${existing ? "Edit" : "Add"} shift · ${D.dayLabel(date)}`;
  $("fDate").value = date;
  $("fStart").value = s.start || "";
  $("fEnd").value = s.end || "";
  $("fBreak").value = s.breakMin;
  $("fOut").value = s.outKm;
  $("fBack").value = s.backKm;
  $("fTH").checked = !!s.tamigoHours;
  $("fTK").checked = !!s.tamigoKm;
  $("fNote").value = s.note || "";
  setStatus(s.status);
  $("fPresets").innerHTML = data.settings.presets
    .map((p) => `<button type="button" data-start="${p.start}" data-end="${p.end}">${esc(p.label)}</button>`).join("");
  markPreset();
  $("fDelete").hidden = !existing;
  $("fDelete").textContent = "Delete";
  $("sheet").hidden = false;
}
function closeEditor() { $("sheet").hidden = true; editingDate = null; }

function setStatus(v) {
  $("fStatus").querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.dataset.v === v));
}
function getStatus() { return $("fStatus").querySelector("button.on")?.dataset.v || "planned"; }
function markPreset() {
  $("fPresets").querySelectorAll("button").forEach((b) =>
    b.classList.toggle("on", b.dataset.start === $("fStart").value && b.dataset.end === $("fEnd").value));
}

$("fPresets").onclick = (e) => {
  const b = e.target.closest("button"); if (!b) return;
  $("fStart").value = b.dataset.start; $("fEnd").value = b.dataset.end; markPreset();
};
$("fStart").oninput = $("fEnd").oninput = markPreset;
$("fStatus").onclick = (e) => { const b = e.target.closest("button"); if (b) setStatus(b.dataset.v); };
$("sheetClose").onclick = closeEditor;
$("sheet").onclick = (e) => { if (e.target === $("sheet")) closeEditor(); };

$("shiftForm").onsubmit = (e) => {
  e.preventDefault();
  const date = $("fDate").value;
  if (!date) return;
  const num = (id) => parseFloat($(id).value) || 0;
  const shift = {
    date,
    start: $("fStart").value, end: $("fEnd").value,
    breakMin: num("fBreak"),
    status: getStatus(),
    outKm: num("fOut"), backKm: num("fBack"),
    tamigoHours: $("fTH").checked, tamigoKm: $("fTK").checked,
    note: $("fNote").value.trim(),
  };
  if (editingDate && editingDate !== date) delete data.shifts[editingDate];
  data.shifts[date] = shift;
  closeEditor();
  commit("Shift saved");
};
$("fDelete").onclick = () => {
  if (!deleteArmed) { deleteArmed = true; $("fDelete").textContent = "Tap again to delete"; return; }
  delete data.shifts[editingDate];
  closeEditor();
  commit("Shift deleted");
};

// ============================================================
// One click handler for every data-act button on every page
// ============================================================
const ACTIONS = {
  edit: (d) => openEditor(d),
  worked: (d) => { data.shifts[d].status = "worked"; commit("Marked as worked"); },
  cancel: (d) => { data.shifts[d].status = "cancelled"; commit("Marked as not worked"); },
  tickH: (d) => { data.shifts[d].tamigoHours = true; commit("Hours ticked off"); },
  tickK: (d) => { data.shifts[d].tamigoKm = true; commit("Km claim ticked off"); },
  toggleH: (d) => { const s = data.shifts[d]; s.tamigoHours = !s.tamigoHours; commit(); },
  toggleK: (d) => { const s = data.shifts[d]; s.tamigoKm = !s.tamigoKm; commit(); },
  prevWeek: () => { weekStart = D.addDays(weekStart, -7); render(); },
  nextWeek: () => { weekStart = D.addDays(weekStart, 7); render(); },
  thisWeek: () => { weekStart = D.mondayOf(new Date()); render(); },
  weekCsv: () => weekCsv(),
  removeOff: (d) => { delete data.unavailable[d]; commit("Removed"); },
  copyOff: () => copyOff(),
  csvOff: () => store.downloadFile({ name: "days-off.csv", type: "text/csv",
    text: toCsv([["Date", "Day", "Reason"], ...upcomingOff().map((u) => [u.date, D.DAY_SHORT[D.weekday(D.parse(u.date))], u.reason])]) }),
  backup: () => backup(),
  restoreYes: () => { if (!pendingRestore) return; data = pendingRestore; pendingRestore = null; commit("Backup restored"); },
  restoreNo: () => { pendingRestore = null; $("restoreConfirm").hidden = true; },
};

document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-act]");
  if (!el || !ACTIONS[el.dataset.act]) return;
  e.preventDefault();
  e.stopPropagation();
  ACTIONS[el.dataset.act](el.dataset.date);
});

// ============================================================
// Router
// ============================================================
const VIEWS = { home: renderHome, week: renderWeek, availability: renderAvailability, settings: renderSettings };

function currentView() {
  const v = location.hash.slice(1);
  return VIEWS[v] ? v : "home";
}

function render() {
  const v = currentView();
  document.querySelectorAll("[data-view]").forEach((s) => (s.hidden = s.dataset.view !== v));
  document.querySelectorAll("[data-tab]").forEach((a) => a.classList.toggle("on", a.dataset.tab === v));
  VIEWS[v]();
}

window.addEventListener("hashchange", () => { render(); window.scrollTo(0, 0); });
// Re-check when you come back to the app (e.g. the next day)
document.addEventListener("visibilitychange", () => { if (!document.hidden) render(); });

render();
