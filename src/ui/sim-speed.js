// ──────── SPRINT 37: SIMULATION SPEED CONTROL ────────
// Allows user to control simulation speed (0.5x, 1x, 2x, 5x)
// Keyboard: [ slows down, ] speeds up
// Status bar shows current speed

(function() {
  var SPEEDS = [0.5, 1, 2, 5];
  S.simSpeed = 1; // default 1x

  function setSimSpeed(speed) {
    S.simSpeed = speed;
    var ind = document.getElementById('sb-sim-speed');
    if (ind) ind.textContent = speed + 'x';
    if (typeof showInfoCard === 'function') {
      var tr = (typeof currentLang !== 'undefined' && currentLang === 'tr');
      showInfoCard((tr ? 'Sim\u00fclasyon h\u0131z\u0131: ' : 'Sim speed: ') + speed + 'x', '', '');
    }
  }

  function bumpSpeed(delta) {
    var idx = SPEEDS.indexOf(S.simSpeed);
    if (idx < 0) idx = 1;
    idx = Math.max(0, Math.min(SPEEDS.length - 1, idx + delta));
    setSimSpeed(SPEEDS[idx]);
  }

  // Wrap simulationStep to apply speed multiplier
  // Sprint 38c: expose original on window so audits can introspect the real source
  if (typeof simulationStep === 'function') {
    var _origSimStep = simulationStep;
    window._origSimStep = _origSimStep; // for cross-sprint integration tests
    simulationStep = function() {
      var sp = S.simSpeed || 1;
      if (sp >= 1) {
        for (var i = 0; i < sp; i++) _origSimStep();
      } else {
        // slower: skip frames
        S._simSpeedAccum = (S._simSpeedAccum || 0) + sp;
        if (S._simSpeedAccum >= 1) {
          S._simSpeedAccum -= 1;
          _origSimStep();
        }
      }
    };
  }

  // Keyboard hooks: [ = slower, ] = faster
  document.addEventListener('keydown', function(e) {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if (e.key === '[') { e.preventDefault(); bumpSpeed(-1); }
    else if (e.key === ']') { e.preventDefault(); bumpSpeed(1); }
  });

  // Add status bar indicator (status bar exists with sb-fps etc.)
  function injectIndicator() {
    var bar = document.getElementById('sb-fps') || document.getElementById('statusbar') || document.querySelector('.status');
    if (!bar) return;
    if (document.getElementById('sb-sim-speed')) return;
    var span = document.createElement('span');
    span.id = 'sb-sim-speed';
    span.style.cssText = 'margin-left:8px;color:var(--accent);font:600 11px var(--font-mono)';
    span.textContent = '1x';
    span.title = 'Sim\u00fclasyon h\u0131z\u0131 ([ = yava\u015flat, ] = h\u0131zland\u0131r)';
    span.onclick = function() { bumpSpeed(1); };
    span.style.cursor = 'pointer';
    if (bar.parentNode) bar.parentNode.insertBefore(span, bar.nextSibling);
  }
  if (document.readyState === 'complete') injectIndicator();
  else window.addEventListener('load', injectIndicator);

  // Expose globally
  window.setSimSpeed = setSimSpeed;
  window.bumpSimSpeed = bumpSpeed;
  window.SIM_SPEEDS = SPEEDS;
})();
