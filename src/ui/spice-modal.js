// ──────── SPRINT 19: SPICE IMPORT MODAL + UX ────────

// ===== SPICE IMPORT MODAL =====
function showSpiceImportModal() {
  // Remove existing modal if open
  var old = document.getElementById('spice-import-modal');
  if (old) old.remove();

  var lang = (typeof currentLang !== 'undefined' ? currentLang : 'en');
  var tr = lang === 'tr';

  var modal = document.createElement('div');
  modal.id = 'spice-import-modal';
  modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:10000;display:flex;align-items:center;justify-content:center';

  var content = document.createElement('div');
  content.style.cssText = 'background:var(--bg,#1a1a2e);border:1px solid #333;border-radius:12px;width:700px;max-width:90vw;max-height:85vh;padding:24px;display:flex;flex-direction:column;gap:16px;box-shadow:0 20px 60px rgba(0,0,0,0.5);color:var(--text,#ddd);font:13px var(--font-ui,sans-serif)';

  var examples = _generateSpiceExamples(tr);

  content.innerHTML =
    '<div style="display:flex;justify-content:space-between;align-items:center">'
    + '<h2 style="margin:0;color:#fff;font-size:18px">⚡ ' + (tr ? 'SPICE Netlist Import' : 'SPICE Netlist Import') + '</h2>'
    + '<button id="spice-modal-close" style="background:none;border:none;color:#888;font-size:24px;cursor:pointer">&times;</button>'
    + '</div>'

    + '<div style="display:flex;gap:8px">'
    + '<button id="spice-tab-paste" class="spice-tab-btn active" style="padding:8px 16px;border-radius:6px;border:1px solid #444;background:#2a2a4a;color:#fff;cursor:pointer;font-size:13px">'
    + '\uD83D\uDCCB ' + (tr ? 'Yapıştır' : 'Paste') + '</button>'
    + '<button id="spice-tab-file" class="spice-tab-btn" style="padding:8px 16px;border-radius:6px;border:1px solid #333;background:transparent;color:#aaa;cursor:pointer;font-size:13px">'
    + '\uD83D\uDCC2 ' + (tr ? 'Dosyadan Aç' : 'From File') + '</button>'
    + '<button id="spice-tab-examples" class="spice-tab-btn" style="padding:8px 16px;border-radius:6px;border:1px solid #333;background:transparent;color:#aaa;cursor:pointer;font-size:13px">'
    + '\uD83D\uDCDA ' + (tr ? 'Örnekler' : 'Examples') + '</button>'
    + '</div>'

    // PASTE TAB
    + '<div id="spice-paste-tab">'
    + '<textarea id="spice-input" placeholder="' + (tr ? '* SPICE netlist buraya yapıştırın...\n* Örnek:\nV1 VCC 0 DC 12\nR1 VCC OUT 1k\nR2 OUT 0 2.2k\n.end' : '* Paste SPICE netlist here...\n* Example:\nV1 VCC 0 DC 12\nR1 VCC OUT 1k\nR2 OUT 0 2.2k\n.end') + '"'
    + ' style="width:100%;height:280px;background:#0a0a1a;color:#00ff41;border:1px solid #333;border-radius:8px;padding:12px;font-family:monospace;font-size:13px;resize:vertical;line-height:1.5;box-sizing:border-box"></textarea>'
    + '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px">'
    + '<span id="spice-line-count" style="color:#666;font-size:12px">0 ' + (tr ? 'satır' : 'lines') + '</span>'
    + '<div style="display:flex;gap:8px">'
    + '<button id="spice-clear-btn" style="padding:6px 12px;background:#333;color:#aaa;border:none;border-radius:6px;cursor:pointer;font-size:12px">' + (tr ? 'Temizle' : 'Clear') + '</button>'
    + '<button id="spice-import-btn" style="padding:8px 20px;background:#00aa44;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:14px;font-weight:bold">\u26A1 ' + (tr ? 'Devreyi Kur' : 'Import Circuit') + '</button>'
    + '</div></div></div>'

    // FILE TAB
    + '<div id="spice-file-tab" style="display:none">'
    + '<div id="spice-drop-zone" style="border:2px dashed #333;border-radius:12px;padding:40px;text-align:center;cursor:pointer">'
    + '<div style="font-size:48px;margin-bottom:12px">\uD83D\uDCC4</div>'
    + '<div style="color:#aaa;font-size:14px">' + (tr ? '.cir, .spice, .sp dosyası sürükleyin veya tıklayın' : 'Drop .cir, .spice, .sp file or click') + '</div>'
    + '<input type="file" id="spice-file-input" accept=".cir,.spice,.sp,.net,.txt" style="display:none">'
    + '</div></div>'

    // EXAMPLES TAB
    + '<div id="spice-examples-tab" style="display:none;max-height:350px;overflow-y:auto">'
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">' + examples + '</div>'
    + '</div>';

  modal.appendChild(content);
  document.body.appendChild(modal);

  // Event listeners
  document.getElementById('spice-modal-close').addEventListener('click', function() { modal.remove(); });
  modal.addEventListener('click', function(e) { if (e.target === modal) modal.remove(); });

  // Tab switching
  document.getElementById('spice-tab-paste').addEventListener('click', function() { showSpiceTab('paste'); });
  document.getElementById('spice-tab-file').addEventListener('click', function() { showSpiceTab('file'); });
  document.getElementById('spice-tab-examples').addEventListener('click', function() { showSpiceTab('examples'); });

  // Textarea events
  var ta = document.getElementById('spice-input');
  if (ta) {
    ta.addEventListener('input', updateLineCount);
    ta.addEventListener('paste', function() {
      setTimeout(function() {
        updateLineCount();
        if (ta.value.trim().length > 20) {
          ta.style.borderColor = '#00aa44';
          setTimeout(function() { ta.style.borderColor = '#333'; }, 1000);
        }
      }, 100);
    });
  }

  // Clear button
  document.getElementById('spice-clear-btn').addEventListener('click', function() {
    var inp = document.getElementById('spice-input');
    if (inp) { inp.value = ''; updateLineCount(); }
  });

  // Import button
  document.getElementById('spice-import-btn').addEventListener('click', importSpiceFromTextarea);

  // File tab — drop zone & file input
  var dropZone = document.getElementById('spice-drop-zone');
  var fileInput = document.getElementById('spice-file-input');
  if (dropZone) {
    dropZone.addEventListener('click', function() { fileInput.click(); });
    dropZone.addEventListener('dragover', function(e) { e.preventDefault(); dropZone.style.borderColor = '#00aa44'; });
    dropZone.addEventListener('dragleave', function() { dropZone.style.borderColor = '#333'; });
    dropZone.addEventListener('drop', function(e) { e.preventDefault(); dropZone.style.borderColor = '#333'; handleSpiceFileDrop(e); });
  }
  if (fileInput) {
    fileInput.addEventListener('change', function(e) { handleSpiceFileSelect(e); });
  }

  // ESC to close
  function escHandler(e) {
    if (e.key === 'Escape') { modal.remove(); document.removeEventListener('keydown', escHandler); }
  }
  document.addEventListener('keydown', escHandler);
}

