// ──────── SPRINT 42: .LIB IMPORT (v9.0) ────────
// Parse vendor SPICE libraries: .MODEL lines, .SUBCKT blocks.
// Route BSIM3-class cards through VXA.BSIM3.parseModelParams.
// Persist custom models in localStorage ('vxa_custom_models').

VXA.LibImport = (function() {
  'use strict';

  var STORAGE_KEY = 'vxa_custom_models';

  function parseLibFile(text, fileName) {
    var result = { models: [], subcircuits: [], warnings: [], fileName: fileName || 'unknown' };

    // Delegate .SUBCKT parsing to the dedicated module.
    // NOTE: VXA.Subcircuit.parse also collects top-level .MODEL cards; we intentionally
    // ignore that list here — our own top-level loop (below) is authoritative so we
    // don't double-count. Subcircuits themselves stay.
    if (typeof VXA.Subcircuit !== 'undefined' && typeof VXA.Subcircuit.parse === 'function') {
      try {
        var scResult = VXA.Subcircuit.parse(text);
        result.subcircuits = scResult.subcircuits || [];
      } catch (e) {
        result.warnings.push('.SUBCKT parse error: ' + e.message);
      }
    }

    // Collect top-level .MODEL lines (skip lines inside .SUBCKT blocks — already handled).
    var rawLines = String(text).split('\n');
    var merged = [];
    var inSub = false;
    var acc = '';
    for (var i = 0; i < rawLines.length; i++) {
      var raw = rawLines[i].replace(/\r$/, '');
      var t = raw.trim();
      if (t === '' || t.charAt(0) === '*' || t.charAt(0) === ';') {
        if (acc) { merged.push(acc); acc = ''; }
        continue;
      }
      if (/^\.subckt/i.test(t)) { inSub = true; if (acc) { merged.push(acc); acc = ''; } continue; }
      if (/^\.ends/i.test(t))   { inSub = false; if (acc) { merged.push(acc); acc = ''; } continue; }
      if (inSub) continue;
      if (t.charAt(0) === '+') { acc += ' ' + t.substring(1).trim(); }
      else { if (acc) merged.push(acc); acc = t; }
    }
    if (acc) merged.push(acc);

    for (var j = 0; j < merged.length; j++) {
      var line = merged[j];
      var upper = line.toUpperCase();
      if (upper.indexOf('.MODEL') === 0) {
        if (typeof VXA.SpiceParser === 'undefined') continue;
        var m = VXA.SpiceParser.parseModelLine(line);
        if (m) {
          if (VXA.BSIM3 && VXA.BSIM3.isBSIM3Model(m.params)) {
            m.params = VXA.BSIM3.parseModelParams(m.params);
            m.isBSIM3 = true;
          }
          result.models.push(m);
        }
      } else if (upper.indexOf('.LIB') === 0) {
        result.warnings.push('Nested .LIB references not supported: ' + line);
      }
    }

    return result;
  }

  function importToLibrary(parseResult, opts) {
    var imported = { models: 0, subcircuits: 0 };
    if (!parseResult) return imported;
    var persist = !opts || opts.persist !== false;
    (parseResult.models || []).forEach(function(m) {
      var category = m.category;
      // Refine category by type for MOSFET/PNP cases
      if (m.type === 'PNP') category = 'pnp';
      else if (m.type === 'PMOS' || m.type === 'PFET') category = 'pmos';
      else if (m.type === 'NMOS' || m.type === 'NFET') category = 'nmos';
      if (typeof VXA.Models !== 'undefined' && VXA.Models.addCustomModel) {
        VXA.Models.addCustomModel(category, m.name, m.params);
      }
      imported.models++;
    });
    imported.subcircuits = (parseResult.subcircuits || []).length;
    if (persist) saveToStorage(parseResult);
    return imported;
  }

  function saveToStorage(parseResult) {
    try {
      if (typeof localStorage === 'undefined') return;
      var existing = [];
      try { existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch (e) { existing = []; }
      (parseResult.models || []).forEach(function(m) {
        var idx = existing.findIndex(function(e) { return e.name === m.name; });
        var entry = { name: m.name, type: m.type, category: m.category, params: m.params };
        if (idx >= 0) existing[idx] = entry;
        else existing.push(entry);
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
    } catch (e) {
      console.warn('[LibImport] storage error:', e.message);
    }
  }

  function loadFromStorage() {
    try {
      if (typeof localStorage === 'undefined') return 0;
      var stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      stored.forEach(function(m) {
        var category = m.category || 'diode';
        if (m.type === 'PNP') category = 'pnp';
        else if (m.type === 'PMOS' || m.type === 'PFET') category = 'pmos';
        if (VXA.Models && VXA.Models.addCustomModel) VXA.Models.addCustomModel(category, m.name, m.params);
      });
      return stored.length;
    } catch (e) { return 0; }
  }

  function clearStorage() {
    try { if (typeof localStorage !== 'undefined') localStorage.removeItem(STORAGE_KEY); } catch (e) {}
  }

  function readAndImport(file, onDone) {
    if (!file || typeof FileReader === 'undefined') return;
    var reader = new FileReader();
    reader.onload = function(e) {
      var text = e.target.result;
      var result = parseLibFile(text, file.name);
      var imported = importToLibrary(result);
      if (typeof onDone === 'function') onDone(result, imported);
      if (typeof showInfoCard === 'function') {
        var msg = file.name + ': ' + imported.models + ' model';
        if (imported.subcircuits > 0) msg += ' + ' + imported.subcircuits + ' subcircuit';
        msg += ' yüklendi.';
        showInfoCard(msg, '', '');
      }
    };
    reader.readAsText(file);
  }

  function setupFileDrop(dropZone) {
    if (!dropZone || dropZone._vxaLibDropBound) return;
    dropZone._vxaLibDropBound = true;
    dropZone.addEventListener('dragover', function(e) {
      e.preventDefault(); e.stopPropagation();
      dropZone.classList.add('drag-over');
    });
    dropZone.addEventListener('dragleave', function() {
      dropZone.classList.remove('drag-over');
    });
    dropZone.addEventListener('drop', function(e) {
      e.preventDefault(); e.stopPropagation();
      dropZone.classList.remove('drag-over');
      if (!e.dataTransfer || !e.dataTransfer.files) return;
      for (var i = 0; i < e.dataTransfer.files.length; i++) readAndImport(e.dataTransfer.files[i]);
    });
  }

  return {
    parseLibFile: parseLibFile,
    importToLibrary: importToLibrary,
    saveToStorage: saveToStorage,
    loadFromStorage: loadFromStorage,
    clearStorage: clearStorage,
    readAndImport: readAndImport,
    setupFileDrop: setupFileDrop,
    STORAGE_KEY: STORAGE_KEY
  };
})();
