const CACHE = 'agenda-v1';
const ASSETS = ['/', '/index.html', '/manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request).catch(() => caches.match('/index.html')))
  );
});

// Notificaciones push
self.addEventListener('push', e => {
  const data = e.data ? e.data.json() : { title: 'Recordatorio', body: 'Tenés un evento próximo.' };
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      vibrate: [200, 100, 200],
      data: data.url || '/',
      actions: [{ action: 'ver', title: 'Ver evento' }]
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.openWindow(e.notification.data || '/'));
});

// Alarmas locales — recibidas desde la página via postMessage
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SCHEDULE_ALARM') {
    const { id, ms, title, body } = e.data;
    setTimeout(() => {
      self.registration.showNotification(title, {
        body,
        icon: '/icon-192.png',
        vibrate: [200, 100, 200],
        tag: 'alarm-' + id
      });
    }, ms);
  }
});