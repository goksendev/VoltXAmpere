// ──────── PRESETS ────────
// Sprint 104 — Great Reset. PRESETS is empty until each component earns
// its feature-test slot under src/test-spice/feature-tests/.
var PRESETS = [];

// Sprint 104.1 — the legacy buildPalette IIFE was removed. It rendered
// into #left directly (outside #comp-panel-body), and every later call
// to rebuildPalette (from setLanguage, save-block, search-clear) left
// the IIFE's output in place — producing a visible duplicate component
// list. rebuildPalette() is now the single source of truth and is
// invoked at page ready via the initial call below.
if (typeof rebuildPalette === 'function') {
  // Fire once the DOM + rebuildPalette are both defined. rebuildPalette
  // is declared later in the bundled startup.js; we defer one tick so
  // the order of concatenation doesn't matter.
  setTimeout(function() { try { rebuildPalette(); } catch (e) {} }, 0);
} else if (typeof window !== 'undefined') {
  window.addEventListener('load', function() {
    if (typeof rebuildPalette === 'function') {
      try { rebuildPalette(); } catch (e) {}
    }
  });
}
