// ──────── ENHANCED drawScope (overrides original via function hoisting) ────────
function drawScope() {
  var w = scvs.width / DPR, h = scvs.height / DPR;
  var ctrlH = 36, plotH = h - ctrlH;

  // Background
  if (S.scope.persist) {
    sctx.fillStyle = S.crtMode ? 'rgba(0,16,0,0.15)' : 'rgba(8,12,20,0.15)';
  } else {
    sctx.fillStyle = S.crtMode ? '#001000' : '#080c14';
  }
  sctx.fillRect(0, 0, w, h);

  // 10x8 grid
  sctx.strokeStyle = S.crtMode ? 'rgba(0,255,65,0.04)' : 'rgba(255,255,255,0.04)';
  sctx.lineWidth = 0.5;
  sctx.beginPath();
  for (var i = 1; i < 10; i++) { var x = w * i / 10; sctx.moveTo(x, 0); sctx.lineTo(x, plotH); }
  for (var i = 1; i < 8; i++) { var y = plotH * i / 8; sctx.moveTo(0, y); sctx.lineTo(w, y); }
  sctx.stroke();

  // Center crosshair
  sctx.strokeStyle = S.crtMode ? 'rgba(0,255,65,0.10)' : 'rgba(255,255,255,0.10)';
  sctx.lineWidth = 0.5;
  sctx.beginPath();
  sctx.moveTo(0, plotH / 2); sctx.lineTo(w, plotH / 2);
  sctx.moveTo(w / 2, 0); sctx.lineTo(w / 2, plotH);
  sctx.stroke();

  // Trigger level line
  if (S.scope.trigger.mode !== 'auto') {
    var tCh = S.scope.ch[S.scope.trigger.src];
    var tY = plotH / 2 - (S.scope.trigger.level / (tCh.vDiv || 2)) * (plotH / 8);
    sctx.strokeStyle = tCh.color + '60'; sctx.lineWidth = 1; sctx.setLineDash([4, 4]);
    sctx.beginPath(); sctx.moveTo(0, tY); sctx.lineTo(w, tY); sctx.stroke();
    sctx.setLineDash([]);
  }

  // ── Axis labels ──
  sctx.font = '9px "JetBrains Mono", monospace'; sctx.fillStyle = '#555';
  // X-axis: time labels
  var tTotal = (S.scope.tDiv || 0.001) * 10; // total time across 10 divisions
  sctx.textAlign = 'center'; sctx.textBaseline = 'top';
  for (var xi = 0; xi <= 10; xi += 2) {
    var tx = w * xi / 10;
    var tVal = tTotal * xi / 10;
    var tLbl = tVal < 0.001 ? (tVal*1e6).toFixed(0)+'\u00B5s' : tVal < 1 ? (tVal*1e3).toFixed(1)+'ms' : tVal.toFixed(2)+'s';
    sctx.fillText(tLbl, tx, plotH + 2);
  }
  // Y-axis: voltage labels (use first active channel's vDiv)
  var yVDiv = 2; // fallback
  for (var yi = 0; yi < 4; yi++) { if (S.scope.ch[yi].on) { yVDiv = S.scope.ch[yi].vDiv > 0 ? S.scope.ch[yi].vDiv : 2; break; } }
  sctx.textAlign = 'right'; sctx.textBaseline = 'middle';
  for (var yj = 0; yj <= 8; yj += 2) {
    var yPos = plotH * yj / 8;
    var vVal = (4 - yj) * yVDiv; // center=0, top=+4*vDiv, bottom=-4*vDiv
    var vLbl = Math.abs(vVal) < 0.01 ? '0' : (vVal >= 1000 ? (vVal/1000).toFixed(0)+'kV' : vVal >= 1 ? vVal.toFixed(0)+'V' : (vVal*1000).toFixed(0)+'mV');
    sctx.fillText(vLbl, w - 4, yPos);
  }

  // Draw each active channel
  var firstActiveBuf = null, firstActivePtr = 0;

  for (var c = 0; c < 4; c++) {
    var ch = S.scope.ch[c];
    if (!ch.on) continue;

    var buf = ch.buf, ptr = S.scope.ptr;
    var vd = ch.vDiv !== undefined ? ch.vDiv : 2;
    var mn = Infinity, mx = -Infinity;
    for (var i = 0; i < 600; i++) { var v = buf[(ptr + i) % 600]; if (v < mn) mn = v; if (v > mx) mx = v; }
    var autoVDiv = vd;
    if (vd === 0) {
      var range = mx - mn;
      if (range < 0.01) { autoVDiv = 0.01; } else {
        var target = range / 4;
        var nice = [0.001,0.002,0.005,0.01,0.02,0.05,0.1,0.2,0.5,1,2,5,10,20,50,100];
        autoVDiv = nice[nice.length - 1];
        for (var ni = 0; ni < nice.length; ni++) { if (nice[ni] >= target) { autoVDiv = nice[ni]; break; } }
      }
    }
    var yScale = (plotH / 8) / autoVDiv;
    var mid = vd === 0 ? (mx + mn) / 2 : 0;

    var traceColor = S.crtMode ? _crtPhosphorColors[c] : ch.color;

    // CRT persistence: draw old frames first
    if (S.crtMode) {
      var hist = _crtTraceHistory[c];
      for (var f = 0; f < hist.length; f++) {
        var age = hist.length - f;
        sctx.save();
        sctx.strokeStyle = traceColor;
        sctx.lineWidth = 1.5;
        sctx.globalAlpha = 0.4 / Math.pow(2, age);
        sctx.beginPath();
        var hBuf = hist[f];
        for (var i = 0; i < hBuf.length; i++) {
          var x = i / hBuf.length * w, y = plotH / 2 - (hBuf[i] - mid) * yScale;
          if (i === 0) sctx.moveTo(x, y); else sctx.lineTo(x, Math.max(0, Math.min(plotH, y)));
        }
        sctx.stroke();
        sctx.restore();
      }
    }

    // CRT phosphor glow layers
    if (S.crtMode) {
      // Glow layer 2 (widest)
      sctx.save();
      sctx.strokeStyle = traceColor; sctx.lineWidth = 10; sctx.globalAlpha = 0.04;
      sctx.shadowColor = traceColor; sctx.shadowBlur = 12;
      sctx.beginPath();
      for (var i = 0; i < 600; i++) {
        var x = i / 600 * w, y = plotH / 2 - (buf[(ptr + i) % 600] - mid) * yScale;
        if (i === 0) sctx.moveTo(x, y); else sctx.lineTo(x, Math.max(0, Math.min(plotH, y)));
      }
      sctx.stroke(); sctx.restore();

      // Glow layer 1 (medium)
      sctx.save();
      sctx.strokeStyle = traceColor; sctx.lineWidth = 4; sctx.globalAlpha = 0.15;
      sctx.shadowColor = traceColor; sctx.shadowBlur = 6;
      sctx.beginPath();
      for (var i = 0; i < 600; i++) {
        var x = i / 600 * w, y = plotH / 2 - (buf[(ptr + i) % 600] - mid) * yScale;
        if (i === 0) sctx.moveTo(x, y); else sctx.lineTo(x, Math.max(0, Math.min(plotH, y)));
      }
      sctx.stroke(); sctx.restore();
    } else {
      // Normal glow layer
      sctx.save();
      sctx.strokeStyle = traceColor; sctx.lineWidth = 4; sctx.globalAlpha = 0.12;
      sctx.shadowColor = traceColor; sctx.shadowBlur = 12;
      sctx.beginPath();
      for (var i = 0; i < 600; i++) {
        var x = i / 600 * w, y = plotH / 2 - (buf[(ptr + i) % 600] - mid) * yScale;
        if (i === 0) sctx.moveTo(x, y); else sctx.lineTo(x, Math.max(0, Math.min(plotH, y)));
      }
      sctx.stroke(); sctx.restore();
    }

    // Sharp line (main trace)
    sctx.strokeStyle = traceColor; sctx.lineWidth = 1.5; sctx.globalAlpha = 0.9;
    if (S.crtMode) { sctx.shadowColor = traceColor; sctx.shadowBlur = 3; }
    sctx.beginPath();
    for (var i = 0; i < 600; i++) {
      var x = i / 600 * w, y = plotH / 2 - (buf[(ptr + i) % 600] - mid) * yScale;
      if (i === 0) sctx.moveTo(x, y); else sctx.lineTo(x, Math.max(0, Math.min(plotH, y)));
    }
    sctx.stroke(); sctx.globalAlpha = 1; sctx.shadowBlur = 0;

    // Save current trace to CRT history
    if (S.crtMode) {
      var traceSnap = [];
      for (var i = 0; i < 600; i++) traceSnap.push(buf[(ptr + i) % 600]);
      _crtTraceHistory[c].push(traceSnap);
      if (_crtTraceHistory[c].length > CRT_PERSISTENCE_FRAMES) _crtTraceHistory[c].shift();
    }

    // REF trace overlay
    if (scopeRefData[c]) {
      sctx.save();
      sctx.setLineDash([4, 4]);
      sctx.strokeStyle = 'rgba(200,200,200,0.3)';
      sctx.lineWidth = 1;
      sctx.beginPath();
      for (var i = 0; i < 600; i++) {
        var x = i / 600 * w, y = plotH / 2 - (scopeRefData[c][i] - mid) * yScale;
        if (i === 0) sctx.moveTo(x, y); else sctx.lineTo(x, Math.max(0, Math.min(plotH, y)));
      }
      sctx.stroke();
      sctx.restore();
    }

    // Save first active buffer for measurements
    if (!firstActiveBuf) { firstActiveBuf = buf; firstActivePtr = ptr; }
  }

  // X-Y mode (Lissajous)
  if (S.scope.mode === 'xy' && S.scope.ch[0].on && S.scope.ch[1].on) {
    var buf0 = S.scope.ch[0].buf, buf1 = S.scope.ch[1].buf, ptr = S.scope.ptr;
    sctx.strokeStyle = S.crtMode ? '#00ff41' : '#00e09e'; sctx.lineWidth = 1.5;
    sctx.shadowColor = sctx.strokeStyle; sctx.shadowBlur = 6;
    sctx.beginPath();
    for (var i = 0; i < 600; i++) {
      var vx = buf0[(ptr + i) % 600], vy = buf1[(ptr + i) % 600];
      var sx = w / 2 + vx * (w * 0.3) / (S.scope.ch[0].vDiv || 2);
      var sy = plotH / 2 - vy * (plotH * 0.3) / (S.scope.ch[1].vDiv || 2);
      if (i === 0) sctx.moveTo(sx, sy); else sctx.lineTo(sx, sy);
    }
    sctx.stroke(); sctx.shadowBlur = 0;
  }

  // Math channel (enhanced)
  if (S.scope.math && S.scope.ch[0].on && S.scope.ch[1].on) {
    var buf0 = S.scope.ch[0].buf, buf1 = S.scope.ch[1].buf, ptr = S.scope.ptr;
    // Compute math values and auto-scale
    var mathVals = [];
    for (var i = 0; i < 600; i++) {
      var v0 = buf0[(ptr + i) % 600], v1 = buf1[(ptr + i) % 600];
      var vm = 0;
      if (S.scope.math === 'add') vm = v0 + v1;
      else if (S.scope.math === 'sub') vm = v0 - v1;
      else if (S.scope.math === 'mul') vm = v0 * v1;
      else if (S.scope.math === 'dvdt' && i > 0) vm = (v0 - buf0[(ptr + i - 1) % 600]) / (S.scope.tDiv * 10 / 600);
      mathVals.push(vm);
    }
    var mathMin = Infinity, mathMax = -Infinity;
    for (var i = 0; i < mathVals.length; i++) { if (mathVals[i] < mathMin) mathMin = mathVals[i]; if (mathVals[i] > mathMax) mathMax = mathVals[i]; }
    var mathRange = Math.max(mathMax - mathMin, 0.01);
    var mathMid = (mathMax + mathMin) / 2;
    var mathYScale = (plotH * 0.7) / mathRange;

    sctx.strokeStyle = '#ffffff'; sctx.lineWidth = 1; sctx.globalAlpha = 0.7;
    sctx.setLineDash([4, 3]);
    sctx.beginPath();
    for (var i = 0; i < 600; i++) {
      var x = i / 600 * w, y = plotH / 2 - (mathVals[i] - mathMid) * mathYScale;
      if (i === 0) sctx.moveTo(x, y); else sctx.lineTo(x, Math.max(0, Math.min(plotH, y)));
    }
    sctx.stroke(); sctx.setLineDash([]); sctx.globalAlpha = 1;

    // Math legend
    sctx.font = '600 9px "JetBrains Mono"'; sctx.fillStyle = 'rgba(255,255,255,0.5)';
    var mathLabel = 'MATH:' + S.scope.math.toUpperCase();
    sctx.fillText(mathLabel, w - sctx.measureText(mathLabel).width - 8, 12);
  }

  // Cursors (enhanced with dragging + ΔV)
  if (S.scope.cursors) {
    var cx1 = S.scope.cx1, cx2 = S.scope.cx2;
    sctx.strokeStyle = '#eab308'; sctx.lineWidth = 1; sctx.setLineDash([3, 3]);
    sctx.beginPath(); sctx.moveTo(cx1, 0); sctx.lineTo(cx1, plotH); sctx.stroke();
    sctx.beginPath(); sctx.moveTo(cx2, 0); sctx.lineTo(cx2, plotH); sctx.stroke();
    sctx.setLineDash([]);

    // Cursor handle triangles
    sctx.fillStyle = '#eab308';
    sctx.beginPath(); sctx.moveTo(cx1, 0); sctx.lineTo(cx1 - 5, -8); sctx.lineTo(cx1 + 5, -8); sctx.fill();
    sctx.beginPath(); sctx.moveTo(cx2, 0); sctx.lineTo(cx2 - 5, -8); sctx.lineTo(cx2 + 5, -8); sctx.fill();

    // Labels A/B
    sctx.font = '600 8px "JetBrains Mono"'; sctx.textAlign = 'center';
    sctx.fillText('A', cx1, plotH + 10);
    sctx.fillText('B', cx2, plotH + 10);

    // Compute ΔT and ΔV
    var samplesPerPx = 600 / w;
    var dt_cursor = Math.abs(cx2 - cx1) * samplesPerPx * SIM_DT * SUBSTEPS;
    var cursorInfo = 'A: ' + fmtVal(cx1 * samplesPerPx * SIM_DT * SUBSTEPS, 's') + '\n';
    cursorInfo += 'B: ' + fmtVal(cx2 * samplesPerPx * SIM_DT * SUBSTEPS, 's') + '\n';
    cursorInfo += '\u0394T: ' + fmtVal(dt_cursor, 's') + '\n';
    if (dt_cursor > 0) cursorInfo += '1/\u0394T: ' + fmtVal(1 / dt_cursor, 'Hz') + '\n';

    // ΔV for each active channel
    for (var c = 0; c < 4; c++) {
      if (!S.scope.ch[c].on) continue;
      var buf = S.scope.ch[c].buf, ptr = S.scope.ptr;
      var idx1 = Math.round(cx1 * samplesPerPx) % 600;
      var idx2 = Math.round(cx2 * samplesPerPx) % 600;
      var v1 = buf[(ptr + idx1) % 600], v2 = buf[(ptr + idx2) % 600];
      cursorInfo += '\u0394V(' + S.scope.ch[c].label + '): ' + fmtVal(Math.abs(v2 - v1), 'V') + '\n';

      // Draw intersection dots
      var traceColor = S.crtMode ? _crtPhosphorColors[c] : S.scope.ch[c].color;
      var vd = S.scope.ch[c].vDiv || 2;
      var yScale = (plotH / 8) / vd;
      sctx.fillStyle = traceColor;
      sctx.beginPath(); sctx.arc(cx1, plotH / 2 - v1 * yScale, 3, 0, Math.PI * 2); sctx.fill();
      sctx.beginPath(); sctx.arc(cx2, plotH / 2 - v2 * yScale, 3, 0, Math.PI * 2); sctx.fill();
    }

    // Update cursor info overlay
    var infoDiv = document.getElementById('scope-cursor-info');
    if (infoDiv) { infoDiv.style.display = 'block'; infoDiv.textContent = cursorInfo.trim(); }
  } else {
    var infoDiv = document.getElementById('scope-cursor-info');
    if (infoDiv) infoDiv.style.display = 'none';
  }

  // Channel labels
  for (var c = 0; c < 4; c++) {
    if (!S.scope.ch[c].on) continue;
    sctx.font = '600 10px "JetBrains Mono"';
    sctx.fillStyle = S.crtMode ? _crtPhosphorColors[c] : S.scope.ch[c].color;
    var lbl = S.scope.ch[c].label;
    // Add live voltage value
    var lastV = S.scope.ch[c].buf[(S.scope.ptr + 599) % 600];
    lbl += ' ' + fmtVal(lastV, 'V');
    sctx.fillText(lbl, 8, 14 + c * 14);
  }

  // REF legend
  for (var c = 0; c < 4; c++) {
    if (scopeRefData[c]) {
      sctx.font = '500 9px "JetBrains Mono"'; sctx.fillStyle = 'rgba(200,200,200,0.4)';
      sctx.fillText('REF:' + S.scope.ch[c].label, 8, 14 + 4 * 14 + c * 12);
    }
  }

  // Update measurement cards (enhanced - 4.3)
  if (firstActiveBuf) {
    var m = computeScopeMeasurements(firstActiveBuf, firstActivePtr, S.scope.tDiv);
    if (m) {
      var el;
      el = document.getElementById('sc-vpp'); if (el) el.textContent = fmtVal(m.vpp, 'V');
      el = document.getElementById('sc-vrms'); if (el) el.textContent = fmtVal(m.vrms, 'V');
      el = document.getElementById('sc-vmin'); if (el) el.textContent = fmtVal(m.vmin, 'V');
      el = document.getElementById('sc-vmax'); if (el) el.textContent = fmtVal(m.vmax, 'V');
      if (m.freq > 0) {
        el = document.getElementById('sc-freq'); if (el) el.textContent = fmtVal(m.freq, 'Hz');
        el = document.getElementById('sc-per'); if (el) el.textContent = fmtVal(m.period, 's');
      }
      el = document.getElementById('sc-duty'); if (el) el.textContent = m.duty.toFixed(1) + '%';
      el = document.getElementById('sc-rise'); if (el) el.textContent = m.riseTime > 0 ? fmtVal(m.riseTime, 's') : '\u2014';
      el = document.getElementById('sc-fall'); if (el) el.textContent = m.fallTime > 0 ? fmtVal(m.fallTime, 's') : '\u2014';
      el = document.getElementById('sc-thd'); if (el) el.textContent = m.thd > 0 ? m.thd.toFixed(1) + '%' : '\u2014';

      // Phase between CH1 and CH2
      if (S.scope.ch[0].on && S.scope.ch[1].on && m.freq > 0) {
        var buf0 = S.scope.ch[0].buf, buf1 = S.scope.ch[1].buf, ptr = S.scope.ptr;
        var vavg0 = 0, vavg1 = 0;
        for (var i = 0; i < 600; i++) { vavg0 += buf0[(ptr + i) % 600]; vavg1 += buf1[(ptr + i) % 600]; }
        vavg0 /= 600; vavg1 /= 600;
        // Find first positive crossing for each channel
        var cross0 = -1, cross1 = -1;
        for (var i = 1; i < 600; i++) {
          if (cross0 < 0 && buf0[(ptr + i - 1) % 600] < vavg0 && buf0[(ptr + i) % 600] >= vavg0) cross0 = i;
          if (cross1 < 0 && buf1[(ptr + i - 1) % 600] < vavg1 && buf1[(ptr + i) % 600] >= vavg1) cross1 = i;
          if (cross0 >= 0 && cross1 >= 0) break;
        }
        if (cross0 >= 0 && cross1 >= 0 && m.freq > 0) {
          var dtPhase = (cross1 - cross0) * S.scope.tDiv * 10 / 600;
          var phaseDeg = dtPhase * m.freq * 360;
          // Normalize to -180..+180
          while (phaseDeg > 180) phaseDeg -= 360;
          while (phaseDeg < -180) phaseDeg += 360;
          el = document.getElementById('sc-phase'); if (el) el.textContent = phaseDeg.toFixed(1) + '\u00b0';
        }
      }

      // Pavg (average power for probe channels)
      el = document.getElementById('sc-pavg'); if (el) el.textContent = fmtVal(m.vavg, 'V');
    }
  }
}
