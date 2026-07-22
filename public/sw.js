// ============================================================
// CLASH OF COINS — Service Worker
// Cache pour utilisation offline + installation PWA
// ============================================================

const CACHE = 'clash-coins-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/auth.html',
  '/dashboard.html',
  '/Bg.png',
  '/js/auth.js',
  '/js/game.js',
  '/js/sounds.js',
  'https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@700;900&family=Rajdhani:wght@500;600;700&family=Anton&display=swap',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js',
];

// Install — cache les assets
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => {
      return cache.addAll(ASSETS.map(url => new Request(url, {cache: 'reload'})))
        .catch(err => console.warn('Cache partial fail:', err));
    })
  );
  self.skipWaiting();
});

// Activate — nettoie les vieux caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch — Network first, cache fallback
self.addEventListener('fetch', e => {
  // Skip non-GET et API calls
  if(e.request.method !== 'GET') return;
  if(e.request.url.includes('/api/') || 
     e.request.url.includes('socket.io') ||
     e.request.url.includes('supabase.co')) return;

  e.respondWith(
    fetch(e.request)
      .then(res => {
        // Cache la réponse fraîche
        if(res.ok){
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});

// Push notifications
self.addEventListener('push', e => {
  const data = e.data?.json() || {};
  self.registration.showNotification(data.title || 'Clash of Coins', {
    body: data.body || "C'est ton tour !",
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [200, 100, 200],
    tag: 'clash-coins',
    data: { url: data.url || '/dashboard.html' },
    actions: [
      { action: 'play', title: '🎲 Jouer', icon: '/icon-192.png' },
      { action: 'close', title: '✕ Fermer' }
    ]
  });
});

// Clic sur notification
self.addEventListener('notificationclick', e => {
  e.notification.close();
  if(e.action === 'close') return;
  e.waitUntil(
    clients.openWindow(e.notification.data?.url || '/dashboard.html')
  );
});