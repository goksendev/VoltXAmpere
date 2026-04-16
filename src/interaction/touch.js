// Sprint 64: Touch support — long-press context menu, pinch guard, mouseup coords
(function initTouch() {
  if (typeof document === 'undefined') return;
  if (navigator.maxTouchPoints < 1) return;
  var wrap = document.getElementById('canvas-wrap');
  if (!wrap) return;
  var lastTouches = null, lastDist = 0;
  var longPressTimer = null, isPinching = false;
  var touchStartTime = 0, touchStartPos = null, hasMoved = false;

  function cancelLP() { clearTimeout(longPressTimer); }

  function showTouchContextMenu(sx, sy) {
    if (typeof cvs === 'undefined' || typeof S === 'undefined') return;
    var r = cvs.getBoundingClientRect();
    var mx = sx - r.left, my = sy - r.top;
    var zoom = (S.view && S.view.zoom) || 1;
    var ox = (S.view && S.view.ox) || 0, oy = (S.view && S.view.oy) || 0;
    var wx = (mx - ox) / zoom, wy = (my - oy) / zoom;
    var part = null;
    if (typeof hitTestPart === 'function') part = hitTestPart(wx, wy);
    else if (S.parts) {
      for (var i = S.parts.length - 1; i >= 0; i--) {
        var p = S.parts[i];
        if (Math.abs(p.x - wx) < 30 && Math.abs(p.y - wy) < 30) { part = p; break; }
      }
    }
    if (!part) return;
    S.sel = [part.id];
    var menu = document.getElementById('touch-ctx-menu');
    if (!menu) {
      menu = document.createElement('div');
      menu.id = 'touch-ctx-menu';
      document.body.appendChild(menu);
    }
    var btnStyle = 'padding:12px 20px;border-radius:8px;font:14px var(--font-ui,sans-serif);min-height:48px;cursor:pointer;';
    menu.innerHTML =
      '<button style="' + btnStyle + 'background:var(--surface-3,#333);color:var(--text,#eee);border:1px solid var(--border,#555)" onclick="if(typeof rotateSelected===\'function\')rotateSelected();window._hideTouchCtx()">&#8635; Rotate</button>' +
      '<button style="' + btnStyle + 'background:#e53e3e;color:#fff;border:none" onclick="if(typeof deleteSelected===\'function\')deleteSelected();window._hideTouchCtx()">&#10005; Delete</button>' +
      '<button style="' + btnStyle + 'background:var(--surface-3,#333);color:var(--text,#eee);border:1px solid var(--border,#555)" onclick="if(S.sel[0]){var p=S.parts.find(function(x){return x.id===S.sel[0]});if(p){p.flipH=!p.flipH;needsRender=true}}window._hideTouchCtx()">&#8644; Flip</button>' +
      '<button style="' + btnStyle + 'background:var(--surface-3,#333);color:var(--text,#eee);border:1px solid var(--border,#555)" onclick="window._hideTouchCtx()">&#10003; Close</button>';
    menu.style.transform = 'translateY(0)';
    if (typeof needsRender !== 'undefined') needsRender = true;
  }

  window._hideTouchCtx = function() {
    var m = document.getElementById('touch-ctx-menu');
    if (m) m.style.transform = 'translateY(100%)';
  };
  window._showTouchContextMenu = showTouchContextMenu;

  wrap.addEventListener('touchstart', function(e) {
    hasMoved = false;
    isPinching = false;
    touchStartTime = Date.now();
    if (e.touches.length === 1) {
      var t = e.touches[0];
      touchStartPos = { x: t.clientX, y: t.clientY };
      cancelLP();
      longPressTimer = setTimeout(function() {
        if (!hasMoved && !isPinching) showTouchContextMenu(t.clientX, t.clientY);
      }, 500);
      wrap.dispatchEvent(new MouseEvent('mousedown', { clientX: t.clientX, clientY: t.clientY, button: 0 }));
    }
    if (e.touches.length === 2) {
      isPinching = true;
      cancelLP();
      lastDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      lastTouches = [{ x: e.touches[0].clientX, y: e.touches[0].clientY }, { x: e.touches[1].clientX, y: e.touches[1].clientY }];
    }
    e.preventDefault();
  }, { passive: false });

  wrap.addEventListener('touchmove', function(e) {
    if (e.touches.length === 1 && !isPinching) {
      var t = e.touches[0];
      if (touchStartPos) {
        var dist = Math.hypot(t.clientX - touchStartPos.x, t.clientY - touchStartPos.y);
        if (dist > 10) { hasMoved = true; cancelLP(); }
      }
      wrap.dispatchEvent(new MouseEvent('mousemove', { clientX: t.clientX, clientY: t.clientY }));
    }
    if (e.touches.length === 2) {
      isPinching = true;
      cancelLP();
      var d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      if (lastDist > 0 && lastTouches) {
        var factor = d / lastDist;
        var cx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        var cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        var r = cvs.getBoundingClientRect();
        var mx = cx - r.left, my = cy - r.top;
        var nz = Math.max(S.view.minZoom, Math.min(S.view.maxZoom, S.view.zoom * factor));
        var ratio = nz / S.view.zoom;
        S.view.ox = mx - (mx - S.view.ox) * ratio;
        S.view.oy = my - (my - S.view.oy) * ratio;
        S.view.zoom = nz;
        var pmx = (lastTouches[0].x + lastTouches[1].x) / 2;
        var pmy = (lastTouches[0].y + lastTouches[1].y) / 2;
        var cmx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        var cmy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        S.view.ox += cmx - pmx;
        S.view.oy += cmy - pmy;
        needsRender = true;
      }
      lastDist = d;
      lastTouches = [{ x: e.touches[0].clientX, y: e.touches[0].clientY }, { x: e.touches[1].clientX, y: e.touches[1].clientY }];
    }
    e.preventDefault();
  }, { passive: false });

  wrap.addEventListener('touchend', function(e) {
    cancelLP();
    if (e.touches.length === 0) {
      var ct = e.changedTouches[0];
      wrap.dispatchEvent(new MouseEvent('mouseup', {
        clientX: ct ? ct.clientX : 0, clientY: ct ? ct.clientY : 0
      }));
      lastTouches = null;
      lastDist = 0;
      isPinching = false;
    }
    e.preventDefault();
  }, { passive: false });

  wrap.addEventListener('touchcancel', function(e) {
    cancelLP();
    wrap.dispatchEvent(new MouseEvent('mouseup', {}));
    lastTouches = null;
    lastDist = 0;
    isPinching = false;
  }, { passive: false });

  // FAB: mobile component add
  var fab = document.getElementById('fab-add');
  if (fab) {
    fab.addEventListener('click', function() {
      var panel = document.getElementById('mobile-comp-panel');
      if (!panel) {
        panel = document.createElement('div');
        panel.id = 'mobile-comp-panel';
        panel.style.cssText = 'position:fixed;bottom:0;left:0;right:0;height:50vh;' +
          'background:var(--surface-2,#1a1a1a);border-top:2px solid var(--accent,#00e09e);' +
          'z-index:150;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:12px;' +
          'display:grid;grid-template-columns:repeat(4,1fr);gap:8px;' +
          'transition:transform .3s;transform:translateY(100%)';
        var types = ['resistor','capacitor','inductor','vdc','vac','ground','diode','led','npn','opamp','switch','zener'];
        types.forEach(function(type) {
          var def = typeof COMP !== 'undefined' ? COMP[type] : null;
          if (!def) return;
          var btn = document.createElement('button');
          btn.style.cssText = 'padding:12px;border-radius:8px;background:var(--surface-3,#2a2a2a);' +
            'color:var(--text,#eee);border:1px solid var(--border,#444);font:12px var(--font-ui,sans-serif);' +
            'min-height:60px;display:flex;flex-direction:column;align-items:center;gap:4px;cursor:pointer';
          btn.textContent = def.name || type;
          btn.addEventListener('click', function() {
            if (typeof addPart === 'function') addPart(type);
            panel.style.transform = 'translateY(100%)';
          });
          panel.appendChild(btn);
        });
        document.body.appendChild(panel);
      }
      var vis = panel.style.transform === 'translateY(0px)' || panel.style.transform === 'translateY(0)';
      panel.style.transform = vis ? 'translateY(100%)' : 'translateY(0)';
    });
  }
})();
