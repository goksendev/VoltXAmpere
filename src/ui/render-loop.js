// ──────── RENDER LOOP ────────
function isInViewport(part) {
  var sx = part.x * S.view.zoom + S.view.ox;
  var sy = part.y * S.view.zoom + S.view.oy;
  var cw = cvs.width / DPR, ch = cvs.height / DPR;
  return sx > -120 && sx < cw + 120 && sy > -120 && sy < ch + 120;
}

function render() {
  const w = cvs.width / DPR, h = cvs.height / DPR;
  ctx.clearRect(0, 0, w, h);
  if (S.showGrid) drawGrid();
  else { ctx.fillStyle = '#06080c'; ctx.fillRect(0, 0, w, h); }
  if (typeof drawEmptyCanvasHint === 'function') drawEmptyCanvasHint(ctx, w, h);

  ctx.save();
  ctx.translate(S.view.ox, S.view.oy); ctx.scale(S.view.zoom, S.view.zoom);

  S.wires.forEach(drawWire);
  drawWirePreview();

  // Junction points (where 3+ wires meet)
  var junctions = {};
  S.wires.forEach(function(w) {
    [w.x1+','+w.y1, w.x2+','+w.y2].forEach(function(k) {
      junctions[k] = (junctions[k]||0) + 1;
    });
  });
  for (var jk in junctions) {
    if (junctions[jk] >= 3) {
      var jp = jk.split(',');
      ctx.fillStyle = '#00e09e';
      ctx.beginPath(); ctx.arc(parseFloat(jp[0]), parseFloat(jp[1]), 4, 0, Math.PI*2); ctx.fill();
    }
  }

  S.parts.forEach(function(p) { if (isInViewport(p)) drawPart(p); });
  drawGhostPreview();
  drawSelBox();
  drawSnapGlow();
  drawVoltageMap();

  // Sprint 14: Flash effects (world coords)
  if (typeof drawFlashEffects === 'function') drawFlashEffects(ctx);

  // Sprint 14: Formula overlay on hovered part
  if (S.hovered && !S.drag.active && S.mode !== 'wire' && S.mode !== 'place' && typeof drawFormulaOverlay === 'function') {
    drawFormulaOverlay(ctx, S.hovered);
  } else if (!S.hovered) {
    _formulaLastHoveredId = null;
  }

  // Sprint 14: Probe drawing
  if (VXA.Probes && VXA.Probes.isActive()) {
    VXA.Probes.draw(ctx);
  }

  // Sprint 16: Error overlay on canvas
  if (typeof drawErrorOverlay === 'function') drawErrorOverlay(ctx);

  // Groups
  S.groups.forEach(function(g) {
    var gp = S.parts.filter(function(p){ return g.partIds.includes(p.id); });
    if (!gp.length) return;
    var gx = Math.min.apply(null,gp.map(function(p){return p.x;}))-30;
    var gy = Math.min.apply(null,gp.map(function(p){return p.y;}))-30;
    var gw = Math.max.apply(null,gp.map(function(p){return p.x;}))-gx+60;
    var gh = Math.max.apply(null,gp.map(function(p){return p.y;}))-gy+60;
    ctx.strokeStyle = 'rgba(236,72,153,0.4)'; ctx.lineWidth = 1; ctx.setLineDash([6,4]);
    ctx.strokeRect(gx, gy, gw, gh);
    ctx.setLineDash([]);
    ctx.font = '500 10px Outfit'; ctx.fillStyle = 'rgba(236,72,153,0.6)';
    ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
    ctx.fillText(g.name, gx+4, gy-2);
  });

  // Annotations
  S.annotations.forEach(function(a) {
    ctx.font = a.fontSize + 'px "Outfit"';
    ctx.fillStyle = a.color;
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText(a.text, a.x, a.y);
  });

  // Particles (world coords, drawn before ctx.restore)
  if (VXA.Particles.count() > 0) {
    VXA.Particles.update(1/60);
    VXA.Particles.draw(ctx);
  }

  ctx.restore();

  // simulation step (skip during TimeMachine playback)
  if (VXA.TimeMachine && VXA.TimeMachine.isPlayback()) {
    var _tmSnap = VXA.TimeMachine.getCurrentSnapshot();
    if (_tmSnap) {
      for (var _tmi = 0; _tmi < _tmSnap.c.length; _tmi++) {
        var _tmsc = _tmSnap.c[_tmi];
        var _tmp = S.parts.find(function(pp) { return pp.id === _tmsc.id; });
        if (_tmp) {
          _tmp._v = _tmsc.v; _tmp._i = _tmsc.i;
          _tmp.damaged = _tmsc.damaged;
          _tmp.ledBrightness = _tmsc.ledBrightness;
        }
      }
    }
  } else if (S.sim.running) {
    simulationStep();
  }
  drawScope();
  drawMinimap();

  // live measurements
  if (S.sim.running && S.sel.length) {
    const p = S.parts.find(pp => pp.id === S.sel[0]);
    if (p) {
      document.getElementById('m-v').textContent = fmtVal(p._v || 0, 'V');
      document.getElementById('m-i').textContent = fmtVal(p._i || 0, 'A');
      document.getElementById('m-p').textContent = fmtVal(p._p || 0, 'W');
    }
  }

  // FPS counter
  S._fc++;
  const now = performance.now();
  if (now - S._ft >= 1000) { S.fps = S._fc; S._fc = 0; S._ft = now; }

  // Statusbar + zoom level
  document.getElementById('sb-time').textContent = 't=' + (S.sim.t*1000).toFixed(3) + 'ms';
  document.getElementById('sb-fps').textContent = S.fps + ' fps';
  document.getElementById('sb-nodes').textContent = S.parts.length + ' parts \u00B7 ' + S.wires.length + ' wires';
  var zl = document.getElementById('zoom-level');
  if (zl) zl.textContent = Math.round(S.view.zoom * 100) + '%';
  if (S.sim.error) document.getElementById('sb-dt').textContent = S.sim.error;
  else document.getElementById('sb-dt').textContent = 'dt=10\u00B5s \u00B7 ' + S.wireStyle + ' \u00B7 ' + S.symbolStd + ' \u00B7 ' + (S.realisticMode ? '\uD83D\uDEE1\uFE0F' : '\uD83C\uDF93');
}

