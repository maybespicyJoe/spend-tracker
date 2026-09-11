const fs = require('fs');
const path = require('path');

const dir = __dirname;
const outDir = path.join(dir, 'pwa-deploy');
fs.mkdirSync(outDir, { recursive: true });

const appFull = fs.readFileSync(path.join(dir, 'app.html'), 'utf8');
const splitAt = appFull.indexOf('</style>') + '</style>'.length;
const headPart = appFull.slice(0, splitAt);   // <title> + <style>
const bodyPart = appFull.slice(splitAt);      // <div id="app-root"> + <script>

const indexHtml = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#0b0f0d">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Spend Tracker">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<link rel="manifest" href="manifest.json">
<link rel="apple-touch-icon" href="icon-192.png">
<link rel="icon" href="icon-192.png">
${headPart}
</head>
<body>
${bodyPart}
<script>
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('sw.js').catch(function () {});
  });
}
</script>
</body>
</html>
`;

const manifest = {
  name: 'Monthly Spend Tracker',
  short_name: 'Spend Tracker',
  start_url: './index.html',
  scope: './',
  display: 'standalone',
  background_color: '#0b0f0d',
  theme_color: '#0b0f0d',
  icons: [
    { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: 'icon-512.png', sizes: '512x512', type: 'image/png' }
  ]
};

const swJs = `const CACHE = 'spend-tracker-v1';
const ASSETS = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(ASSETS); }));
  self.skipWaiting();
});
self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    })
  );
  self.clients.claim();
});
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(function (cached) {
      var fetchPromise = fetch(e.request).then(function (res) {
        if (res && res.status === 200) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
        }
        return res;
      }).catch(function () { return cached; });
      return cached || fetchPromise;
    })
  );
});
`;

fs.writeFileSync(path.join(outDir, 'index.html'), indexHtml);
fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
fs.writeFileSync(path.join(outDir, 'sw.js'), swJs);
console.log('wrote index.html, manifest.json, sw.js to', outDir);
