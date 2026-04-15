// Sprint 38b: SELF-DESTRUCT Service Worker
// Eski SW kullanıcılarda yüklüydü ve cache-first stratejisi v7.1'i zorla servis ediyordu.
// Bu yeni SW: tüm cache'leri siler, kendini unregister eder, fetch'lere dokunmaz.
// Birkaç ziyaret sonrası tüm cihazlar temiz olur.

self.addEventListener('install', function(e) {
  self.skipWaiting();
});

self.addEventListener('activate', function(e) {
  e.waitUntil((async function() {
    // Tüm cache'leri sil
    try {
      var keys = await caches.keys();
      await Promise.all(keys.map(function(k) { return caches.delete(k); }));
    } catch (err) {}
    // Kendini unregister et
    try {
      await self.registration.unregister();
    } catch (err) {}
    // Tüm açık client'ları reload et — taze indeks alsınlar
    try {
      var clients = await self.clients.matchAll({ type: 'window' });
      clients.forEach(function(c) { c.navigate(c.url); });
    } catch (err) {}
  })());
});

// Fetch'e dokunma — network'ten gelsin
