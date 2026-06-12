const CRM_SCOPE_PATH = '/crm';
const CRM_API_PATH = '/api/crm-';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  const isCrmPage =
    url.pathname === CRM_SCOPE_PATH ||
    url.pathname.startsWith(`${CRM_SCOPE_PATH}/`);
  const isCrmApi = url.pathname.startsWith(CRM_API_PATH);

  if (isCrmPage || isCrmApi) {
    event.respondWith(fetch(event.request));
  }
});
