# FamilyCal

A mobile-first, offline-capable **family calendar** for the Schumacher family
(Christian · Janina · Feli), deployed as a static SPA to GitHub Pages.

Live: https://Yolocb.github.io/Planer/ (after first deploy)

## Stack

- **SvelteKit** (Svelte 5, runes) + **Vite**, static SPA via `@sveltejs/adapter-static`
- **FullCalendar v6** (day-grid / time-grid / list / interaction) — week, month, day & agenda views
- **Tailwind CSS v4** with the family colour tokens
- **IndexedDB** (`idb`) for events & chores + `localStorage` for settings — no backend, all data on-device
- **PWA** via `@vite-pwa/sveltekit` (installable, offline)
- **iCal** import/export (`ical.js` / `ics`)
- **Vitest** (unit/integration) + **Playwright** (e2e)

## Colour system

| Person           | Colour            |
| ---------------- | ----------------- |
| Christian        | `#4A90D9` (blue)  |
| Janina           | `#E87C6B` (coral) |
| Feli             | `#6BBF6E` (green) |
| Familie / shared | `#F5A623` (amber) |

## Development

```bash
npm install
npm run dev        # dev server at /Planer/
npm run check      # svelte-check (types)
npm run lint       # prettier --check + eslint
npm run format     # prettier --write
npm run build      # static build → build/
npm run test       # vitest
npm run icons      # regenerate PWA icons
```

## Deployment

Pushing to `main` runs `.github/workflows/deploy.yml`, which builds with
`BASE_PATH=/Planer` and publishes `build/` to GitHub Pages. Set the repo's
**Settings → Pages → Source** to **GitHub Actions**.

## Status

- **Sprint 1** — project setup, types, IndexedDB store, settings, app shell, PWA, CI ✅
- **Sprint 2** — calendar core (all views, colouring, navigation) ✅
- Sprint 3 — event CRUD, recurrence, drag-and-drop ✅
- **UX pass** — prominent bottom Save bar, shared button styles; removed the
  per-person filter (everyone sees all entries) — fixes new events "vanishing"
  when a stale `activeFilters` was persisted ✅
- Sprint 4 — Feli's child view & chores _(next)_
- Sprint 5 — import/export & settings page
- Sprint 6 — polish, performance, PWA finalisation

## Backlog

- **Native mobile calendar integration (iOS & Android)** — let family members
  add FamilyCal events to their phone's built-in calendar (Apple Calendar /
  Google Calendar). Since the app is backend-less, this is delivered as `.ics`
  export: a per-event "Add to calendar" download and a bulk "Export all" file,
  which iOS and Android both open natively into their calendar apps. (A live,
  auto-refreshing `webcal://` subscription feed would need a server and is out
  of scope for the static-site architecture.) Planned for a later sprint,
  building on the Sprint 5 iCal export work.
- **@-mention person tagging in the event form** — while typing a title/notes,
  entering `@` opens an autocomplete of family members; picking one assigns that
  person to the event (adds them to `personIds`) and the event colour updates to
  match. Later-sprint enhancement to the Sprint 3 event form.
