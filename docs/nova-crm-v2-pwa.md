# Nova CRM V2 - Mobile Web App

Nova CRM V2 makes the existing private `/crm` dashboard installable as a
standalone mobile web app. It does not add offline CRM access.

## Identity

- App name: `Nova CRM`
- Start URL: `/crm`
- Scope: `/crm`
- Display: `standalone`
- Theme: Nova red and dark CRM styling

The CRM manifest is linked only from `CrmLayout.astro`, so the public website
does not advertise itself as the CRM app.

## Private data and caching

The CRM service worker is network-only. It does not use Cache Storage,
IndexedDB, localStorage, background sync, or an offline fallback.

Requests for CRM pages and `/api/crm-*` always go to the network. Existing CRM
HTML and API responses keep their private `no-store` headers. Static app icons
may be cached because they contain no customer or session data.

## Install

### iPhone

1. Open `https://thenovadetailing.ca/crm` in Safari.
2. Tap Share.
3. Tap Add to Home Screen.
4. Confirm the name is `Nova CRM`.

### Android

1. Open `https://thenovadetailing.ca/crm` in Chrome.
2. Open the browser menu.
3. Tap Install app or Add to Home screen.
4. Confirm the name is `Nova CRM`.

Launching the installed app opens `/crm`. The existing server-side
authentication redirects logged-out users to `/crm/login`.
