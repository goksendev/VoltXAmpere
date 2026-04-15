// ──────── SPRINT 42: Model Browser UI ────────
// Modal: search + category filter across all VXA.Models.* libraries.
// Global API: vxaModelBrowserFilter({q, category}) returns filtered list —
// UI-independent so tests can validate filtering directly.

(function() {
  var CATEGORIES = [
    { key: 'npn',   label: 'BJT NPN'     },
    { key: 'pnp',   label: 'BJT PNP'     },
    { key: 'nmos',  label: 'NMOS'        },
    { key: 'pmos',  label: 'PMOS'        },
    { key: 'diode', label: 'Diode'       },
    { key: 'led',   label: 'LED'         },
    { key: 'zener', label: 'Zener'       },
    { key: 'opamp', label: 'Op-Amp'      },
    { key: 'vreg',  label: 'Regulator'   }
  ];

  function allModels() {
    var out = [];
    if (typeof VXA === 'undefined' || !VXA.Models) return out;
    CATEGORIES.forEach(function(c) {
      var list = VXA.Models.listModels(c.key) || [];
      list.forEach(function(m) {
        out.push({ name: m.name, desc: m.desc || '', category: c.key, categoryLabel: c.label });
      });
    });
    return out;
  }

  // Pure filter — used by tests AND by the modal render loop.
  function filterModels(opts) {
    opts = opts || {};
    var q = (opts.q || '').trim().toLowerCase();
    var cat = opts.category || null;
    var list = allModels();
    if (cat) list = list.filter(function(m) { return m.category === cat; });
    if (q) {
      list = list.filter(function(m) {
        return m.name.toLowerCase().indexOf(q) >= 0 ||
               m.desc.toLowerCase().indexOf(q) >= 0;
      });
    }
    return list;
  }

  function ensureModal() {
    var modal = document.getElementById('model-browser-modal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'model-browser-modal';
    modal.className = 'modal';
    modal.style.cssText = 'display:none;position:fixed;inset:0;z-index:10050;background:rgba(0,0,0,0.55);align-items:center;justify-content:center';
    modal.innerHTML =
      '<div style="background:var(--surface,#1b1b1b);color:var(--text,#eee);border:1px solid var(--border,#333);border-radius:8px;width:min(720px,92vw);max-height:82vh;display:flex;flex-direction:column;overflow:hidden">' +
      '  <div style="padding:12px 16px;border-bottom:1px solid var(--border,#333);display:flex;align-items:center;gap:8px">' +
      '    <span style="flex:1;font:600 14px var(--font-ui)">📦 Model Kütüphanesi</span>' +
      '    <button onclick="vxaModelBrowserClose()" style="background:transparent;color:var(--text);border:none;font:18px var(--font-ui);cursor:pointer">✕</button>' +
      '  </div>' +
      '  <div style="padding:10px 16px;display:flex;gap:8px;align-items:center;border-bottom:1px solid var(--border,#333)">' +
      '    <input id="mb-search" placeholder="Ara..." oninput="vxaModelBrowserRender()" ' +
      '           style="flex:1;background:var(--surface-3,#222);border:1px solid var(--border,#333);color:var(--text);padding:6px 8px;border-radius:4px;font:12px var(--font-mono)">' +
      '    <select id="mb-cat" onchange="vxaModelBrowserRender()" style="background:var(--surface-3,#222);border:1px solid var(--border,#333);color:var(--text);padding:6px;border-radius:4px;font:12px var(--font-mono)">' +
      '      <option value="">Tümü</option>' +
      CATEGORIES.map(function(c) { return '<option value="' + c.key + '">' + c.label + '</option>'; }).join('') +
      '    </select>' +
      '  </div>' +
      '  <div id="mb-list" style="flex:1;overflow:auto;padding:8px 12px;font:12px var(--font-mono)"></div>' +
      '  <div style="padding:10px 16px;border-top:1px solid var(--border,#333);display:flex;gap:8px">' +
      '    <button onclick="vxaModelBrowserPickFile()" style="background:var(--accent,#00e09e);color:#000;border:none;padding:6px 12px;border-radius:4px;cursor:pointer;font:600 12px var(--font-ui)">📂 .LIB Yükle</button>' +
      '    <button onclick="vxaModelBrowserPaste()" style="background:var(--surface-3,#222);color:var(--text);border:1px solid var(--border,#333);padding:6px 12px;border-radius:4px;cursor:pointer;font:12px var(--font-ui)">📋 SPICE Yapıştır</button>' +
      '    <span style="flex:1"></span>' +
      '    <span id="mb-count" style="color:var(--text-3,#999);font:11px var(--font-mono);align-self:center"></span>' +
      '  </div>' +
      '</div>';
    document.body.appendChild(modal);
    return modal;
  }

  function renderList() {
    var modal = document.getElementById('model-browser-modal'); if (!modal) return;
    var q = document.getElementById('mb-search').value || '';
    var cat = document.getElementById('mb-cat').value || null;
    var rows = filterModels({ q: q, category: cat });
    var listEl = document.getElementById('mb-list');
    if (!rows.length) {
      listEl.innerHTML = '<div style="padding:20px;color:var(--text-3,#999);text-align:center">Eşleşme yok</div>';
    } else {
      listEl.innerHTML = rows.map(function(m) {
        return '<div class="mb-row" data-name="' + m.name + '" data-cat="' + m.category + '" style="display:flex;gap:8px;padding:6px 4px;border-bottom:1px solid var(--border,#2a2a2a)">' +
               '<span style="color:var(--accent,#00e09e);width:110px">' + m.name + '</span>' +
               '<span style="flex:1;color:var(--text-2,#ccc)">' + m.desc + '</span>' +
               '<span style="color:var(--text-3,#999);width:80px">' + m.categoryLabel + '</span>' +
               '<button onclick="vxaModelBrowserPick(\'' + m.name + '\',\'' + m.category + '\')" style="background:var(--surface-3,#222);color:var(--text);border:1px solid var(--border,#333);padding:3px 8px;border-radius:3px;cursor:pointer;font:11px var(--font-ui)">Seç</button>' +
               '</div>';
      }).join('');
    }
    var cnt = document.getElementById('mb-count');
    if (cnt) cnt.textContent = rows.length + ' / ' + allModels().length;
  }

  // ── Public API (global window.* handlers so onclick attributes work) ──
  window.openModelBrowser = function(prefillCategory) {
    var modal = ensureModal();
    modal.style.display = 'flex';
    if (prefillCategory) {
      var sel = document.getElementById('mb-cat'); if (sel) sel.value = prefillCategory;
    }
    var q = document.getElementById('mb-search'); if (q) q.value = '';
    renderList();
  };
  window.vxaModelBrowserClose = function() {
    var modal = document.getElementById('model-browser-modal');
    if (modal) modal.style.display = 'none';
  };
  window.vxaModelBrowserRender = renderList;
  window.vxaModelBrowserFilter = filterModels;
  window.vxaModelBrowserAll = allModels;

  window.vxaModelBrowserPick = function(name, category) {
    // Assign to selected part if compatible
    if (typeof S === 'undefined' || !Array.isArray(S.parts) || !S.sel || !S.sel.length) {
      window.vxaModelBrowserClose();
      return;
    }
    var p = S.parts.find(function(pp) { return pp.id === S.sel[0]; });
    if (!p) { window.vxaModelBrowserClose(); return; }
    // Compatibility: allow if category matches part.type (npn→npn, nmos→nmos, etc.)
    var typeCompat = (p.type === category) ||
                     (p.type === 'led' && category === 'led') ||
                     (p.type === 'schottky' && category === 'diode');
    if (!typeCompat) {
      if (typeof showInfoCard === 'function') {
        showInfoCard('Model tipi uyumsuz: ' + p.type + ' ≠ ' + category, '', '');
      }
      return;
    }
    p.model = name;
    if (typeof applyModel === 'function') applyModel(p, name);
    if (typeof needsRender !== 'undefined') needsRender = true;
    if (typeof updateInspector === 'function') updateInspector();
    window.vxaModelBrowserClose();
  };

  window.vxaModelBrowserPickFile = function() {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = '.lib,.mod,.txt,.spice,.cir,.sub';
    input.onchange = function(e) {
      var file = e.target.files && e.target.files[0]; if (!file) return;
      if (VXA.LibImport) VXA.LibImport.readAndImport(file, function() { renderList(); });
    };
    input.click();
  };

  window.vxaModelBrowserPaste = function() {
    var text = prompt('.MODEL veya .SUBCKT içeriğini yapıştırın:', '');
    if (!text) return;
    if (VXA.LibImport) {
      var res = VXA.LibImport.parseLibFile(text, 'pasted');
      VXA.LibImport.importToLibrary(res);
      if (typeof showInfoCard === 'function') {
        showInfoCard('Yapıştırılan içerik: ' + res.models.length + ' model + ' + res.subcircuits.length + ' subckt', '', '');
      }
      renderList();
    }
  };
})();
