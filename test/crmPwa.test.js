import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

function pngSize(buffer) {
  assert.equal(buffer.toString('ascii', 1, 4), 'PNG');

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

test('CRM manifest defines a CRM-only standalone app', async () => {
  const manifest = JSON.parse(
    await readFile(
      new URL('../public/crm/manifest.webmanifest', import.meta.url),
      'utf8',
    ),
  );

  assert.equal(manifest.id, '/crm');
  assert.equal(manifest.name, 'Nova CRM');
  assert.equal(manifest.short_name, 'Nova CRM');
  assert.equal(manifest.start_url, '/crm');
  assert.equal(manifest.scope, '/crm');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.theme_color, '#ed1c24');
  assert.ok(
    manifest.icons.some(
      (icon) => icon.sizes === '512x512' && icon.purpose === 'maskable',
    ),
  );
});

test('CRM icon files have their declared dimensions', async () => {
  const icons = [
    ['nova-crm-apple-touch-icon.png', 180],
    ['nova-crm-192.png', 192],
    ['nova-crm-512.png', 512],
    ['nova-crm-maskable-512.png', 512],
  ];

  for (const [name, size] of icons) {
    const buffer = await readFile(
      new URL(`../public/assets/crm/${name}`, import.meta.url),
    );

    assert.deepEqual(pngSize(buffer), { width: size, height: size });
  }
});

test('CRM layout provides install and iPhone metadata only to CRM pages', async () => {
  const [crmLayout, baseLayout] = await Promise.all([
    readFile(
      new URL('../src/layouts/CrmLayout.astro', import.meta.url),
      'utf8',
    ),
    readFile(
      new URL('../src/layouts/BaseLayout.astro', import.meta.url),
      'utf8',
    ),
  ]);

  assert.match(crmLayout, /viewport-fit=cover/);
  assert.match(crmLayout, /rel="manifest"\s+href="\/crm\/manifest\.webmanifest"/);
  assert.match(crmLayout, /apple-mobile-web-app-capable/);
  assert.match(crmLayout, /apple-mobile-web-app-title/);
  assert.match(crmLayout, /nova-crm-apple-touch-icon\.png/);
  assert.match(crmLayout, /\/js\/crm-pwa\.js/);
  assert.doesNotMatch(baseLayout, /crm\/manifest\.webmanifest|crm-pwa\.js/);
});

test('CRM service worker is network-only and stores no private data', async () => {
  const [worker, registration, middleware, crmAuth, netlifyConfig] =
    await Promise.all([
      readFile(new URL('../public/crm-sw.js', import.meta.url), 'utf8'),
      readFile(new URL('../public/js/crm-pwa.js', import.meta.url), 'utf8'),
      readFile(new URL('../src/middleware.ts', import.meta.url), 'utf8'),
      readFile(
        new URL('../src/netlify/lib/crmAuth.js', import.meta.url),
        'utf8',
      ),
      readFile(new URL('../netlify.toml', import.meta.url), 'utf8'),
    ]);

  assert.match(worker, /addEventListener\('fetch'/);
  assert.match(worker, /\/api\/crm-/);
  assert.match(worker, /respondWith\(fetch\(event\.request\)\)/);
  assert.doesNotMatch(
    `${worker}\n${registration}`,
    /\bcaches\b|indexedDB|localStorage|sessionStorage/,
  );
  assert.match(registration, /scope:\s*'\/crm'/);
  assert.match(registration, /updateViaCache:\s*'none'/);
  assert.match(middleware, /no-store/);
  assert.match(crmAuth, /no-store/);
  assert.match(
    netlifyConfig,
    /for\s*=\s*"\/crm\/manifest\.webmanifest"[\s\S]+Content-Type\s*=\s*"application\/manifest\+json;\s*charset=UTF-8"/,
  );
});
