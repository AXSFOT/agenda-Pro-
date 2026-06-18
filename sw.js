/* ══════════════════════════════════════════════
   AGENDA ESCOLAR — Service Worker
   Maneja: caché offline + notificaciones push reales
══════════════════════════════════════════════ */

const CACHE = 'agenda-escolar-v1';
const ASSETS = ['/', '/index.html', '/manifest.json'];

/* ── INSTALL ── */
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS).catch(() => {}))
  );
  self.skipWaiting();
});

/* ── ACTIVATE ── */
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

/* ── FETCH (cache-first para assets, network-first para API) ── */
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  if (e.request.url.includes('supabase.co')) return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res && res.status === 200 && res.type === 'basic') {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      });
    }).catch(() => caches.match('/index.html'))
  );
});

/* ══════════════════════════════════════════════
   PUSH — Llega cuando el servidor manda una notif
   (funciona con el celu bloqueado)
══════════════════════════════════════════════ */
self.addEventListener('push', e => {
  let data = {
    title: '📅 Agenda Escolar',
    body: 'Tenés un evento próximo',
    icon: '/icon-192.png',
    badge: '/icon-72.png',
    tag: 'agenda-push',
    requireInteraction: true,
    data: {}
  };

  if (e.data) {
    try {
      const payload = e.data.json();
      data = { ...data, ...payload };
    } catch(_) {
      data.body = e.data.text();
    }
  }

  e.waitUntil(
    self.registration.showNotification(data.title, {
      body:              data.body,
      icon:              data.icon || '/icon-192.png',
      badge:             data.badge || '/icon-72.png',
      tag:               data.tag  || 'agenda-push',
      requireInteraction: true,
      vibrate:           [200, 100, 200],
      data:              data.data || {},
      actions: [
        { action: 'ver', title: '📋 Ver evento' },
        { action: 'ok',  title: '✅ Entendido' }
      ]
    })
  );
});

/* ══════════════════════════════════════════════
   NOTIFICATIONCLICK — Al tocar la notificación
══════════════════════════════════════════════ */
self.addEventListener('notificationclick', e => {
  e.notification.close();

  if (e.action === 'ok') return;

  // Abrir la app o enfocar si ya está abierta
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});

/* ══════════════════════════════════════════════
   SYNC — Para recordatorios programados
   (cuando el celu vuelve a tener internet)
══════════════════════════════════════════════ */
self.addEventListener('sync', e => {
  if (e.tag === 'check-recordatorios') {
    e.waitUntil(checkRecordatorios());
  }
});

async function checkRecordatorios() {
  // Esta función puede ser expandida para consultar
  // notificaciones pendientes desde Supabase
  console.log('[SW] Verificando recordatorios pendientes...');
}

/* ══════════════════════════════════════════════
   PERIODIC SYNC — Verificar recordatorios
   periódicamente (Chrome en Android)
══════════════════════════════════════════════ */
self.addEventListener('periodicsync', e => {
  if (e.tag === 'agenda-check') {
    e.waitUntil(checkRecordatorios());
  }
});