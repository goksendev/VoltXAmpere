// ──────── AUTOSAVE ────────
VXA.AutoSave = (function() {
  var timer = null;
  function start() {
    if (timer) clearInterval(timer);
    timer = setInterval(save, VXA.Config.AUTOSAVE_INTERVAL);
  }
  function save() {
    if (!S.autoSave) return;
    if (S.parts.length === 0 && S.wires.length === 0) return;
    try {
      var data = {
        parts: S.parts.map(function(p) {
          return { type: p.type, id: p.id, x: p.x, y: p.y, rot: p.rot || 0, val: p.val, freq: p.freq || 0, flipH: p.flipH, flipV: p.flipV, closed: p.closed };
        }),
        wires: S.wires.map(function(w) {
          return { x1: w.x1, y1: w.y1, x2: w.x2, y2: w.y2 };
        }),
        netNames: S.netNames,
        timestamp: Date.now(),
        version: VXA.Config.VERSION,
        settings: { bgStyle: S.bgStyle, wireStyle: S.wireStyle, symbolStd: S.symbolStd, currentDirection: S.currentDirection }
      };
      var json = JSON.stringify(data);
      if (json.length > 4000000) { console.warn('Circuit data approaching localStorage limit: ' + (json.length/1024).toFixed(0) + 'KB'); }
      localStorage.setItem('vxa_autosave', json);
    } catch(e) {
      if (e.name === 'QuotaExceededError' || e.code === 22) {
        console.warn('localStorage quota exceeded — autosave skipped');
        if (typeof announce === 'function') announce(t('storageFull') || 'Storage full. Please export your circuit.');
      }
    }
  }
  function restore() {
    try {
      var raw = localStorage.getItem('vxa_autosave');
      if (!raw) return false;
      var data = JSON.parse(raw);
      if (Date.now() - data.timestamp > 86400000) return false; // >24h old
      return data;
    } catch(e) { return false; }
  }
  function clear() { localStorage.removeItem('vxa_autosave'); }
  return { start: start, save: save, restore: restore, clear: clear };
})();