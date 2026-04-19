// ──────── SPRINT 104.5 — STAMP MODE DOM OVERLAYS ────────
// Two absolutely-positioned DOM elements living inside #canvas-wrap:
//
//   .snap-hint      — 10px pulsing dot showing which grid intersection the
//                      ghost will snap to. CSS handles the pulse animation
//                      so we don't tax the canvas redraw loop.
//   .rotation-pill  — tiny monospace chip near the ghost showing the
//                      current rotation angle (and flip icons). Hidden
//                      when the ghost is at 0° with no flips — nothing
//                      interesting to show.
//
// Both layers read world→screen coordinates via the canvas transform the
// simulator already uses (S.view.zoom + S.view.ox/oy). We register a
// pointermove listener on #canvas-wrap so the update happens alongside
// the existing canvas mousemove without fighting it.
//
// Public surface:
//   StampOverlay.update()    — repositions hints to current S.mouse + S.place*
//   StampOverlay.hide()      — force hide (called on stamp exit)

var StampOverlay = (function() {

  var snapEl = null;
  var pillEl = null;
  var wrapEl = null;

  function _ensure() {
    if (wrapEl) return;
    wrapEl = document.getElementById('canvas-wrap');
    if (!wrapEl) return;
    snapEl = document.createElement('div');
    snapEl.className = 'snap-hint';
    snapEl.setAttribute('aria-hidden', 'true');
    wrapEl.appendChild(snapEl);
    pillEl = document.createElement('div');
    pillEl.className = 'rotation-pill';
    pillEl.setAttribute('aria-hidden', 'true');
    wrapEl.appendChild(pillEl);
  }

  function _catColor() {
    var key = (typeof S !== 'undefined' && S.placingType) || null;
    var cat = key && window.COMP && window.COMP[key] ? window.COMP[key].cat : null;
    var map = {
      Passive: '--cat-pasif', Sources: '--cat-kaynaklar', Semi: '--cat-yariiletken',
      ICs: '--cat-entegre', Logic: '--cat-lojik', Mixed: '--cat-mixedsignal',
      Control: '--cat-kontrol', Basic: '--cat-temel', Blocks: '--cat-temel'
    };
    return 'var(' + (map[cat] || '--cat-temel') + ')';
  }

  function _worldToScreen(wx, wy) {
    if (typeof S === 'undefined' || !S.view) return { x: 0, y: 0 };
    return { x: wx * S.view.zoom + S.view.ox, y: wy * S.view.zoom + S.view.oy };
  }

  function update() {
    _ensure();
    if (!wrapEl || !snapEl || !pillEl) return;
    var inStamp = (typeof S !== 'undefined') && S.mode === 'place' && S.placingType;
    if (!inStamp) { snapEl.style.display = 'none'; pillEl.style.display = 'none'; return; }

    // Snap glow — snap(S.mouse.wx), snap(S.mouse.wy) should match the
    // position drawGhostPreview uses.
    if (typeof S.mouse !== 'undefined' && typeof snap === 'function') {
      var sx = snap(S.mouse.wx);
      var sy = snap(S.mouse.wy);
      var p = _worldToScreen(sx, sy);
      snapEl.style.display = 'block';
      snapEl.style.left = (p.x - 12) + 'px';
      snapEl.style.top = (p.y - 12) + 'px';
      snapEl.style.setProperty('--cat-accent', _catColor());

      // Rotation pill — show only when interesting (not 0° no flip).
      var rot = (S.placeRot || 0) * 90;
      var flipH = !!S.placeFlipH, flipV = !!S.placeFlipV;
      if (rot === 0 && !flipH && !flipV) {
        pillEl.style.display = 'none';
      } else {
        var txt = rot + '°';
        if (flipH) txt += ' \u21C6';  // ⇆
        if (flipV) txt += ' \u21C5';  // ⇅
        pillEl.textContent = txt;
        pillEl.style.display = 'block';
        pillEl.style.left = (p.x + 16) + 'px';
        pillEl.style.top = (p.y - 28) + 'px';
        pillEl.style.setProperty('--cat-accent', _catColor());
      }
    }
  }

  function hide() {
    if (snapEl) snapEl.style.display = 'none';
    if (pillEl) pillEl.style.display = 'none';
  }

  // Drive updates off canvas-wrap pointer events — these already fire on
  // every move the simulator cares about.
  if (typeof document !== 'undefined') {
    function _wire() {
      _ensure();
      if (!wrapEl) return;
      wrapEl.addEventListener('pointermove', update);
      wrapEl.addEventListener('pointerenter', update);
      // Fallback ticker so the pill shows up right after R/F rotate/flip
      // even if the mouse hasn't moved since.
      setInterval(update, 120);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', _wire);
    else _wire();
  }

  return { update: update, hide: hide };
})();

if (typeof window !== 'undefined') window.StampOverlay = StampOverlay;
