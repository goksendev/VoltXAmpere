// ──────── SPRINT 104.4 — STAMP MODE TOAST ────────
// Shown in the bottom-right when a keyboard shortcut picks a component.
// Two variants:
//   variant === 'enter'  — first stamp of a session, or first-ever stamp for
//                           this component. Long hint:
//                           "[R] Direnç · Tık yerleştir · R döndür · Esc iptal"
//                           (2 s)
//   variant === 'switch' — already in stamp mode and user pressed another
//                           letter. Short name only: "[C] Kapasitör" (1 s).
//
// Per-component seen counter in localStorage: after the 'enter' variant has
// fired 5 times for a component we stop showing any toast for it — the
// user has learnt the flow. The 'switch' variant also stops once the
// global firstStamp flag is set (first-ever enter).
//
// Public surface:
//   StampToast.show(compKey, catKey, letter, variant)  — fire the toast
//   StampToast.resetSeen()                             — dev helper

var StampToast = (function() {

  var ENTER_DURATION_MS = 2000;
  var SWITCH_DURATION_MS = 1000;
  var FADE_OUT_MS = 200;
  var SEEN_LIMIT  = 5;
  var STORAGE_PREFIX = 'vxa.toast.seen.';
  var FIRST_STAMP_KEY = 'vxa.toast.seen.firstStamp';

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

  function _firstStampFlag() {
    try { return localStorage.getItem(FIRST_STAMP_KEY) === '1'; } catch (e) { return false; }
  }
  function _setFirstStampFlag() {
    try { localStorage.setItem(FIRST_STAMP_KEY, '1'); } catch (e) {}
  }

  function show(compKey, catKey, letter, variant) {
    if (!compKey) return;
    variant = variant || 'enter';

    // Switch variant is a minor aid — once the user has been through a
    // full enter-style toast we assume they know the drill and skip.
    if (variant === 'switch' && _firstStampFlag()) return;

    if (_seen(compKey) >= SEEN_LIMIT) {
      if (el) el.classList.remove('stamp-toast-visible');
      if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
      return;
    }
    _bumpSeen(compKey);
    if (variant === 'enter') _setFirstStampFlag();

    _ensureEl();
    el.style.setProperty('--toast-accent', _catColor(catKey || (window.COMP && window.COMP[compKey] && window.COMP[compKey].cat)));

    var letterPart = letter ? '<span class="stamp-toast-key">' + letter + '</span>' : '';
    var name = _labelFor(compKey);
    var duration = ENTER_DURATION_MS;
    if (variant === 'switch') {
      duration = SWITCH_DURATION_MS;
      el.innerHTML =
        letterPart +
        '<span class="stamp-toast-name">' + name + '</span>';
    } else {
      el.innerHTML =
        letterPart +
        '<span class="stamp-toast-name">' + name + '</span>' +
        '<span class="stamp-toast-sep">·</span>' +
        '<span class="stamp-toast-hint"><kbd>Tık</kbd> yerleştir · <kbd>R</kbd> döndür · <kbd>Shift+Tık</kbd> override · <kbd>Esc</kbd> iptal</span>';
    }

    el.classList.add('stamp-toast-visible');
    if (hideTimer) clearTimeout(hideTimer);
    if (removeTimer) clearTimeout(removeTimer);
    hideTimer = setTimeout(function() {
      if (el) el.classList.remove('stamp-toast-visible');
      removeTimer = setTimeout(function() {
        // Node stays; next show() repopulates it.
      }, FADE_OUT_MS);
    }, duration);
  }

  // Sprint 104.5 — tiny "auto-nudged" toast. Shown the first 3 times smart
  // placement offsets a stamp, then silent. Resets when the user exits
  // stamp mode (via startPlace toggling inStamp off — we drive it by
  // tracking a per-session counter on the module closure).
  var _nudgeCount = 0;
  var _NUDGE_LIMIT = 3;
  function showNudge() {
    if (_nudgeCount >= _NUDGE_LIMIT) return;
    _nudgeCount++;
    _ensureEl();
    el.style.setProperty('--toast-accent', 'var(--cat-temel)');
    el.innerHTML = '<span class="stamp-toast-nudge-ico">\u2197</span><span class="stamp-toast-name">Otomatik kaydırıldı</span><span class="stamp-toast-hint"><kbd>Shift+Tık</kbd> override</span>';
    el.classList.add('stamp-toast-visible');
    if (hideTimer) clearTimeout(hideTimer);
    if (removeTimer) clearTimeout(removeTimer);
    hideTimer = setTimeout(function() {
      if (el) el.classList.remove('stamp-toast-visible');
    }, 1100);
  }
  function resetNudge() { _nudgeCount = 0; }

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

  return { show: show, showNudge: showNudge, resetNudge: resetNudge, resetSeen: resetSeen };
})();

if (typeof window !== 'undefined') window.StampToast = StampToast;
