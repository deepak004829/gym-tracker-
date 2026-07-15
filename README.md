# Gym Log — redesign notes

## What changed
- **Navigation**: trimmed to two bottom tabs (Home / Progress) with a center
  FAB that opens the check-in sheet directly — logging today is one tap to
  open, one tap to save. Settings (account, theme, goal, export, reminder)
  moved out of the tab bar into a sheet opened from the gear icon in the
  header, so it no longer costs a nav slot.
- **Home**: replaced the giant photo hero with a streak ring (weekly pace),
  three one-tap status chips, a 7-day strip, a single "today's plan" card,
  and recent activity. No dashboard clutter.
- **Progress**: what used to be separate History and Insights tabs is now one
  page — the contribution-style calendar heatmap sits above the streak/goal
  stats and monthly chart, since they're the same underlying data.
- **Workout logging**: a bottom sheet with big status pills and focus chips
  instead of a `<select>` + checkbox form. Confetti + a toast fire on streak
  milestones (7/14/30/50/100/150/200/365 days).
- **Exercise builder**: card-based, with drag-to-reorder (pointer events, so
  it works with touch or mouse), swipe-out delete, one-tap duplicate, a
  done-toggle, and a "last time" line pulled from your own plan history.
- **Visual system**: new ink/ember/recovery-blue palette (`styles.css` top of
  file), tabular-mono numbers for anything you'd read as a stat, spring-eased
  motion throughout, AMOLED-friendly dark mode.
- **Architecture**: `app.js` (28KB, one file) is now ~15 focused files under
  `src/` — `state/`, `firebase/`, `pages/`, `ui/`, `utils/` — each with one
  job. They're loaded as plain `<script defer>` tags (not ES modules) that
  each attach their piece to a shared `window.GL` namespace, in dependency
  order. That's deliberate: ES module imports are blocked by CORS when a
  page is opened directly from a folder (`file://…/index.html`), so modules
  would work when hosted on a server or GitHub Pages but silently fail to
  load — and therefore never wire up a single button — when just
  double-clicked. Plain scripts have no such restriction, so **the app now
  works identically opened straight from the folder, from a local server, or
  deployed to GitHub Pages.**

## What did *not* change
- **Firebase**: same project, same `firebase-config.js`, same
  `firestore.rules` (copied over unmodified — no rule changes needed).
  Email/password auth + guest preview, offline persistence, and the
  dailyLogs/notes/workouts subcollection model are all unchanged, including
  the legacy single-document migration path for older accounts.
- Guest ("Skip for now") is a full local preview now — every screen works,
  nothing is blocked; it just never writes to Firestore.

## Before deploying
- Re-run `firebase deploy --only firestore:rules` only if you want to (the
  rules file is identical, so this is optional).
- The service worker cache list (`service-worker.js`) now points at the new
  `src/**` and `assets/**` paths — bump `CACHE_NAME` again on your next
  deploy so returning users pick up future changes.
- Chart.js and the Firebase SDKs still load from CDN via `<script defer>` in
  `index.html`, same as before — they need network on first load, same
  tradeoff the original app had.

## Known follow-ups worth doing next
- The exercise "previous performance" lookup only searches plans you've
  saved through this app (no separate exercise-history collection) — fine
  for now, but a dedicated `exerciseHistory` collection would make it faster
  as data grows.
- Daily reminder toggle requests browser Notification permission but there's
  no actual scheduled notification wired up yet (there wasn't one before
  either) — needs a service-worker push subscription if you want real
  push reminders.