function updateLineCount() {
  var ta = document.getElementById('spice-input');
  var count = ta ? ta.value.split('\n').length : 0;
  var el = document.getElementById('spice-line-count');
  var lang = (typeof currentLang !== 'undefined' ? currentLang : 'en');
  if (el) el.textContent = count + ' ' + (lang === 'tr' ? 'satır' : 'lines');
}

function showSpiceTab(tab) {
  ['paste', 'file', 'examples'].forEach(function(t) {
    var tabEl = document.getElementById('spice-' + t + '-tab');
    var btnEl = document.getElementById('spice-tab-' + t);
    if (tabEl) tabEl.style.display = (t === tab) ? '' : 'none';
    if (btnEl) {
      btnEl.style.background = (t === tab) ? '#2a2a4a' : 'transparent';
      btnEl.style.borderColor = (t === tab) ? '#444' : '#333';
      btnEl.style.color = (t === tab) ? '#fff' : '#aaa';
    }
  });
}

function importSpiceFromTextarea() {
  var ta = document.getElementById('spice-input');
  if (!ta || !ta.value.trim()) {
    var lang = (typeof currentLang !== 'undefined' ? currentLang : 'en');
    alert(lang === 'tr' ? 'Netlist boş!' : 'Netlist is empty!');
    return;
  }
  var netlist = ta.value.trim();
  if (VXA.SpiceImport && VXA.SpiceImport.parse) {
    try {
      var circuit = VXA.SpiceImport.parse(netlist);
      if (circuit && circuit.parts && circuit.parts.length > 0) {
        VXA.SpiceImport.placeCircuit(circuit);
        var modal = document.getElementById('spice-import-modal');
        if (modal) modal.remove();
        if (typeof showInfoCard === 'function') {
          showInfoCard('SPICE Import', circuit.parts.length + (currentLang === 'tr' ? ' bileşen import edildi.' : ' components imported.'), '');
        }
        if (typeof announce === 'function') announce(circuit.parts.length + ' components imported');
      } else {
        var lang = (typeof currentLang !== 'undefined' ? currentLang : 'en');
        var warnMsg = circuit.warnings && circuit.warnings.length > 0 ? '\n' + circuit.warnings.join('\n') : '';
        alert((lang === 'tr' ? 'Netlist parse edilemedi. Formatı kontrol edin.' : 'Failed to parse netlist. Check format.') + warnMsg);
      }
    } catch (e) {
      alert((currentLang === 'tr' ? 'Import hatası: ' : 'Import error: ') + e.message);
    }
  }
}

