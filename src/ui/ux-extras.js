// ──────── UX EXTRAS: POPUP + PROBE DOCK + RULERS ────────

// ===== 1. PART POPUP (floating on-canvas controls) =====
var _popupPart = null;
var _popupUpdateTimer = null;

function showPartPopup(part) {
  hidePartPopup();
  if (!part) return;
  _popupPart = part;

  var popup = document.createElement('div');
  popup.id = 'part-popup';

  // Convert world coords to screen coords
  var sx = part.x * S.view.zoom + S.view.ox;
  var sy = part.y * S.view.zoom + S.view.oy;
  var cRect = cvs.getBoundingClientRect();
  var px = cRect.left + sx + 30;
  var py = cRect.top + sy - 50;
  // Clamp to viewport
  if (px + 180 > window.innerWidth) px = cRect.left + sx - 200;
  if (py < 10) py = 10;

  popup.style.cssText = 'position:fixed;left:' + px + 'px;top:' + py + 'px;background:rgba(12,16,28,0.95);border:1px solid #336;border-radius:10px;padding:10px 14px;z-index:9500;min-width:160px;backdrop-filter:blur(8px);box-shadow:0 8px 32px rgba(0,0,0,0.5);font:12px var(--font-mono,monospace);color:#ddd';

  var def = COMP[part.type];
  var typeName = def ? (def.en || def.name || part.type) : part.type;

  popup.innerHTML =
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">'
    + '<span style="color:#88ccff;font-weight:bold;font-size:13px">' + part.name + '</span>'
    + '<span style="color:#666;font-size:10px">' + typeName + '</span>'
    + '</div>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-bottom:8px">'
    + '<div style="background:#0a0a1a;padding:3px 6px;border-radius:4px;text-align:center">'
    + '<div style="color:#666;font-size:9px">V</div>'
    + '<div style="color:#00ccff;font-size:12px" id="popup-v">' + fmtVal(part._v || 0, 'V') + '</div></div>'
    + '<div style="background:#0a0a1a;padding:3px 6px;border-radius:4px;text-align:center">'
    + '<div style="color:#666;font-size:9px">I</div>'
    + '<div style="color:#ffcc00;font-size:12px" id="popup-i">' + fmtVal(part._i || 0, 'A') + '</div></div>'
    + '</div>'
    + '<div style="display:flex;gap:4px;justify-content:center">'
    + '<button onclick="rotateSelected();hidePartPopup()" title="Döndür" style="background:#1a2a3a;border:1px solid #336;color:#aaa;width:28px;height:28px;border-radius:6px;cursor:pointer;font-size:14px">\u21BB</button>'
    + '<button onclick="ctxFlipH();hidePartPopup()" title="Çevir" style="background:#1a2a3a;border:1px solid #336;color:#aaa;width:28px;height:28px;border-radius:6px;cursor:pointer;font-size:14px">\u21C4</button>'
    + '<button onclick="doDuplicate();hidePartPopup()" title="Çoğalt" style="background:#1a2a3a;border:1px solid #336;color:#aaa;width:28px;height:28px;border-radius:6px;cursor:pointer;font-size:14px">\u2398</button>'
    + '<button onclick="deleteSelected();hidePartPopup()" title="Sil" style="background:#2a1a1a;border:1px solid #633;color:#f66;width:28px;height:28px;border-radius:6px;cursor:pointer;font-size:14px">\u2715</button>'
    + '</div>';

  document.body.appendChild(popup);

  // Live update timer
  _popupUpdateTimer = setInterval(function() {
    if (!_popupPart || !document.getElementById('part-popup')) { clearInterval(_popupUpdateTimer); return; }
    var vEl = document.getElementById('popup-v');
    var iEl = document.getElementById('popup-i');
    if (vEl) vEl.textContent = fmtVal(_popupPart._v || 0, 'V');
    if (iEl) iEl.textContent = fmtVal(_popupPart._i || 0, 'A');
  }, 200);

  // Close on outside click (delay to avoid immediate close)
  setTimeout(function() {
    document.addEventListener('mousedown', _popupOutsideHandler);
    document.addEventListener('keydown', _popupEscHandler);
  }, 50);
}

function hidePartPopup() {
  var popup = document.getElementById('part-popup');
  if (popup) popup.remove();
  _popupPart = null;
  if (_popupUpdateTimer) { clearInterval(_popupUpdateTimer); _popupUpdateTimer = null; }
  document.removeEventListener('mousedown', _popupOutsideHandler);
  document.removeEventListener('keydown', _popupEscHandler);
}

