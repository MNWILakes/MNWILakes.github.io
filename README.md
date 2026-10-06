# Wholesale CRM (static, offline, private) – v1.1.0

Single-page CRM for Google Contacts. No backend: all contacts, priorities, follow-ups and call logs
live in this browser's IndexedDB. The site files contain no contact data.

Two ways to get contacts in:
- **Live Google Contacts sync** (v1.1.0): read-only, via Google Identity Services + People API v1, straight from the
  browser. It needs a one-time OAuth Client ID (see `GOOGLE_OAUTH_SETUP.md` / USER_GUIDE "Connect Google Contacts").
  Put it in `js/config.js` (`GOOGLE_CLIENT_ID`) or paste it in Settings. The app syncs every 4 minutes while open,
  whenever you come back to it, and when you're back online. That's as close to real time as a browser app gets,
  because Google can't push changes to a static page.
- **CSV import** (fallback): Google Contacts → Export → Google CSV.

Every contact carries a **Date Added** (YYYY-MM-DD). It's set once and never overwritten: the CSV import date
(or a created-date column), the first-seen date for Google sync, or today for contacts added in the app.

Files: `index.html`, `css/app.css`, `js/config.js`, `js/app.js`, `js/extract.js`, `js/gsync.js`,
`vendor/papaparse.min.js` (PapaParse 5, MIT), `manifest.webmanifest`, `sw.js`, `icons/`.

Host it on any static HTTPS host (the service worker and install need HTTPS). The service worker never caches
Google sign-in or googleapis.com requests.
Run locally: `python3 -m http.server 8080` in this folder, then open http://localhost:8080/.

Keyboard: `/` search, `j`/`k` move, `Enter` open, `c` log call, `Esc` close.
