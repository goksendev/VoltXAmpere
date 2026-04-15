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
          var entry = { type: p.type, id: p.id, x: p.x, y: p.y, rot: p.rot || 0, val: p.val, freq: p.freq || 0, flipH: p.flipH, flipV: p.flipV, closed: p.closed };
          // Sprint 53: Share format v2 ile uyumlu ekstra alanlar — model kaybını önler
          if (p.model) entry.model = p.model;
          if (p.name) entry.name = p.name;
          if (p.ledColor) entry.ledColor = p.ledColor;
          if (p.wiper !== undefined && p.wiper !== 0.5) entry.wiper = p.wiper;
          if (p.label) entry.label = p.label;
          if (p.coupling) entry.coupling = p.coupling;
          if (p.L1) entry.L1 = p.L1;
          if (p.L2) entry.L2 = p.L2;
          if (p.phase) entry.phase = p.phase;
          if (p.duty) entry.duty = p.duty;
          if (p.dcOffset) entry.dcOffset = p.dcOffset;
          if (p.impedance && p.impedance !== 8) entry.impedance = p.impedance;
          if (p.srcType) entry.srcType = p.srcType;
          if (p.amplitude) entry.amplitude = p.amplitude;
          if (Array.isArray(p.pwlPoints) && p.pwlPoints.length) entry.pwlPoints = p.pwlPoints;
          if (p.expParams) entry.expParams = p.expParams;
          if (p.sffmParams) entry.sffmParams = p.sffmParams;
          if (typeof p.icVoltage === 'number' && p.icVoltage !== 0) entry.icVoltage = p.icVoltage;
          if (p.subcktName) entry.subcktName = p.subcktName;
          if (p.subcktParams) entry.subcktParams = p.subcktParams;
          if (p.beta) entry.beta = p.beta;
          if (p.pins && Array.isArray(p.pins)) entry.pins = p.pins;
          return entry;
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
  // Sprint 53: Model'leri restore edilen parts'a uygula.
  // Eski save'lerde (Sprint 52 öncesi) p.model yoksa default atanır.
  function applyModelsToParts(parts) {
    if (!Array.isArray(parts)) return 0;
    var n = 0;
    parts.forEach(function(p) {
      if (!p || !p.type) return;
      if (p.model) {
        if (typeof applyModel === 'function') {
          try { applyModel(p, p.model); n++; } catch (e) {}
        }
      } else if (typeof VXA !== 'undefined' && VXA.Models && VXA.Models.getDefault) {
        var def = VXA.Models.getDefault(p.type);
        if (def) {
          p.model = def;
          if (typeof applyModel === 'function') {
            try { applyModel(p, def); n++; } catch (e) {}
          }
        }
      }
    });
    return n;
  }
  function clear() { localStorage.removeItem('vxa_autosave'); }
  return { start: start, save: save, restore: restore, applyModelsToParts: applyModelsToParts, clear: clear };
})();