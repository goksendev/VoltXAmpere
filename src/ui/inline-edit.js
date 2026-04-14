// ──────── 3.1: INLINE VALUE EDIT ────────
var _inlineEditActive = false;
var _inlineEditPart = null;
var _inlineEditParam = null; // current param key

function _fmtEng(v) {
  if (v == null) return '0';
  var abs = Math.abs(v);
  if (abs >= 1e9) return (v / 1e9).toPrecision(3) + 'G';
  if (abs >= 1e6) return (v / 1e6).toPrecision(3) + 'M';
  if (abs >= 1e3) return (v / 1e3).toPrecision(3) + 'k';
  if (abs >= 1) return v.toPrecision(3);
  if (abs >= 1e-3) return (v * 1e3).toPrecision(3) + 'm';
  if (abs >= 1e-6) return (v * 1e6).toPrecision(3) + 'u';
  if (abs >= 1e-9) return (v * 1e9).toPrecision(3) + 'n';
  if (abs >= 1e-12) return (v * 1e12).toPrecision(3) + 'p';
  return v.toExponential(2);
}

var E12_SERIES = [1.0, 1.2, 1.5, 1.8, 2.2, 2.7, 3.3, 3.9, 4.7, 5.6, 6.8, 8.2];
var E24_SERIES = [1.0,1.1,1.2,1.3,1.5,1.6,1.8,2.0,2.2,2.4,2.7,3.0,3.3,3.6,3.9,4.3,4.7,5.1,5.6,6.2,6.8,7.5,8.2,9.1];

function getEditableParams(part) {
  var t = part.type, params = [];
  if (t === 'resistor') params.push({key:'val',label:'R',unit:'Ω',min:1,max:1e7});
  else if (t === 'capacitor') params.push({key:'val',label:'C',unit:'F',min:1e-12,max:0.01});
  else if (t === 'inductor') params.push({key:'val',label:'L',unit:'H',min:1e-6,max:10});
  else if (t === 'vdc') params.push({key:'val',label:'V',unit:'V',min:0.1,max:100});
  else if (t === 'vac') { params.push({key:'val',label:'V',unit:'V',min:0.1,max:100}); params.push({key:'freq',label:'f',unit:'Hz',min:1,max:1e7}); }
  else if (t === 'idc') params.push({key:'val',label:'I',unit:'A',min:1e-6,max:10});
  else if (t === 'pulse') { params.push({key:'val',label:'V2',unit:'V',min:0,max:100}); }
  else if (t === 'diode') params.push({key:'val',label:'Vf',unit:'V',min:0.1,max:5});
  else if (t === 'led') params.push({key:'val',label:'Vf',unit:'V',min:0.5,max:5});
  else if (t === 'zener') params.push({key:'val',label:'Vz',unit:'V',min:1,max:200});
  else if (t === 'npn' || t === 'pnp') params.push({key:'val',label:'β',unit:'',min:10,max:1000});
  else if (t === 'nmos' || t === 'pmos') params.push({key:'val',label:'Vth',unit:'V',min:0.1,max:10});
  else if (t === 'fuse') params.push({key:'val',label:'Imax',unit:'A',min:0.01,max:100});
  else if (t === 'opamp') params.push({key:'val',label:'Aol',unit:'',min:100,max:1e6});
  else if (t === 'regulator') params.push({key:'val',label:'Vout',unit:'V',min:0.5,max:50});
  else if (t === 'netLabel') params.push({key:'val',label:'Net',unit:'',min:0,max:0,text:true});
  else if (COMP[t] && COMP[t].unit) params.push({key:'val',label:COMP[t].en||t,unit:COMP[t].unit,min:0,max:1e6});
  return params;
}

