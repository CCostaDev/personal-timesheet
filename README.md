# Personal Timesheet

My own record of planned and worked shifts, mileage claims and days off, so I can check Tamigo against it.

Plain HTML, CSS and JavaScript with no build step and no dependencies. Data is stored **only on the phone** (browser `localStorage`).

## Put it online (GitHub Pages)

1. Create a new repo, e.g. `personal-timesheet`, and upload everything in this folder (keep the `css/` and `js/` folders).
2. Repo → **Settings → Pages** → Source: *Deploy from a branch* → `main` / `root` → Save.
3. After a minute it's live at `https://<yourgithub>.github.io/personal-timesheet/`.
4. On iPhone: open it in **Safari** → Share → **Add to Home Screen**.

> Always open it from the Home Screen icon. The Home Screen app has its own storage, separate from normal Safari tabs. iOS can also clear storage for websites that aren't added to the Home Screen.

## Before updating the app

Settings → **Download full backup** → Save to Files. Updating the code never touches the saved data, but a backup means nothing can be lost. To bring data back: Settings → **Restore from backup…**

## Run it locally

ES modules don't load from `file://`, so serve the folder:

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

## Files

| File | What's in it |
|---|---|
| `index.html` | Page shell, the shift editor sheet, bottom tabs |
| `css/style.css` | All styling. Colours are tokens at the top (light + dark) |
| `js/app.js` | Pages (`renderHome`, `renderWeek`, `renderAvailability`, `renderSettings`), the editor, button actions, router |
| `js/calc.js` | Hours, km, € totals, and the "Needs a look" rules |
| `js/payperiods.js` | The agency's pay calendar (ISO week blocks → payday). Add 2027 dates here when they're published |
| `js/dates.js` | Date helpers (ISO week = Tamigo pay period number) |
| `js/storage.js` | Load/save, default settings, backup & restore, data migrations |
| `manifest.webmanifest`, `icon*` | Home Screen name and icon |

## Data shape

```js
{
  version: 1,
  settings: { name, signOff, hourlyRate, kmRate, breakMin, outKm, backKm, presets: [{ id, label, start, end }] },
  shifts: {
    "2026-10-20": {
      date, start: "08:00", end: "17:00", breakMin: 60,
      status: "planned" | "worked" | "cancelled",
      outKm: 43.1, backKm: 43.4,
      tamigoHours: false, tamigoKm: false, note: ""
    }
  },
  unavailable: { "2026-10-23": { date, reason } },
  lastBackup: "ISO date"
}
```

## Adding things later

- **New button:** give it `data-act="myAction"` (plus `data-date` if it needs a day) and add `myAction: (date) => { ... }` to `ACTIONS` in `app.js`. Change `data`, then call `commit("Message")` to save and redraw.
- **New page:** add `<section data-view="x" id="view-x" hidden>` and a tab link `href="#x" data-tab="x"` in `index.html`, write `renderX()` in `app.js`, and register it in `VIEWS`.
- **New field on a shift:** add it in `newShift()` and the editor form. If old shifts need a default, bump `DATA_VERSION` in `storage.js` and fill it in inside `migrate()`.
- **New "Needs a look" rule:** add a check in `attention()` in `calc.js`, then a matching `case` in `renderHome()`.
