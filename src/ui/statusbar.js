// ──────── 5.5: STATUSBAR ENHANCEMENT ────────
function updateStatusbarExtra() {
  var tempEl = document.getElementById('sb-temp');
  var extraEl = document.getElementById('sb-extra');
  var engineEl = document.getElementById('sb-engine');
  if (!tempEl || !extraEl) return;
  // Max temperature
  var maxT = 0;
  if (S.sim.running) {
    S.parts.forEach(function(p) {
      if (p._thermal && p._thermal.T > maxT) maxT = p._thermal.T;
    });
  }
  tempEl.textContent = maxT > 0 ? '🌡' + maxT.toFixed(0) + '°C' : '';
  // Engine info (6.7)
  if (engineEl) {
    if (S.sim.running && VXA.SimV2) {
      var nrIter = VXA.SimV2.getNRIter();
      var maxNR = S.maxNRIter || 30;
      var dt = S._simDt || VXA.AdaptiveStep.getDt();
      var nodes = VXA.SimV2.getNodeCount();
      var bw = VXA.SimV2.getBandwidth ? VXA.SimV2.getBandwidth() : 0;
      var method = VXA.SimV2.getSimMethod ? VXA.SimV2.getSimMethod() : 'be';
      var dtStr = dt >= 1e-3 ? (dt * 1e3).toFixed(1) + 'ms' : dt >= 1e-6 ? (dt * 1e6).toFixed(1) + 'µs' : (dt * 1e9).toFixed(0) + 'ns';
      var info = 'N-R:' + nrIter + '/' + maxNR + ' dt=' + dtStr + '\u2192' + method.toUpperCase() + ' ' + nodes + 'n';
      if (bw > 0) info += ' bw=' + bw;
      engineEl.textContent = info;
    } else {
      engineEl.textContent = '';
    }
  }
  // Extra indicators
  var extra = '';
  extra += S.soundOn ? '🔊' : '🔇';
  extra += ' ' + (S.realisticMode ? '🛡️' : '🎓');
  if (S.particles.length > 0) extra += ' ✨' + S.particles.length;
  // TimeMachine status
  if (VXA.TimeMachine && VXA.TimeMachine.isEnabled()) {
    var tmStats = VXA.TimeMachine.getStats();
    extra += ' \u23EA' + tmStats.count;
    if (VXA.TimeMachine.isPlayback()) extra += ' \uD83D\uDCCD PLAYBACK';
  }
  // Sprint 12: Spatial Audio hum count
  if (VXA.SpatialAudio && S.soundOn) {
    var humCount = VXA.SpatialAudio.getActiveHumCount();
    if (humCount > 0) extra += ' \uD83D\uDD0A' + humCount + ' hum';
  }
  extraEl.textContent = extra;
}

// Patch render to call statusbar update
var _origRender = render;
render = function() {
  _origRender();
  updateStatusbarExtra();
};