function openInlineEdit(part, paramIdx) {
  var params = getEditableParams(part);
  if (!params.length) return;
  paramIdx = paramIdx || 0;
  if (paramIdx >= params.length) paramIdx = 0;
  var param = params[paramIdx];
  _inlineEditActive = true;
  _inlineEditPart = part;
  _inlineEditParam = param;

  var sc = w2s(part.x, part.y);
  var el = document.getElementById('inline-edit');
  var curVal = param.key === 'freq' ? (part.freq || 1000) : part.val;

  var logMin = Math.log10(Math.max(param.min, 1e-15));
  var logMax = Math.log10(Math.max(param.max, 1e-10));
  var logCur = Math.log10(Math.max(Math.abs(curVal), param.min));

  el.innerHTML = '<div class="ie-label">' + param.label + ' (' + (part.name || part.type) + ')</div>'
    + '<div class="ie-row">'
    + '<input class="ie-input" id="ie-val" value="' + _fmtEng(curVal) + '" autocomplete="off" spellcheck="false">'
    + '<span class="ie-unit">' + param.unit + '</span>'
    + '</div>'
    + '<input type="range" class="ie-slider" id="ie-slider" min="' + (logMin*100) + '" max="' + (logMax*100) + '" value="' + (logCur*100) + '" step="1">'
    + (params.length > 1 ? '<div style="font:10px var(--font-ui);color:var(--text-4);margin-top:2px;text-align:center">Tab: sonraki parametre</div>' : '');

  el.style.display = 'block';
  // Position: below part, clamped to viewport
  var x = sc.x - 90, y = sc.y + 30;
  x = Math.max(4, Math.min(window.innerWidth - 200, x));
  y = Math.max(4, Math.min(window.innerHeight - 100, y));
  el.style.left = x + 'px'; el.style.top = y + 'px';

  var inp = document.getElementById('ie-val');
  inp.focus(); inp.select();

  // Slider sync
  var slider = document.getElementById('ie-slider');
  slider.oninput = function() {
    var v = Math.pow(10, this.value / 100);
    inp.value = _fmtEng(v);
    _applyInlineVal(v);
  };

  inp.onkeydown = function(e) {
    if (e.key === 'Enter') { _commitInlineEdit(); e.preventDefault(); }
    else if (e.key === 'Escape') { closeInlineEdit(); e.preventDefault(); }
    else if (e.key === 'Tab') {
      e.preventDefault();
      _commitInlineEdit();
      openInlineEdit(part, (paramIdx + 1) % params.length);
    }
  };
  inp.onblur = function() {
    setTimeout(function() {
      if (_inlineEditActive && !document.getElementById('inline-edit').contains(document.activeElement)) {
        _commitInlineEdit();
      }
    }, 100);
  };
}

function _applyInlineVal(v) {
  if (!_inlineEditPart || !_inlineEditParam) return;
  if (_inlineEditParam.key === 'freq') _inlineEditPart.freq = v;
  else _inlineEditPart.val = v;
  needsRender = true;
  if (S.sim.running) buildCircuitFromCanvas();
}

function _commitInlineEdit() {
  if (!_inlineEditActive) return;
  var inp = document.getElementById('ie-val');
  if (inp) {
    saveUndo();
    var v = parseEngVal(inp.value);
    _applyInlineVal(v);
  }
  closeInlineEdit();
  updateInspector();
}

function closeInlineEdit() {
  _inlineEditActive = false; _inlineEditPart = null; _inlineEditParam = null;
  document.getElementById('inline-edit').style.display = 'none';
}

// Close inline edit on outside click
document.addEventListener('mousedown', function(e) {
  if (!_inlineEditActive) return;
  var ie = document.getElementById('inline-edit');
  if (!ie || ie.style.display === 'none') return;
  if (ie.contains(e.target)) return; // Click inside inline edit — ignore
  confirmInlineEdit();
});

// Scroll wheel E12 stepping on selected part
wrap.addEventListener('wheel', function(e) {
  if (!S.sel.length || e.ctrlKey && e.shiftKey) return; // let zoom handle Ctrl
  var p = S.parts.find(function(pp) { return pp.id === S.sel[0]; });
  if (!p || !COMP[p.type] || !COMP[p.type].unit) return;
  // Only when mouse is over the part area (not zooming)
  if (!S.hovered || S.hovered.id !== p.id) return;

  var series = e.shiftKey ? E24_SERIES : E12_SERIES;
  var cur = p.val;
  if (cur <= 0) return;

  if (e.ctrlKey || e.metaKey) {
    // 10x jump
    saveUndo();
    p.val = e.deltaY < 0 ? cur * 10 : cur / 10;
    p.val = Math.max(1e-12, Math.min(1e12, p.val));
    needsRender = true; updateInspector();
    if (S.sim.running) buildCircuitFromCanvas();
    e.preventDefault(); e.stopPropagation();
    return;
  }

  var exp = Math.floor(Math.log10(cur));
  var mantissa = cur / Math.pow(10, exp);
  // Find nearest in series
  var bestIdx = 0, bestDist = Infinity;
  for (var i = 0; i < series.length; i++) {
    var d = Math.abs(series[i] - mantissa);
    if (d < bestDist) { bestDist = d; bestIdx = i; }
  }
  saveUndo();
  if (e.deltaY < 0) {
    bestIdx++;
    if (bestIdx >= series.length) { bestIdx = 0; exp++; }
  } else {
    bestIdx--;
    if (bestIdx < 0) { bestIdx = series.length - 1; exp--; }
  }
  p.val = series[bestIdx] * Math.pow(10, exp);
  p.val = Math.max(1e-12, Math.min(1e12, p.val));
  needsRender = true; updateInspector();
  if (S.sim.running) buildCircuitFromCanvas();
  e.preventDefault(); e.stopPropagation();
}, { passive: false, capture: true });
