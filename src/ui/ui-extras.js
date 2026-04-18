// ──────── 3.7: FIT TO SCREEN ────────
function fitToScreen() {
  if (!S.parts.length) return;
  var mnx = Infinity, mny = Infinity, mxx = -Infinity, mxy = -Infinity;
  S.parts.forEach(function(p) { mnx = Math.min(mnx, p.x - 60); mny = Math.min(mny, p.y - 60); mxx = Math.max(mxx, p.x + 60); mxy = Math.max(mxy, p.y + 60); });
  var cw = cvs.width / DPR, ch = cvs.height / DPR;
  var bw = mxx - mnx, bh = mxy - mny;
  S.view.zoom = Math.max(0.1, Math.min(5, Math.min(cw / bw, ch / bh) * 0.9));
  S.view.ox = cw / 2 - (mnx + bw / 2) * S.view.zoom;
  S.view.oy = ch / 2 - (mny + bh / 2) * S.view.zoom;
  needsRender = true;
}

// ──────── 3.8: ENHANCED DUPLICATE ────────
// doDuplicate already exists — enhance to clear damage/thermal
var _origDoDuplicate = doDuplicate;
doDuplicate = function() {
  var beforeLen = S.parts.length;
  _origDoDuplicate();
  // Clear damage and thermal on duplicated parts
  for (var i = beforeLen; i < S.parts.length; i++) {
    var np = S.parts[i];
    delete np.damaged; delete np.damageResult; delete np.damageType; delete np.damageCause;
    delete np._thermal; delete np._explodeAnim; delete np._burnAnim;
  }
};

// ──────── 3.9: TOPBAR BUTTON HANDLERS ────────
function toggleRealisticBtn() {
  S.realisticMode = !S.realisticMode;
  needsRender = true;
  VXA.EventBus.emit('realisticModeChange', S.realisticMode);
  var btn = document.getElementById('btn-realistic');
  if (btn) btn.classList.toggle('active', S.realisticMode);
}

function cycleBgBtn() {
  var idx = _v6bgStyles.indexOf(S.bgStyle);
  S.bgStyle = _v6bgStyles[(idx + 1) % _v6bgStyles.length];
  needsRender = true;
  VXA.EventBus.emit('bgChange', S.bgStyle);
}

// ──────── 3.10: PATCH startPlace for recent tracking ────────
// Sprint 104.3.1 — tracking stays (context-menu Quick Add uses it), but the
// sidebar no longer surfaces a Recents section. Real recents UI = Sprint 104.8.
var _origStartPlace = startPlace;
startPlace = function(type) {
  _trackRecent(type);
  _origStartPlace(type);
};

// ──────── LOAD SETTINGS ON INIT ────────
loadSettingsFromStorage();

// ══════════════════════════════════════════════════════════════
// ██  SPRINT 4: PRO OSİLOSKOP + CRT + SES + DALGA FORMU      ██
// ══════════════════════════════════════════════════════════════
