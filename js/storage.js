// ============================================================
// storage.js — everything about saving and loading data.
//
// All data lives in this phone's browser (localStorage) under one key.
// Nothing is sent anywhere. To move to a cloud database later, only
// this file needs to change: keep the same function names.
// ============================================================

const KEY = "personal-timesheet:v1";

// Bump this when the data shape changes, and add a step in migrate().
export const DATA_VERSION = 1;

export const DEFAULT_SETTINGS = {
  name: "Cristiano",            // your name, for the signature
  signOff: "Cristiano",
  hourlyRate: 19.5,       // € per hour (gross, all-in)
  kmRate: 0.23,           // € per km
  breakMin: 60,           // unpaid break per shift
  outKm: 43.1,            // parking → Google GRQ
  backKm: 43.4,           // Google GRQ → parking
  presets: [
    { id: "early", label: "Early", start: "07:00", end: "16:00" },
    { id: "day",   label: "Day",   start: "08:00", end: "17:00" },
    { id: "late",  label: "Late",  start: "14:30", end: "23:30" },
  ],
};

function emptyData() {
  return {
    version: DATA_VERSION,
    settings: structuredClone(DEFAULT_SETTINGS),
    shifts: {},      // keyed by date "YYYY-MM-DD"
    unavailable: {}, // keyed by date "YYYY-MM-DD" → { date, reason }
  };
}

// Upgrade older saved data to the current shape.
function migrate(data) {
  const d = { ...emptyData(), ...data };
  d.settings = { ...DEFAULT_SETTINGS, ...(data.settings || {}) };
  d.shifts = data.shifts || {};
  d.unavailable = data.unavailable || {};
  // if (d.version < 2) { ...change shape... ; d.version = 2 }
  d.version = DATA_VERSION;
  return d;
}

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? migrate(JSON.parse(raw)) : emptyData();
  } catch (e) {
    console.error("Could not read saved data", e);
    return emptyData();
  }
}

export function save(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    console.error("Could not save", e);
    return false;
  }
}

// ---------- Backup & restore ----------

export function backupFile(data) {
  const stamp = new Date().toISOString().slice(0, 10);
  const json = JSON.stringify({ app: "personal-timesheet", exportedAt: new Date().toISOString(), ...data }, null, 2);
  return { name: `timesheet-backup-${stamp}.json`, text: json, type: "application/json" };
}

// Returns the restored data, or throws an Error with a readable message.
export function parseBackup(text) {
  let obj;
  try { obj = JSON.parse(text); } catch { throw new Error("That file isn't a valid backup (not JSON)."); }
  if (obj.app !== "personal-timesheet" || typeof obj.shifts !== "object") {
    throw new Error("That file doesn't look like a Personal Timesheet backup.");
  }
  delete obj.app; delete obj.exportedAt;
  return migrate(obj);
}

// Saves a file to the phone. On iPhone this opens the share sheet,
// where "Save to Files" keeps it in iCloud Drive / On My iPhone.
// Elsewhere it falls back to a normal download.
export async function downloadFile({ name, text, type }) {
  const blob = new Blob([text], { type: type || "text/plain" });
  try {
    const file = new File([blob], name, { type: blob.type });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: name });
      return;
    }
  } catch (e) {
    if (e.name === "AbortError") return; // user closed the share sheet
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
