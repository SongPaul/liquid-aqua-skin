/* Liquid Aqua — keeps the page itself readable when the gateway is not there.
 *
 * Only the page and its own files are kept. Machine data is never cached: a
 * stale shot or a stale water level would be worse than an honest failure, and
 * the page already knows how to say it cannot reach the machine.
 */
var VER = '1.164.2';
var CACHE = 'liquid-aqua-' + VER;
var CORE = ['index.html', 'skin-manifest.json', 'inter-latin.woff2', 'inter-latin-ext.woff2'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    // One at a time: several adds at once on the same cache fall over each
    // other in Chrome. And one bad entry must not cost the whole install.
    return CORE.reduce(function (p, u) {
      return p.then(function () {
        return c.add(new Request(u, { cache: 'reload' })).catch(function () {});
      });
    }, Promise.resolve());
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.map(function (k) {
      return (k !== CACHE && k.indexOf('liquid-aqua-') === 0) ? caches.delete(k) : null;
    }));
  }).then(function () { return self.clients.claim(); }));
});

function isData(url) {
  return /\/api\/v\d+\/(?!webui\/skin-assets\/)/.test(url.pathname) || /\/ws\//.test(url.pathname);
}

function keep(req, res) {
  if (res && res.ok) {
    var c = res.clone();
    caches.open(CACHE).then(function (k) { k.put(req, c); });
  }
  return res;
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url;
  try { url = new URL(req.url); } catch (_) { return; }
  if (url.origin !== self.location.origin) return;
  if (isData(url)) return;

  if (req.mode === 'navigate' || /\.html$/.test(url.pathname)) {
    // The newest page always wins when it can be had; the copy is the fallback.
    // The query is ignored on the way back out: the page is reached with
    // ?phone=1 and friends, and any of them should find the one copy there is.
    e.respondWith(fetch(req).then(function (r) { return keep(req, r); }).catch(function () {
      return caches.match(req, { ignoreSearch: true })
        .then(function (m) { return m || caches.match('index.html', { ignoreSearch: true }); })
        .then(function (m) { return m || Response.error(); });
    }));
    return;
  }

  // A query on anything else is someone asking for the current answer — the
  // update check appends a timestamp to the manifest for exactly that reason.
  // Those are left alone, so they fail honestly instead of answering stale.
  if (url.search) return;

  e.respondWith(caches.match(req).then(function (m) {
    return m || fetch(req).then(function (r) { return keep(req, r); });
  }));
});
