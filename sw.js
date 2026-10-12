// Service Worker: hält die ganze App auf dem Gerät, damit sie auch ohne Internet startet (z. B. im Flugzeug).
// Dateiliste und Version trägt der Build ein (Plugin „kniffel-precache“ in vite.config.ts).
// Online-Spiel über den Server und der Abgleich (/api, /ws) laufen nie über den Cache.
const FILES = ["assets/index-Bzkn_Upp.js","assets/index-DX1XBLId.css","icon-192.png","icon-512.png","icon.svg","index.html","manifest.webmanifest","sounds/dice-grab-1.ogg","sounds/dice-grab-2.ogg","sounds/dice-shake-1.ogg","sounds/dice-shake-2.ogg","sounds/dice-shake-3.ogg","sounds/dice-throw-1.ogg","sounds/dice-throw-2.ogg","sounds/dice-throw-3.ogg","sounds/die-throw-1.ogg","sounds/die-throw-2.ogg","sounds/die-throw-3.ogg","sounds/die-throw-4.ogg"];
const VERSION = '3f42150d985d';
const CACHE = 'kniffel-' + VERSION;

self.addEventListener('install', (e) => {
  // erst aktiv werden, wenn wirklich alles gespeichert ist
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => e.waitUntil(
  caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()),
));

/** Seite selbst: neueste Fassung aus dem Netz – aber ohne Internet (oder im Hotspot ohne Internet) nach kurzer Zeit die gespeicherte. */
async function page(req) {
  const cache = await caches.open(CACHE);
  const saved = await cache.match('index.html', { ignoreVary: true, ignoreSearch: true });
  if (!saved) return fetch(req);
  if (self.navigator && self.navigator.onLine === false) return saved;
  try {
    const res = await Promise.race([
      fetch(req),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000)),
    ]);
    return res.ok ? res : saved;
  } catch {
    return saved;
  }
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  const base = new URL(self.registration.scope).pathname;
  if (!url.pathname.startsWith(base)) return;
  const rel = url.pathname.slice(base.length);
  if (rel.startsWith('api/') || rel === 'ws') return;
  if (req.mode === 'navigate') {
    e.respondWith(page(req));
    return;
  }
  // Dateien (gebaut mit Prüfsumme im Namen): aus dem Speicher, sonst übers Netz.
  // ignoreVary: Skripte werden mit „Origin“-Kopfzeile angefragt, die gespeicherten ohne – sonst passt bei „Vary: Origin“ nichts.
  e.respondWith(caches.open(CACHE).then((c) => c.match(req, { ignoreSearch: true, ignoreVary: true })).then((hit) => hit || fetch(req)));
});
