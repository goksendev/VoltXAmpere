// ──────── SCOPE CONTROLS ────────
function toggleCh(idx, on) { S.scope.ch[idx].on = on; needsRender = true; }
function setTDiv(v) { S.scope.tDiv = parseFloat(v); needsRender = true; }
function setVDiv(v) {
  const vd = parseFloat(v);
  S.scope.ch.forEach(ch => { if(ch.on) ch.vDiv = vd; });
  needsRender = true;
}
function setTrigMode(v) { S.scope.trigger.mode = v; needsRender = true; }
function setTrigEdge(v) { S.scope.trigger.edge = v; needsRender = true; }
function toggleScopeMode(mode) { S.scope.mode = S.scope.mode === mode ? 'yt' : mode; needsRender = true; }
function toggleCursors() { S.scope.cursors = !S.scope.cursors; needsRender = true; }

function assignProbe(partId) {
  for (let c = 0; c < 4; c++) {
    if (S.scope.ch[c].src === null || !S.scope.ch[c].on) {
      S.scope.ch[c].src = partId;
      S.scope.ch[c].on = true;
      const checks = document.querySelectorAll('.sc-ch input');
      if (checks[c]) checks[c].checked = true;
      needsRender = true;
      return c;
    }
  }
  S.scope.ch[3].src = partId;
  S.scope.ch[3].on = true;
  needsRender = true;
  return 3;
}

function ctxProbe() {
  hideCtx();
  if (!S.sel.length) return;
  assignProbe(S.sel[0]);
}
