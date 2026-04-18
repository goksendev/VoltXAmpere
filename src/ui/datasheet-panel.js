// ──────── SPRINT 104.3.6 — DATASHEET PANEL ────────
// Hover-triggered floating panel that surfaces DATASHEETS content for the
// card currently under the cursor. 350 ms open delay + 250 ms grace close
// keep it from flickering on quick pans. Esc closes immediately. Scrolling
// the sidebar dismisses (content no longer aligned). Panel auto-clamps to
// viewport height and can scroll internally.
//
// Public surface:
//   DatasheetPanel.attach(cardEl, compKey, catKey)
//     — wires mouseenter/mouseleave/focus/blur on one card.
//   DatasheetPanel.closeNow()
//     — forced close (called by Esc + sidebar scroll).

var DatasheetPanel = (function() {

  var HOVER_DELAY = 350;
  var GRACE_DELAY = 250;
  var OFFSET_X    = 10;
  var PANEL_W     = 420;

  var CAT_COLOR = {
    Passive: '--cat-pasif',
    Sources: '--cat-kaynaklar',
    Semi:    '--cat-yariiletken',
    ICs:     '--cat-entegre',
    Logic:   '--cat-lojik',
    Mixed:   '--cat-mixedsignal',
    Control: '--cat-kontrol',
    Blocks:  '--cat-temel',
    Basic:   '--cat-temel'
  };

  var panelEl = null;
  var hoverTimer = null;
  var graceTimer = null;
  var openKey = null;

  function _ensurePanel() {
    if (panelEl) return panelEl;
    panelEl = document.createElement('div');
    panelEl.id = 'ds-panel';
    panelEl.className = 'ds-panel';
    panelEl.setAttribute('role', 'tooltip');
    panelEl.addEventListener('mouseenter', function() {
      if (graceTimer) { clearTimeout(graceTimer); graceTimer = null; }
    });
    panelEl.addEventListener('mouseleave', function() {
      _scheduleClose();
    });
    document.body.appendChild(panelEl);
    return panelEl;
  }

  function _esc(s) {
    if (s == null) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function _section(label, bodyHtml) {
    if (!bodyHtml) return '';
    return '<div class="ds-section"><div class="ds-section-head">'+_esc(label)+'</div><div class="ds-section-body">'+bodyHtml+'</div></div>';
  }

  function _renderHtml(compKey, catKey) {
    var ds = (window.DATASHEETS || {})[compKey];
    var names = (typeof _compNames === 'function' && window.COMP) ? _compNames(compKey, window.COMP[compKey] || {}) : { tr: compKey, en: compKey };
    var entry = (window.SIDEBAR_I18N || {})[compKey] || {};
    var accentVar = CAT_COLOR[catKey] || '--cat-temel';

    // Header
    var tagline = ds && ds.tagline ? '<span class="ds-tagline">'+_esc(ds.tagline)+'</span>' : '';
    var unit = entry.primaryUnit ? ' · <span class="ds-unit">'+_esc(entry.primaryUnit)+'</span>' : '';
    var headerEn = names.en && names.en !== names.tr ? _esc(names.en) : '';
    var headerSub = headerEn + unit;

    // Symbol (render via the same pipeline as the card)
    var symWrap = '';
    try {
      var def = (window.COMP || {})[compKey];
      if (def && typeof _renderCardSymbol === 'function') {
        var canvas = _renderCardSymbol(def);
        canvas.style.width = '46px';
        canvas.style.height = '46px';
        canvas.width = 46 * (window.devicePixelRatio || 1);
        canvas.height = 46 * (window.devicePixelRatio || 1);
        symWrap = '<div class="ds-sym" data-sym></div>';
      }
    } catch (e) {}

    var html = '';
    html += '<div class="ds-accent-bar"></div>';
    html += '<div class="ds-header">';
    html +=   (symWrap ? '<div class="ds-sym-slot"></div>' : '');
    html +=   '<div class="ds-title-group">';
    html +=     '<div class="ds-title">'+_esc(names.tr)+'</div>';
    if (headerSub) html += '<div class="ds-subtitle">'+headerSub+'</div>';
    if (tagline) html += tagline;
    html +=   '</div>';
    html += '</div>';

    if (!ds) {
      html += '<div class="ds-empty">Bu bileşen için datasheet henüz yazılmadı.</div>';
      return { html: html, accentVar: accentVar, compKey: compKey };
    }

    // NE İŞ YAPAR
    if (ds.whatItDoes) {
      html += _section('Ne İş Yapar', '<p class="ds-p">'+_esc(ds.whatItDoes)+'</p>');
    }

    // TEMEL DENKLEM
    if (ds.equation) {
      var eqLabel = ds.equation.label ? '<div class="ds-eq-label">'+_esc(ds.equation.label)+'</div>' : '';
      html += _section('Temel Denklem', '<div class="ds-eq-block"><div class="ds-eq-formula">'+_esc(ds.equation.formula)+'</div>'+eqLabel+'</div>');
    }

    // GRAFİK
    if (ds.chart && typeof DatasheetChart !== 'undefined') {
      var chartSvg = DatasheetChart.render(ds.chart);
      var chartTitle = ds.chart.title ? '<div class="ds-chart-title">'+_esc(ds.chart.title)+'</div>' : '';
      html += _section('Grafik', chartTitle + chartSvg);
    }

    // ANAHTAR PARAMETRELER
    if (ds.keyParameters && ds.keyParameters.length) {
      var rows = ds.keyParameters.map(function(p) {
        var note = p.note ? '<span class="ds-kp-note">'+_esc(p.note)+'</span>' : '';
        return '<div class="ds-kp-row"><span class="ds-kp-name">'+_esc(p.name)+'</span><span class="ds-kp-val">'+_esc(p.value)+'</span>'+note+'</div>';
      }).join('');
      html += _section('Anahtar Parametreler', '<div class="ds-kp-grid">'+rows+'</div>');
    }

    // İLERİ
    if (ds.advanced && ds.advanced.length) {
      var adv = ds.advanced.map(function(a) { return '<li>'+_esc(a)+'</li>'; }).join('');
      html += _section('İleri', '<ul class="ds-bullet">'+adv+'</ul>');
    }

    // SPICE
    if (ds.spiceTemplate) {
      html += _section('SPICE', '<pre class="ds-spice">'+_esc(ds.spiceTemplate)+'</pre>');
    }

    // UYGULAMALAR
    if (ds.applications && ds.applications.length) {
      html += _section('Uygulamalar', '<div class="ds-applications">'+ds.applications.map(_esc).join(' <span class="ds-sep">·</span> ')+'</div>');
    }

    // UYARILAR
    if (ds.warnings && ds.warnings.length) {
      var w = ds.warnings.map(function(x){ return '<li><span class="ds-warn-ico">⚠</span> '+_esc(x)+'</li>'; }).join('');
      html += _section('Uyarılar', '<ul class="ds-warn">'+w+'</ul>');
    }

    return { html: html, accentVar: accentVar, compKey: compKey };
  }

  function _position(cardEl) {
    var rect = cardEl.getBoundingClientRect();
    var sidebar = document.getElementById('left');
    var sidebarRect = sidebar ? sidebar.getBoundingClientRect() : rect;
    var left = sidebarRect.right + OFFSET_X;
    var top = rect.top;

    // Clamp to viewport
    var maxTop = window.innerHeight - 40;
    var panelH = panelEl.offsetHeight || 400;
    if (top + panelH > window.innerHeight - 8) {
      top = Math.max(8, window.innerHeight - panelH - 8);
    }
    if (top < 8) top = 8;

    // Right-edge clamp
    if (left + PANEL_W > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - PANEL_W - 8);
    }

    panelEl.style.left = left + 'px';
    panelEl.style.top = top + 'px';
    panelEl.style.width = PANEL_W + 'px';
    panelEl.style.maxHeight = 'calc(100vh - 32px)';
  }

  function _open(cardEl, compKey, catKey) {
    if (!cardEl || !compKey) return;
    _ensurePanel();
    if (openKey === compKey && panelEl.classList.contains('ds-open')) return;
    var rendered = _renderHtml(compKey, catKey);
    panelEl.style.setProperty('--ds-accent', 'var(' + rendered.accentVar + ')');
    panelEl.innerHTML = rendered.html;

    // Fill symbol slot via the shared card-symbol pipeline so SVGs/canvas
    // stay identical to the sidebar look.
    try {
      var def = (window.COMP || {})[compKey];
      if (def && typeof _renderCardSymbol === 'function') {
        var slot = panelEl.querySelector('.ds-sym-slot');
        if (slot) {
          var canvas = _renderCardSymbol(def);
          canvas.style.width = '46px';
          canvas.style.height = '46px';
          // Scale canvas bitmap to match the enlarged slot
          canvas.width = 46 * (window.devicePixelRatio || 1);
          canvas.height = 46 * (window.devicePixelRatio || 1);
          // Redraw at 46px scale
          requestAnimationFrame(function() {
            try {
              var dpr = window.devicePixelRatio || 1;
              var ctx2 = canvas.getContext('2d');
              ctx2.clearRect(0,0,canvas.width,canvas.height);
              ctx2.save();
              ctx2.scale(dpr, dpr);
              ctx2.translate(23, 23);
              ctx2.scale(0.55, 0.55);
              ctx2.lineWidth = 4;
              def.draw.call(def, ctx2, 20, { val: 0, type: '' });
              ctx2.restore();
            } catch (e) {}
          });
          slot.appendChild(canvas);
        }
      }
    } catch (e) {}

    _position(cardEl);
    panelEl.classList.add('ds-open');
    openKey = compKey;
  }

  function _scheduleClose() {
    if (graceTimer) clearTimeout(graceTimer);
    graceTimer = setTimeout(function() {
      if (panelEl) panelEl.classList.remove('ds-open');
      openKey = null;
      graceTimer = null;
    }, GRACE_DELAY);
  }

  function closeNow() {
    if (hoverTimer) { clearTimeout(hoverTimer); hoverTimer = null; }
    if (graceTimer) { clearTimeout(graceTimer); graceTimer = null; }
    if (panelEl) panelEl.classList.remove('ds-open');
    openKey = null;
  }

  function attach(cardEl, compKey, catKey) {
    if (!cardEl) return;
    cardEl.addEventListener('mouseenter', function() {
      if (graceTimer) { clearTimeout(graceTimer); graceTimer = null; }
      if (hoverTimer) clearTimeout(hoverTimer);
      hoverTimer = setTimeout(function() { _open(cardEl, compKey, catKey); hoverTimer = null; }, HOVER_DELAY);
    });
    cardEl.addEventListener('mouseleave', function() {
      if (hoverTimer) { clearTimeout(hoverTimer); hoverTimer = null; }
      _scheduleClose();
    });
    cardEl.addEventListener('focus', function() {
      if (hoverTimer) clearTimeout(hoverTimer);
      hoverTimer = setTimeout(function() { _open(cardEl, compKey, catKey); hoverTimer = null; }, HOVER_DELAY);
    });
    cardEl.addEventListener('blur', _scheduleClose);
  }

  // Global close triggers
  if (typeof document !== 'undefined') {
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') closeNow();
    });
    // Sidebar scroll dismisses — content no longer aligned to card.
    function _wireScroll() {
      var left = document.getElementById('left');
      if (left) left.addEventListener('scroll', closeNow);
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', _wireScroll);
    } else {
      _wireScroll();
    }
  }

  return { attach: attach, closeNow: closeNow };
})();

if (typeof window !== 'undefined') window.DatasheetPanel = DatasheetPanel;
