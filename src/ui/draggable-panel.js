// ──────── SPRINT 105.1 — DRAGGABLE FLOATING PANEL HELPER ────────
// Generic helper that turns any element with an .fp-handle child into a
// pointer-draggable floating panel. Position is persisted in localStorage
// and clamped to the viewport with an 8px margin so a panel can't escape
// off-screen even on resize. Double-clicking the handle restores the
// caller-provided default position.
//
// Public surface:
//   DraggablePanel.attach(panelEl, {
//     storageKey: 'vxa.panel.map.pos',
//     defaultPos: { left: 12, top: 12 }    // OR { right: 12, bottom: 12 }
//   })
//
// Position object stored as { left, top } in CSS pixels (top-left anchor).
// Viewport clamping converts right/bottom anchors to left/top on first
// apply so subsequent drags use a single coord system.

var DraggablePanel = (function() {

  var MARGIN = 8;
  var instances = [];

  function _readStored(key) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return null;
      var p = JSON.parse(raw);
      if (typeof p.left !== 'number' || typeof p.top !== 'number') return null;
      return p;
    } catch (e) { return null; }
  }
  function _store(key, pos) {
    try { localStorage.setItem(key, JSON.stringify({ left: pos.left, top: pos.top })); } catch (e) {}
  }

  function _viewport() {
    return { w: window.innerWidth, h: window.innerHeight };
  }

  function _clamp(pos, panelEl) {
    var rect = panelEl.getBoundingClientRect();
    var vp = _viewport();
    var maxLeft = Math.max(MARGIN, vp.w - rect.width - MARGIN);
    var maxTop = Math.max(MARGIN, vp.h - rect.height - MARGIN);
    return {
      left: Math.min(Math.max(MARGIN, pos.left), maxLeft),
      top: Math.min(Math.max(MARGIN, pos.top), maxTop)
    };
  }

  function _resolveDefault(defaults, panelEl) {
    // Accept {left, top} or {right, bottom}. Convert to {left, top}.
    var rect = panelEl.getBoundingClientRect();
    var vp = _viewport();
    var left, top;
    if (typeof defaults.left === 'number') left = defaults.left;
    else if (typeof defaults.right === 'number') left = vp.w - rect.width - defaults.right;
    else left = MARGIN;
    if (typeof defaults.top === 'number') top = defaults.top;
    else if (typeof defaults.bottom === 'number') top = vp.h - rect.height - defaults.bottom;
    else top = MARGIN;
    // Centered horizontally if defaults.centerX:true
    if (defaults.centerX) left = Math.round((vp.w - rect.width) / 2);
    return _clamp({ left: left, top: top }, panelEl);
  }

  function _apply(panelEl, pos) {
    panelEl.style.left = pos.left + 'px';
    panelEl.style.top = pos.top + 'px';
    panelEl.style.right = 'auto';
    panelEl.style.bottom = 'auto';
  }

  function attach(panelEl, opts) {
    if (!panelEl) return null;
    opts = opts || {};
    var storageKey = opts.storageKey;
    var defaults = opts.defaultPos || { left: 12, top: 12 };
    var handle = panelEl.querySelector('.fp-handle');
    if (!handle) return null;

    // Initial placement: stored > defaults
    function initialPlace() {
      var stored = storageKey ? _readStored(storageKey) : null;
      var pos = stored ? _clamp(stored, panelEl) : _resolveDefault(defaults, panelEl);
      _apply(panelEl, pos);
    }
    // Defer so the panel has its computed dimensions.
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initialPlace);
    } else {
      requestAnimationFrame(initialPlace);
    }

    var dragging = false;
    var startPointer = { x: 0, y: 0 };
    var startPanel = { left: 0, top: 0 };
    var pointerId = null;

    function _onDown(e) {
      if (e.button !== undefined && e.button !== 0) return;
      var rect = panelEl.getBoundingClientRect();
      startPointer.x = e.clientX;
      startPointer.y = e.clientY;
      startPanel.left = rect.left;
      startPanel.top = rect.top;
      dragging = true;
      pointerId = e.pointerId !== undefined ? e.pointerId : null;
      panelEl.classList.add('dragging');
      try { handle.setPointerCapture && pointerId !== null && handle.setPointerCapture(pointerId); } catch (err) {}
      if (e.cancelable) e.preventDefault();
    }
    function _onMove(e) {
      if (!dragging) return;
      var dx = e.clientX - startPointer.x;
      var dy = e.clientY - startPointer.y;
      var pos = _clamp({ left: startPanel.left + dx, top: startPanel.top + dy }, panelEl);
      _apply(panelEl, pos);
      if (e.cancelable) e.preventDefault();
    }
    function _onUp() {
      if (!dragging) return;
      dragging = false;
      panelEl.classList.remove('dragging');
      try { pointerId !== null && handle.releasePointerCapture && handle.releasePointerCapture(pointerId); } catch (err) {}
      var rect = panelEl.getBoundingClientRect();
      if (storageKey) _store(storageKey, { left: Math.round(rect.left), top: Math.round(rect.top) });
    }
    function _onDblClick() {
      var pos = _resolveDefault(defaults, panelEl);
      _apply(panelEl, pos);
      if (storageKey) _store(storageKey, { left: pos.left, top: pos.top });
    }

    if (window.PointerEvent) {
      handle.addEventListener('pointerdown', _onDown);
      handle.addEventListener('pointermove', _onMove);
      handle.addEventListener('pointerup', _onUp);
      handle.addEventListener('pointercancel', _onUp);
    } else {
      // Legacy fallback — combined mouse + touch.
      handle.addEventListener('mousedown', _onDown);
      window.addEventListener('mousemove', _onMove);
      window.addEventListener('mouseup', _onUp);
      handle.addEventListener('touchstart', function(t) {
        if (!t.touches || !t.touches[0]) return;
        _onDown({ button: 0, clientX: t.touches[0].clientX, clientY: t.touches[0].clientY, cancelable: true, preventDefault: function() { t.preventDefault(); } });
      }, { passive: false });
      window.addEventListener('touchmove', function(t) {
        if (!dragging || !t.touches || !t.touches[0]) return;
        _onMove({ clientX: t.touches[0].clientX, clientY: t.touches[0].clientY, cancelable: true, preventDefault: function() { t.preventDefault(); } });
      }, { passive: false });
      window.addEventListener('touchend', _onUp);
    }
    handle.addEventListener('dblclick', _onDblClick);

    // Re-clamp on viewport resize so a panel doesn't get stranded off-screen.
    window.addEventListener('resize', function() {
      var rect = panelEl.getBoundingClientRect();
      var pos = _clamp({ left: rect.left, top: rect.top }, panelEl);
      _apply(panelEl, pos);
    });

    var inst = { panel: panelEl, handle: handle, storageKey: storageKey, reset: _onDblClick };
    instances.push(inst);
    return inst;
  }

  function getAll() { return instances.slice(); }
  function resetAll() { instances.forEach(function(i) { i.reset(); }); }

  return { attach: attach, getAll: getAll, resetAll: resetAll };
})();

if (typeof window !== 'undefined') window.DraggablePanel = DraggablePanel;