function _popupOutsideHandler(e) {
  var popup = document.getElementById('part-popup');
  if (popup && !popup.contains(e.target)) hidePartPopup();
}

function _popupEscHandler(e) {
  if (e.key === 'Escape') hidePartPopup();
}

// ===== 2. PROBE DOCK =====
(function initProbeDock() {
  if (typeof document === 'undefined') return;

  function createDock() {
    var dock = document.createElement('div');
    dock.id = 'probe-dock';
    dock.style.cssText = 'position:absolute;bottom:50px;left:50%;transform:translateX(-50%);display:flex;gap:12px;align-items:center;z-index:8;background:rgba(15,20,35,0.85);padding:8px 16px;border-radius:12px;border:1px solid #333;backdrop-filter:blur(8px)';

    dock.innerHTML =
      '<div style="text-align:center">'
      + '<div class="probe-dock-btn" id="pdock-red" style="width:36px;height:36px;border-radius:50%;border:2px solid #ff6666;background:radial-gradient(circle,#ff4444,#cc2222);color:#fff;display:flex;align-items:center;justify-content:center;cursor:grab;font-size:16px;font-weight:bold;box-shadow:0 0 10px rgba(255,50,50,0.4);transition:transform 0.2s" title="Kırmızı Prob (+)">+</div>'
      + '<div id="pdock-red-val" style="font:10px var(--font-mono,monospace);color:#888;margin-top:3px">\u2014</div>'
      + '</div>'
      + '<div id="pdock-delta" style="font:13px var(--font-mono,monospace);color:#666;min-width:70px;text-align:center">\u0394V: \u2014</div>'
      + '<div style="text-align:center">'
      + '<div class="probe-dock-btn" id="pdock-black" style="width:36px;height:36px;border-radius:50%;border:2px solid #666;background:radial-gradient(circle,#555,#222);color:#aaa;display:flex;align-items:center;justify-content:center;cursor:grab;font-size:16px;font-weight:bold;box-shadow:0 0 10px rgba(100,100,100,0.3);transition:transform 0.2s" title="Siyah Prob (\u2212)">\u2212</div>'
      + '<div id="pdock-black-val" style="font:10px var(--font-mono,monospace);color:#888;margin-top:3px">\u2014</div>'
      + '</div>';

    var wrap = document.getElementById('canvas-wrap') || document.body;
    wrap.appendChild(dock);

    // Click handlers — toggle probe mode and start drag
    document.getElementById('pdock-red').addEventListener('mousedown', function() {
      if (VXA.Probes && !VXA.Probes.isActive()) VXA.Probes.toggle();
      if (VXA.Probes) VXA.Probes.startDrag('red');
    });
    document.getElementById('pdock-black').addEventListener('mousedown', function() {
      if (VXA.Probes && !VXA.Probes.isActive()) VXA.Probes.toggle();
      if (VXA.Probes) VXA.Probes.startDrag('black');
    });

    // Hover effect
    ['pdock-red', 'pdock-black'].forEach(function(id) {
      var el = document.getElementById(id);
      el.addEventListener('mouseenter', function() { el.style.transform = 'scale(1.15)'; });
      el.addEventListener('mouseleave', function() { el.style.transform = ''; });
    });
  }

  // Update probe readings periodically
  function updateProbeReadings() {
    if (!VXA.Probes || !VXA.Probes.isActive()) return;
    var m = VXA.Probes.getMeasurement();
    var redVal = document.getElementById('pdock-red-val');
    var blackVal = document.getElementById('pdock-black-val');
    var deltaVal = document.getElementById('pdock-delta');
    if (m) {
      if (redVal) redVal.textContent = fmtVal(m.vRed || 0, 'V');
      if (blackVal) blackVal.textContent = fmtVal(m.vBlack || 0, 'V');
      if (deltaVal) deltaVal.textContent = '\u0394V: ' + fmtVal(m.voltage || 0, 'V');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createDock);
  } else {
    setTimeout(createDock, 200);
  }

  // Hook into render loop
  setInterval(updateProbeReadings, 250);
})();

