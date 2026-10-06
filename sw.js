/* Offline cache for the app shell. Contact data lives in IndexedDB, never in this cache.
 * Keep CACHE in step with APP_VERSION in js/app.js (tests check this). */
var CACHE = 'crm-shell-v1.1.0';
var ASSETS = ['./', './index.html', './css/app.css', './js/config.js', './js/app.js', './js/extract.js', './js/gsync.js', './vendor/papaparse.min.js', './manifest.webmanifest', './icons/icon.svg', './icons/maskable.svg'];
// Google sign-in (GIS) and Google APIs are NETWORK-ONLY: never cached, never served from cache.
var NETWORK_ONLY = /^https:\/\/(accounts\.google\.com|[a-z0-9.-]*\.googleapis\.com|oauth2\.googleapis\.com|[a-z0-9.-]*\.gstatic\.com)\//i;
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(ASSETS); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf('crm-shell-') === 0 && k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var req = e.request;
  // Not handled here = straight to the network with no caching: Google sign-in/API calls, any other
  // cross-origin request, and anything that is not a GET.
  if (NETWORK_ONLY.test(req.url)) return;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    // network first for the page so updates arrive; fall back to cache offline
    e.respondWith(fetch(req).then(function (res) {
      var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put('./index.html', copy); }); return res;
    }).catch(function () { return caches.match('./index.html').then(function (r) { return r || caches.match('./'); }); }));
    return;
  }
  // stale-while-revalidate for static assets
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(function (cached) {
    var net = fetch(req).then(function (res) {
      if (res && res.ok) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); }
      return res;
    }).catch(function () { return cached; });
    return cached || net;
  }));
});
