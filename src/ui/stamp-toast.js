// ──────── SPRINT 104.4 — STAMP MODE TOAST ────────
// Shown for ~2 seconds in the bottom-right when a keyboard shortcut picks
// a component. Text: "[R] Direnç seçildi · Canvas'a tıkla · Space döndür · Esc iptal".
// Per-component seen counter in localStorage: after the user has seen the
// toast 3 times for the same component they've learnt the flow — we stop
// showing it.
//
// Public surface:
//   StampToast.show(compKey, catKey, letter) — fire the toast
//   StampToast.resetSeen()                   — dev helper (not wired)

var StampToast = (function() {

  var DURATION_MS = 2000;
  var FADE_OUT_MS = 200;
  var SEEN_LIMIT  = 3;
  var STORAGE_PREFIX = 'vxa.toast.seen.';

  var el = null;
  var hideTimer = null;
  var removeTimer = null;

  var CAT_COLOR_VAR = {
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

  function _catColor(catKey) {
    return 'var(' + (CAT_COLOR_VAR[catKey] || '--cat-temel') + ')';
  }

  function _seen(compKey) {
    try { return parseInt(localStorage.getItem(STORAGE_PREFIX + compKey), 10) || 0; }
    catch (e) { return 0; }
  }
  function _bumpSeen(compKey) {
    try { localStorage.setItem(STORAGE_PREFIX + compKey, String(_seen(compKey) + 1)); }
    catch (e) {}
  }

  function _ensureEl() {
    if (el) return el;
    el = document.createElement('div');
    el.className = 'stamp-toast';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    document.body.appendChild(el);
    return el;
  }

  function _labelFor(compKey) {
    var i18n = (window.SIDEBAR_I18N || {})[compKey];
    if (i18n && i18n.tr) return i18n.tr;
    var def = (window.COMP || {})[compKey];
    return def && def.name ? def.name : compKey;
  }

  function show(compKey, catKey, letter) {
    if (!compKey) return;
    if (_seen(compKey) >= SEEN_LIMIT) {
      // Already learnt — suppress AND actively hide any lingering toast
      // from a previous call (its .visible class may still have 2s to go).
      if (el) el.classList.remove('stamp-toast-visible');
      if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
      return;
    }
    _bumpSeen(compKey);

    _ensureEl();
    el.style.setProperty('--toast-accent', _catColor(catKey || (window.COMP && window.COMP[compKey] && window.COMP[compKey].cat)));

    var letterPart = letter ? '<span class="stamp-toast-key">' + letter + '</span>' : '';
    var name = _labelFor(compKey);
    el.innerHTML =
      letterPart +
      '<span class="stamp-toast-name">' + name + '</span>' +
      '<span class="stamp-toast-verb">seçildi</span>' +
      '<span class="stamp-toast-sep">·</span>' +
      '<span class="stamp-toast-hint">Canvas\'a tıkla · <kbd>Space</kbd> döndür · <kbd>Esc</kbd> iptal</span>';

    el.classList.add('stamp-toast-visible');
    if (hideTimer) clearTimeout(hideTimer);
    if (removeTimer) clearTimeout(removeTimer);
    hideTimer = setTimeout(function() {
      if (el) el.classList.remove('stamp-toast-visible');
      removeTimer = setTimeout(function() {
        // Leave the node in the DOM; next show() repopulates it. Keeps
        // layout stable if the user triggers rapid shortcuts.
      }, FADE_OUT_MS);
    }, DURATION_MS);
  }

  function resetSeen(compKey) {
    try {
      if (compKey) localStorage.removeItem(STORAGE_PREFIX + compKey);
      else {
        for (var i = localStorage.length - 1; i >= 0; i--) {
          var k = localStorage.key(i);
          if (k && k.indexOf(STORAGE_PREFIX) === 0) localStorage.removeItem(k);
        }
      }
    } catch (e) {}
  }

  return { show: show, resetSeen: resetSeen };
})();

if (typeof window !== 'undefined') window.StampToast = StampToast;
