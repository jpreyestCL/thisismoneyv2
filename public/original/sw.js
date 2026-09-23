// Service worker de This is Money: el juego funciona OFFLINE una vez visitado.
// - index.html: red primero (para recibir las actualizaciones del deploy), caché de respaldo
// - assets y CDN de three.js: caché primero (no cambian casi nunca)
const VERSION = 'tim-v51';   // bump al cambiar CORE (fuerza recachear e ignora cachés viejas)
const CORE = ['./', './index.html', './manifest.webmanifest', './icon.svg',
  './src/game-config.js', './src/chat.js?v=4', './src/park-business.js?v=1', './src/city-map.js?v=4', './assets/img_58.png', './assets/edificio.glb', './assets/tienda.glb', './assets/papa_anim.glb'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // Extensiones y servicios de terceros (por ejemplo Cloudflare Insights) gestionan
  // sus propias solicitudes. Cachearlas aquí provoca errores y ruido en consola.
  const allowedOrigin = url.origin === self.location.origin || url.origin === 'https://unpkg.com';
  if (!['http:', 'https:'].includes(url.protocol) || !allowedOrigin) return;
  if (url.origin === self.location.origin && url.pathname.startsWith('/api/')) return;   // rankings y otras API: siempre van a la red
  const needsFreshCode = e.request.mode === 'navigate' || url.pathname.endsWith('/index.html') || url.pathname === '/' || url.pathname.endsWith('.js');
  if (needsFreshCode) {   // red primero: HTML y módulos siempre coordinados
    const cacheKey = e.request.mode === 'navigate' || url.pathname.endsWith('/index.html') || url.pathname === '/' ? './index.html' : e.request;
    e.respondWith(fetch(e.request).then(r => { const cp = r.clone(); caches.open(VERSION).then(c => c.put(cacheKey, cp)).catch(() => {}); return r; })
      .catch(() => caches.match(cacheKey)));
    return;
  }
  // resto (assets, three.js del CDN): caché primero
  e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(r => {
    if (r.ok || r.type === 'opaque') { const cp = r.clone(); caches.open(VERSION).then(c => c.put(e.request, cp)).catch(() => {}); }
    return r;
  })));
});