// ===== 2B. PROBE CABLES (draw on canvas) =====
function drawProbeCables(ctx, w, h) {
  if (!VXA.Probes) return;
  var pState = VXA.Probes.getState();
  if (!pState || !pState.mode) return;
  var dockEl = document.getElementById('probe-dock');
  if (!dockEl) return;
  var cRect = cvs.getBoundingClientRect();
  var dRect = dockEl.getBoundingClientRect();
  // Dock center positions (screen → world)
  var redEl = document.getElementById('pdock-red');
  var blackEl = document.getElementById('pdock-black');
  var ids = ['red', 'black'];
  var colors = { red: '#ff4444', black: '#666666' };

  ids.forEach(function(id) {
    var pr = pState.probes[id];
    var btnEl = id === 'red' ? redEl : blackEl;
    if (!btnEl) return;
    var bRect = btnEl.getBoundingClientRect();
    // Dock button center in canvas screen coords
    var dsx = bRect.left + bRect.width / 2 - cRect.left;
    var dsy = bRect.top + bRect.height / 2 - cRect.top;
    // Convert to world coords
    var dwx = (dsx - S.view.ox) / S.view.zoom;
    var dwy = (dsy - S.view.oy) / S.view.zoom;

    var endX, endY;
    if (pr.attached && pr.x >= 0) {
      endX = pr.x; endY = pr.y;
    } else {
      // Short dangling cable
      endX = dwx; endY = dwy + 20;
    }

    // Draw catenary cable with extra sag
    ctx.strokeStyle = colors[id];
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
    ctx.beginPath();
    var segs = 16;
    var sag = Math.max(20, Math.hypot(endX - dwx, endY - dwy) * 0.25); // 2x gravity
    var t = Date.now() / 500;
    for (var i = 0; i <= segs; i++) {
      var r = i / segs;
      var mx = (dwx + endX) / 2, my = (dwy + endY) / 2 + sag;
      var px = (1-r)*(1-r)*dwx + 2*(1-r)*r*mx + r*r*endX;
      var py = (1-r)*(1-r)*dwy + 2*(1-r)*r*my + r*r*endY;
      // Subtle sine wobble
      var wobble = Math.sin(t + r * 8) * 1.5 * Math.sin(r * Math.PI);
      var dx = endX - dwx, dy = endY - dwy;
      var len = Math.sqrt(dx*dx+dy*dy) || 1;
      px += (-dy/len) * wobble;
      py += (dx/len) * wobble;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();
  });
}

// ===== 3. RULERS (canvas edge rulers) =====
function drawRulers(ctx, w, h) {
  var rulerSize = 20;
  var zoom = S.view.zoom;
  var ox = S.view.ox;
  var oy = S.view.oy;

  // Determine tick spacing based on zoom
  var rawStep = 100 / zoom;
  var niceSteps = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000];
  var step = niceSteps[niceSteps.length - 1];
  for (var i = 0; i < niceSteps.length; i++) {
    if (niceSteps[i] >= rawStep * 0.5) { step = niceSteps[i]; break; }
  }

  ctx.save();
  ctx.font = '8px "JetBrains Mono", monospace';
  ctx.textBaseline = 'middle';

  // Horizontal ruler (bottom)
  var hRulerY = h - rulerSize;
  ctx.fillStyle = 'rgba(10,10,25,0.7)';
  ctx.fillRect(0, hRulerY, w, rulerSize);
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 0.5;
  ctx.beginPath(); ctx.moveTo(0, hRulerY); ctx.lineTo(w, hRulerY); ctx.stroke();

  ctx.fillStyle = '#555';
  ctx.textAlign = 'center';
  var startX = Math.floor(-ox / zoom / step) * step;
  for (var wx = startX; wx < (w - ox) / zoom; wx += step) {
    var sx = wx * zoom + ox;
    if (sx < rulerSize || sx > w) continue;
    ctx.beginPath(); ctx.moveTo(sx, hRulerY); ctx.lineTo(sx, hRulerY + 5); ctx.stroke();
    ctx.fillText(wx.toFixed(0), sx, hRulerY + rulerSize / 2);
  }

  // Vertical ruler (left)
  ctx.fillStyle = 'rgba(10,10,25,0.7)';
  ctx.fillRect(0, 0, rulerSize, hRulerY);
  ctx.strokeStyle = '#333';
  ctx.beginPath(); ctx.moveTo(rulerSize, 0); ctx.lineTo(rulerSize, hRulerY); ctx.stroke();

  ctx.fillStyle = '#555';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  var startY = Math.floor(-oy / zoom / step) * step;
  for (var wy = startY; wy < (h - oy) / zoom; wy += step) {
    var sy = wy * zoom + oy;
    if (sy < 0 || sy > hRulerY) continue;
    ctx.beginPath(); ctx.moveTo(rulerSize - 5, sy); ctx.lineTo(rulerSize, sy); ctx.stroke();
    ctx.fillText(wy.toFixed(0), rulerSize - 2, sy);
  }

  // Corner box (bottom-left)
  ctx.fillStyle = 'rgba(10,10,25,0.85)';
  ctx.fillRect(0, hRulerY, rulerSize, rulerSize);

  ctx.restore();
}
