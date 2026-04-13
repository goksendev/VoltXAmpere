// ──────── 4.6: SOURCE WAVEFORM PREVIEW ────────
function drawSourcePreview(part) {
  if (part.type !== 'acSource' && part.type !== 'pulse') return;
  if (getDetailLevel() === 'overview') return;
  // Only show when selected or sim running
  if (!S.sel.includes(part.id) && !S.sim.running) return;

  var px = part.x + 25, py = part.y - 25;
  var pw = 50, ph = 24;

  ctx.save();
  ctx.fillStyle = 'rgba(13,17,23,0.85)';
  ctx.strokeStyle = 'rgba(42,52,68,0.8)';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.roundRect(px, py, pw, ph, 3);
  ctx.fill(); ctx.stroke();

  ctx.strokeStyle = '#3fb950'; ctx.lineWidth = 1;
  ctx.beginPath();
  if (part.type === 'acSource') {
    for (var i = 0; i <= pw - 6; i++) {
      var x = px + 3 + i;
      var y = py + ph / 2 + Math.sin(i / (pw - 6) * 4 * Math.PI) * (ph / 2 - 4);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
  } else if (part.type === 'pulse') {
    var duty = 0.5;
    if (part.props && part.props.Ton && part.props.T) duty = part.props.Ton / part.props.T;
    var periods = 2, pWidth = (pw - 6) / periods;
    for (var p = 0; p < periods; p++) {
      var bx = px + 3 + p * pWidth;
      var highY = py + 4, lowY = py + ph - 4;
      if (p === 0 && duty === 0.5) ctx.moveTo(bx, lowY);
      ctx.lineTo(bx, lowY); ctx.lineTo(bx, highY);
      ctx.lineTo(bx + pWidth * duty, highY);
      ctx.lineTo(bx + pWidth * duty, lowY);
      ctx.lineTo(bx + pWidth, lowY);
    }
  }
  ctx.stroke();

  ctx.font = '6px "JetBrains Mono"';
  ctx.fillStyle = '#8b949e';
  ctx.textAlign = 'center';
  var label = '';
  if (part.type === 'acSource') {
    label = (part.val || 5) + 'V ' + _fmtEng(part.freq || 1000) + 'Hz';
  } else {
    var pv = part.props || {};
    label = (pv.V2 || part.val || 5) + 'V';
  }
  ctx.fillText(label, px + pw / 2, py + ph - 2);
  ctx.restore();
}

// ──────── 4.7: SCOPE CHANNEL MANAGEMENT (double-click solo) ────────
(function() {
  var chLabels = document.querySelectorAll('.sc-ch');
  chLabels.forEach(function(label, idx) {
    label.addEventListener('dblclick', function(e) {
      e.preventDefault();
      // Solo: turn off all except this one
      for (var c = 0; c < 4; c++) {
        S.scope.ch[c].on = (c === idx);
        var checks = document.querySelectorAll('.sc-ch input');
        if (checks[c]) checks[c].checked = (c === idx);
      }
      needsRender = true;
    });
  });
})();

// ──────── 4.8: SCOPE MATH IMPROVEMENT ────────
// (Math trace already exists in drawScope. We enhance it with auto V/div and legend — done in the new drawScope override below)

// ──────── 4.9: SCOPE EXPORT (CSV + PNG) ────────
function exportScopeCSV() {
  var lines = ['Time(s)'];
  var activeChs = [];
  for (var c = 0; c < 4; c++) {
    if (S.scope.ch[c].on) { lines[0] += ',CH' + (c + 1) + '(V)'; activeChs.push(c); }
  }
  if (activeChs.length === 0) return;
  var ptr = S.scope.ptr;
  var dtPerSample = S.scope.tDiv * 10 / 600;
  for (var i = 0; i < 600; i++) {
    var row = (i * dtPerSample).toFixed(9);
    for (var j = 0; j < activeChs.length; j++) {
      row += ',' + S.scope.ch[activeChs[j]].buf[(ptr + i) % 600].toFixed(6);
    }
    lines.push(row);
  }
  var blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'vxa_scope_' + Date.now() + '.csv';
  a.click();
}

function exportScopePNG() {
  var cvs = document.getElementById('SC');
  if (!cvs) return;
  var a = document.createElement('a');
  a.href = cvs.toDataURL('image/png');
  a.download = 'vxa_scope_' + Date.now() + '.png';
  a.click();
}

// ──────── 4.10: ANALYSIS TOOLTIP SYSTEM ────────
var _analysisTooltip = null;

function _showAnalysisTooltip(canvasEl, e, xVal, yVal, xUnit, yUnit) {
  if (!_analysisTooltip) {
    _analysisTooltip = document.createElement('div');
    _analysisTooltip.className = 'analysis-tooltip';
    document.body.appendChild(_analysisTooltip);
  }
  _analysisTooltip.style.display = 'block';
  _analysisTooltip.style.left = (e.clientX + 12) + 'px';
  _analysisTooltip.style.top = (e.clientY - 30) + 'px';
  _analysisTooltip.innerHTML = '<span style="color:var(--accent)">' + fmtVal(xVal, xUnit) + '</span> · <span style="color:var(--blue)">' + fmtVal(yVal, yUnit) + '</span>';
}

function _hideAnalysisTooltip() {
  if (_analysisTooltip) _analysisTooltip.style.display = 'none';
}

// Attach tooltip to Bode canvas
(function() {
  var bodeCanvas = document.getElementById('BODE');
  if (bodeCanvas) {
    bodeCanvas.addEventListener('mousemove', function(e) {
      if (!bodeData || !bodeData.f.length) return;
      var rect = bodeCanvas.getBoundingClientRect();
      var mx = e.clientX - rect.left;
      var w = rect.width, mx0 = 55, pw = w - mx0 - 20;
      if (mx < mx0 || mx > mx0 + pw) { _hideAnalysisTooltip(); return; }
      var ratio = (mx - mx0) / pw;
      var idx = Math.round(ratio * (bodeData.f.length - 1));
      idx = Math.max(0, Math.min(bodeData.f.length - 1, idx));
      _showAnalysisTooltip(bodeCanvas, e, bodeData.f[idx], bodeData.mag[idx], 'Hz', 'dB');
    });
    bodeCanvas.addEventListener('mouseleave', _hideAnalysisTooltip);
  }
})();
