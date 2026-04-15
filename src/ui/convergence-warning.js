// ──────── SPRINT 49: Convergence Warning Strip ────────
// Floating status-bar strip at the bottom-right. Opens a showInfoCard-style
// overlay with diagnose() output when clicked. Injected lazily so main
// layout / existing status bar is untouched.

(function() {
  'use strict';
  if (typeof document === 'undefined') return;

  var stripEl = null;

  function ensureStrip() {
    if (stripEl) return stripEl;
    stripEl = document.createElement('div');
    stripEl.id = 'convergence-warning';
    stripEl.style.cssText = 'position:fixed;bottom:56px;right:12px;z-index:950;' +
      'padding:6px 10px;border-radius:4px;' +
      'background:#f59e0b;color:#111;font:600 11px var(--font-ui,sans-serif);' +
      'cursor:pointer;display:none;box-shadow:0 2px 8px rgba(0,0,0,0.3)';
    stripEl.textContent = '⚠ Yakınsama sorunu';
    stripEl.onclick = function() { showConvergenceDetail(); };
    document.body.appendChild(stripEl);
    return stripEl;
  }

  function showWarning(message) {
    ensureStrip();
    stripEl.textContent = '⚠ ' + (message || 'Yakınsama sorunu');
    stripEl.style.display = 'block';
  }

  function hideWarning() {
    if (stripEl) stripEl.style.display = 'none';
  }

  function showConvergenceDetail() {
    var diag = (VXA.Convergence && VXA.Convergence.getLastDiagnostic)
      ? VXA.Convergence.getLastDiagnostic() : null;
    if (!diag) {
      if (typeof showInfoCard === 'function') {
        showInfoCard('Yakınsama', 'Diagnostik bilgi mevcut değil.', '');
      }
      return;
    }
    var msg = '';
    if (diag.method) msg += 'Yöntem: ' + diag.method + '. ';
    if (diag.worstNode != null) {
      msg += 'En sorunlu düğüm: Node ' + diag.worstNode +
             ' (ΔV=' + (diag.worstDiff || 0).toFixed(3) + ').';
    }
    if (diag.suggestions && diag.suggestions.length) {
      msg += ' Öneri: ' + diag.suggestions[0];
    }
    if (typeof showInfoCard === 'function') {
      showInfoCard('DC Operating Point', msg || 'Detay yok.', '');
    } else if (typeof alert === 'function') {
      alert(msg || 'Detay yok.');
    }
  }

  window.vxaConvergenceWarn = showWarning;
  window.vxaConvergenceClear = hideWarning;
  window.vxaConvergenceDetail = showConvergenceDetail;

  // Periodic poll: if VXA.Convergence.getLastDiagnostic says not converged, show.
  setInterval(function() {
    if (typeof VXA === 'undefined' || !VXA.Convergence) return;
    var diag = VXA.Convergence.getLastDiagnostic && VXA.Convergence.getLastDiagnostic();
    if (diag && diag.success === false) showWarning('DC OP bulunamadı — detay');
    else if (diag && diag.success === true) hideWarning();
  }, 1000);
})();
