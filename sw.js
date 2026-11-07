// MathNavi Service Worker：讓 App 可安裝、載入更快；不攔截 /api 與 /__/auth
const CACHE = 'mathnavi-v2';
// 網站可能放在子路徑（例如 GitHub Pages 的 /mathnavi），從自己的位置推出前綴
const BASE = new URL('./', self.location).pathname.replace(/\/$/, '');

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // 清掉舊版（含 Vite 時代 workbox）留下的所有快取
      for (const key of await caches.keys()) {
        if (key !== CACHE) await caches.delete(key);
      }
      await self.clients.claim();
    })()
  );
});

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok || res.type === 'opaque') cache.put(request, res.clone());
  return res;
}

async function networkFirst(request, fallbackKey) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(request);
    if (res.ok) cache.put(fallbackKey || request, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(fallbackKey || request);
    if (hit) return hit;
    throw err;
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (url.origin === self.location.origin) {
    if (url.pathname.startsWith(BASE + '/api/') || url.pathname.startsWith(BASE + '/__/')) return;
    // 檔名帶雜湊、內容不會變的靜態檔：快取優先
    if (url.pathname.startsWith(BASE + '/_next/static/')) {
      event.respondWith(cacheFirst(request));
      return;
    }
    // 整個 App 只有一個頁面：離線時用快取的首頁
    if (request.mode === 'navigate') {
      event.respondWith(networkFirst(request, BASE + '/'));
      return;
    }
    event.respondWith(cacheFirst(request));
    return;
  }

  if (/^https:\/\/fonts\.(googleapis|gstatic)\.com\//.test(request.url)) {
    event.respondWith(cacheFirst(request));
  }
});