// (PRESETS moved before buildPalette — see above)

function loadPreset(id) {
  const pr = PRESETS.find(p => p.id === id);
  if (!pr) return;
  saveUndo();
  S.parts = []; S.wires = []; S.nextId = 1; S.sel = [];
  if (S.sim.running) toggleSim();
  pr.parts.forEach(p => {
    S.parts.push({ id: S.nextId++, type: p.type, name: nextName(p.type), x: p.x, y: p.y, rot: p.rot || 0, val: p.val, freq: p.freq || 0, flipH: false, flipV: false, closed: false });
  });
  pr.wires.forEach(w => S.wires.push({ x1: w.x1, y1: w.y1, x2: w.x2, y2: w.y2 }));
  // Center view on preset
  if (S.parts.length) {
    let mnx=Infinity,mny=Infinity,mxx=-Infinity,mxy=-Infinity;
    S.parts.forEach(p=>{mnx=Math.min(mnx,p.x-80);mny=Math.min(mny,p.y-80);mxx=Math.max(mxx,p.x+80);mxy=Math.max(mxy,p.y+80);});
    const cw=cvs.width/DPR, ch=cvs.height/DPR;
    S.view.zoom=Math.min(cw/(mxx-mnx),ch/(mxy-mny),3)*0.8;
    S.view.ox=cw/2-((mnx+mxx)/2)*S.view.zoom;
    S.view.oy=ch/2-((mny+mxy)/2)*S.view.zoom;
  }
  needsRender = true; updateInspector();
  showInfoCard(pr.name, pr.desc, pr.formula);
}

function _escHTML(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function showInfoCard(title, desc, formula) {
  title=_escHTML(title); desc=_escHTML(desc); formula=_escHTML(formula);
  let card = document.getElementById('info-card');
  if (!card) {
    card = document.createElement('div');
    card.id = 'info-card';
    card.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:var(--surface-2);border:1px solid var(--border-2);border-radius:12px;padding:20px 28px;z-index:100;max-width:360px;text-align:center;box-shadow:0 12px 40px rgba(0,0,0,.6)';
    document.body.appendChild(card);
  }
  card.innerHTML = `<div style="font:600 16px var(--font-ui);color:var(--accent);margin-bottom:8px">${title}</div><div style="font:13px var(--font-ui);color:var(--text-2);margin-bottom:6px">${desc}</div><div style="font:500 13px var(--font-mono);color:var(--orange);margin-bottom:12px">${formula}</div><button style="padding:4px 16px;border-radius:6px;background:var(--surface-3);color:var(--text);border:1px solid var(--border);cursor:pointer;font:12px var(--font-ui)" onclick="this.parentElement.style.display='none'">Kapat</button>`;
  card.style.display = 'block';
  setTimeout(() => { if (card) card.style.display = 'none'; }, 5000);
}
