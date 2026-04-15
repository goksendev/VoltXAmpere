// ──────── PWA — Sprint 38b: Cache Kill Switch ────────
// Eski cache-first SW v7.1'i kullanıcılarda kilitliyordu.
// Bu sürüm: yeni self-destruct sw.js'i register eder; eski SW kendini söker.
// İlave güvence: mevcut tüm SW'leri unregister + tüm cache'leri sil.
if ('serviceWorker' in navigator) {
  // Önce: zorla temizle
  navigator.serviceWorker.getRegistrations().then(function(regs) {
    regs.forEach(function(r) { r.unregister().catch(function(){}); });
  }).catch(function(){});
  if (window.caches && caches.keys) {
    caches.keys().then(function(keys) {
      keys.forEach(function(k) { caches.delete(k).catch(function(){}); });
    }).catch(function(){});
  }
  // Sonra: self-destruct sw.js'i register et — etkin olunca eski cache'leri siler
  navigator.serviceWorker.register('sw.js').catch(function(){});
}
