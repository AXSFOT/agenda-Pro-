const CACHE = 'agenda-v2';
const ASSETS = ['/', '/index.html', '/manifest.json'];

// Alarmas programadas: { id: timeoutId }
const alarmas = {};

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

// ── Recibir mensajes desde la página ──
self.addEventListener('message', e => {
  if (!e.data) return;

  if (e.data.type === 'SCHEDULE_ALARM') {
    const { id, ms, title, body } = e.data;

    // Cancelar alarma previa del mismo evento
    if (alarmas[id]) clearTimeout(alarmas[id]);

    if (ms <= 0) return;

    alarmas[id] = setTimeout(() => {
      self.registration.showNotification(title, {
        body,
        icon: '/icon-192.png',
        badge: '/icon-96.png',
        vibrate: [300, 100, 300, 100, 300],
        requireInteraction: true,   // No desaparece sola en Android
        tag: 'ev-' + id,
        data: { id }
      });
      delete alarmas[id];
    }, ms);
  }

  if (e.data.type === 'CANCEL_ALARM') {
    const { id } = e.data;
    if (alarmas[id]) { clearTimeout(alarmas[id]); delete alarmas[id]; }
  }

  // La página manda todos los eventos al SW para reprogramar al recargar
  if (e.data.type === 'SYNC_ALARMS') {
    const { eventos } = e.data;
    // Cancelar todas las existentes
    Object.keys(alarmas).forEach(id => clearTimeout(alarmas[id]));
    // Reprogramar
    eventos.forEach(ev => {
      if (!ev.recordatorio || !ev.hora) return;
      const evDate = new Date(ev.fecha + 'T' + ev.hora + ':00');
      const notifDate = new Date(evDate.getTime() - ev.recordatorio * 60 * 1000);
      const ms = notifDate.getTime() - Date.now();
      if (ms <= 0) return;
      alarmas[ev.id] = setTimeout(() => {
        self.registration.showNotification('⏰ ' + ev.titulo, {
          body: '📅 ' + ev.fecha + '  🕐 ' + ev.hora + (ev.lugar ? '\n📍 ' + ev.lugar : ''),
          icon: '/icon-192.png',
          badge: '/icon-96.png',
          vibrate: [300, 100, 300, 100, 300],
          requireInteraction: true,
          tag: 'ev-' + ev.id,
          data: { id: ev.id }
        });
        delete alarmas[ev.id];
      }, ms);
    });
  }
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
      if (cs.length > 0) { cs[0].focus(); }
      else { clients.openWindow('/'); }
    })
  );
});