function handleSpiceFileDrop(event) {
  var file = event.dataTransfer ? event.dataTransfer.files[0] : null;
  if (file) readSpiceFile(file);
}

function handleSpiceFileSelect(event) {
  var file = event.target.files[0];
  if (file) readSpiceFile(file);
}

function readSpiceFile(file) {
  var reader = new FileReader();
  reader.onload = function(e) {
    showSpiceTab('paste');
    var ta = document.getElementById('spice-input');
    if (ta) { ta.value = e.target.result; updateLineCount(); }
  };
  reader.readAsText(file);
}

function _generateSpiceExamples(tr) {
  var examples = [
    { name: tr ? 'Gerilim Bölücü' : 'Voltage Divider', en: 'Voltage Divider', icon: '\u26A1',
      code: 'V1 VCC 0 DC 12\nR1 VCC OUT 10k\nR2 OUT 0 10k\n.end' },
    { name: tr ? 'LED Devresi' : 'LED Circuit', en: 'LED Circuit', icon: '\uD83D\uDCA1',
      code: 'V1 VCC 0 DC 5\nR1 VCC LED_A 220\nD1 LED_A 0 RED_LED\n.model RED_LED D(IS=1e-20 N=1.8 RS=5)\n.end' },
    { name: tr ? 'RC Alçak Geçiren' : 'RC Low-Pass', en: 'RC Low-Pass', icon: '\u301C\uFE0F',
      code: 'V1 IN 0 SIN(0 1 1000)\nR1 IN OUT 1k\nC1 OUT 0 100n\n.end' },
    { name: tr ? 'CE Amplifikatör' : 'CE Amplifier', en: 'CE Amplifier', icon: '\uD83D\uDCC8',
      code: 'V1 VCC 0 DC 12\nV2 IN 0 SIN(0 0.01 1000)\nR1 VCC B1 47k\nR2 B1 0 10k\nRC VCC C1 4.7k\nRE E1 0 1k\nC1 IN B1 1u\nQ1 C1 B1 E1 2N2222\n.model 2N2222 NPN(IS=14.34E-15 BF=255.9)\n.end' },
    { name: tr ? 'Op-Amp Evirici' : 'Inverting Op-Amp', en: 'Inverting Op-Amp', icon: '\uD83D\uDD04',
      code: 'V1 VCC 0 DC 12\nV2 VEE 0 DC -12\nV3 IN 0 SIN(0 0.5 1000)\nR1 IN INV 10k\nR2 INV OUT 100k\n.end' },
    { name: tr ? 'Tam Dalga Doğrultucu' : 'Full-Wave Rectifier', en: 'Full-Wave Rectifier', icon: '\uD83D\uDD0C',
      code: 'V1 IN 0 SIN(0 12 50)\nD1 IN OUT 1N4007\nD2 0 OUT 1N4007\nD3 RET 0 1N4007\nD4 RET IN 1N4007\nR1 OUT RET 1k\nC1 OUT RET 100u\n.model 1N4007 D(IS=7.02e-9 N=1.8 RS=0.04)\n.end' }
  ];

  return examples.map(function(ex) {
    return '<div class="spice-example-card" data-code="' + ex.code.replace(/"/g, '&quot;').replace(/\n/g, '\\n') + '"'
      + ' style="background:#1e1e3a;border:1px solid #333;border-radius:8px;padding:12px;cursor:pointer;transition:border-color 0.2s"'
      + ' onmouseover="this.style.borderColor=\'#00aa44\'" onmouseout="this.style.borderColor=\'#333\'">'
      + '<div style="font-size:20px;margin-bottom:4px">' + ex.icon + '</div>'
      + '<div style="color:#fff;font-size:13px;font-weight:bold">' + ex.name + '</div>'
      + '<div style="color:#666;font-size:11px;margin-top:2px">' + ex.en + '</div>'
      + '</div>';
  }).join('');
}

// Example click handler — delegated
document.addEventListener('click', function(e) {
  var card = e.target.closest('.spice-example-card');
  if (card && card.dataset.code) {
    loadSpiceExample(card.dataset.code);
  }
});

function loadSpiceExample(code) {
  showSpiceTab('paste');
  var ta = document.getElementById('spice-input');
  if (ta) {
    ta.value = code.replace(/\\n/g, '\n');
    updateLineCount();
  }
}

// ===== CTRL+V SPICE DETECTION =====
document.addEventListener('paste', function(e) {
  if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;
  // Don't intercept if SPICE modal is open
  if (document.getElementById('spice-import-modal')) return;

  var text = '';
  try { text = (e.clipboardData || window.clipboardData).getData('text'); } catch(ex) {}
  if (!text || text.length < 10) return;

  var isSpice = (text.indexOf('.end') >= 0) ||
    (/^[RVCLQDMX]\d+\s/m).test(text) ||
    (text.indexOf('.model') >= 0) ||
    (text.indexOf('.subckt') >= 0);

  if (isSpice) {
    e.preventDefault();
    e.stopImmediatePropagation();
    showSpiceImportModal();
    setTimeout(function() {
      var ta = document.getElementById('spice-input');
      if (ta) { ta.value = text; updateLineCount(); }
    }, 100);
  }
});

// ===== DRAG & DROP .cir FILES ON CANVAS =====
(function() {
  document.addEventListener('dragover', function(e) {
    if (e.dataTransfer && e.dataTransfer.types && e.dataTransfer.types.indexOf('Files') >= 0) {
      e.preventDefault();
    }
  });
  document.addEventListener('drop', function(e) {
    var file = e.dataTransfer ? e.dataTransfer.files[0] : null;
    if (!file) return;
    var ext = file.name.split('.').pop().toLowerCase();
    if (ext === 'cir' || ext === 'spice' || ext === 'sp' || ext === 'net') {
      e.preventDefault();
      var reader = new FileReader();
      reader.onload = function(ev) {
        showSpiceImportModal();
        setTimeout(function() {
          var ta = document.getElementById('spice-input');
          if (ta) { ta.value = ev.target.result; updateLineCount(); }
        }, 100);
      };
      reader.readAsText(file);
    }
  });
})();

// ===== EMPTY CANVAS HINT =====
function drawEmptyCanvasHint(ctx, w, h) {
  if (S.parts.length > 0 || S.sim.running) return;
  var lang = (typeof currentLang !== 'undefined' ? currentLang : 'en');
  var tr = lang === 'tr';

  ctx.save();
  ctx.fillStyle = 'rgba(136, 153, 170, 0.25)';
  ctx.font = '15px var(--font-ui, sans-serif)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(tr ? 'Sol panelden bileşen sürükleyin veya Ctrl+V ile SPICE yapıştırın' :
    'Drag components from panel or paste SPICE with Ctrl+V', w / 2, h / 2);

  ctx.font = '12px var(--font-ui, sans-serif)';
  ctx.fillStyle = 'rgba(136, 153, 170, 0.18)';
  ctx.fillText((tr ? '\uD83D\uDCCB SPICE Import (Ctrl+I)  \u2022  \uD83D\uDCDA Presets  \u2022  \uD83E\uDD16 AI Asistan (Ctrl+/)' :
    '\uD83D\uDCCB SPICE Import (Ctrl+I)  \u2022  \uD83D\uDCDA Presets  \u2022  \uD83E\uDD16 AI Assistant (Ctrl+/)'), w / 2, h / 2 + 28);
  ctx.restore();
}
