#!/usr/bin/env node
/**
 * VoltXAmpere Build Script — Concatenates modular src/ files into single dist/index.html
 * Pure Node.js — no external dependencies needed.
 *
 * Usage:
 *   node build.js          — development build
 *   node build.js --watch  — rebuild on file changes (future)
 */

const fs = require('fs');
const path = require('path');

// ══════════════════════════════════════════════════
// JS file order — DEPENDENCY ORDER IS CRITICAL
// ══════════════════════════════════════════════════
const JS_FILES = [
  // Core: namespace, config, eventbus, state
  'src/core/namespace.js',

  // i18n
  'src/core/i18n.js',

  // Component definitions (COMP, gates)
  'src/components/definitions.js',

  // Presets
  'src/components/presets.js',

  // Canvas setup, coords, pins
  'src/interaction/canvas-setup.js',

  // Undo/redo
  'src/interaction/history.js',

  // Helpers: format, names, mode, selection
  'src/interaction/helpers.js',

  // Basic context menu
  'src/ui/context-menu-basic.js',

  // Clipboard
  'src/interaction/clipboard.js',

  // Basic inspector (will be overridden)
  'src/ui/inspector-basic.js',

  // Mouse events
  'src/interaction/mouse.js',

  // Keyboard events
  'src/interaction/keyboard.js',

  // Drawing functions
  'src/components/drawing.js',

  // Scope controls
  'src/ui/scope-controls.js',

  // A11y + PWA sprint 10
  'src/ui/a11y-pwa.js',

  // Engine: benchmark
  'src/engine/benchmark.js',

  // Engine: validation (Sprint 13)
  'src/engine/validation.js',

  // Engine: sparse solver
  'src/engine/sparse.js',

  // Engine: voltage limiting
  'src/engine/voltage-limit.js',

  // Engine: MNA stamps
  'src/engine/stamps.js',

  // Engine: adaptive step
  'src/engine/adaptive.js',

  // Engine: SimV2 solver
  'src/engine/sim.js',

  // Models: SPICE models
  'src/models/models.js',

  // Engine: enhanced stamps (diode_spice, bjt_gp, nmos_spice)
  'src/engine/stamps-enhanced.js',

  // Models: SPICE parser
  'src/models/spice-parser.js',

  // Engine: legacy MNA sim
  'src/engine/sim-legacy.js',

  // UI: render loop
  'src/ui/render-loop.js',

  // IO: export/import JSON
  'src/io/export-import.js',

  // IO: URL sharing
  'src/io/share.js',

  // UI: gallery
  'src/ui/gallery.js',

  // UI: tutorials basic
  'src/ui/tutorials-basic.js',

  // Touch support
  'src/interaction/touch.js',

  // UI: tab switching
  'src/ui/tabs.js',

  // UI: DC sweep
  'src/ui/dc-sweep.js',

  // Engine: AC analysis
  'src/engine/ac-analysis.js',

  // Engine: noise analysis
  'src/engine/noise-analysis.js',

  // Engine: sensitivity
  'src/engine/sensitivity.js',

  // UI: graph engine
  'src/ui/graph.js',

  // IO: blocks (subcircuits)
  'src/io/blocks.js',

  // Models: SPICE import
  'src/models/spice-import.js',

  // Models: SPICE export
  'src/models/spice-export.js',

  // UI: net labels
  'src/ui/net-labels.js',

  // UI: Bode plot
  'src/ui/bode.js',

  // UI: param sweep
  'src/ui/param-sweep.js',

  // UI: FFT
  'src/ui/fft.js',

  // UI: Monte Carlo
  'src/ui/monte-carlo.js',

  // UI: temp sweep
  'src/ui/temp-sweep.js',

  // UI: noise runner
  'src/ui/noise-ui.js',

  // UI: sensitivity runner
  'src/ui/sensitivity-ui.js',

  // UI: worst case
  'src/ui/worst-case.js',

  // IO: SVG export
  'src/io/svg-export.js',

  // IO: CSV export
  'src/io/csv-export.js',

  // IO: PWA
  'src/io/pwa.js',

  // Core: startup (DOMContentLoaded, buildLeftPanel, loadPreset, API)
  'src/core/startup.js',

  // IO: autosave
  'src/io/autosave.js',

  // FX: particles
  'src/fx/particles.js',

  // FX: thermal
  'src/fx/thermal.js',

  // FX: damage
  'src/fx/damage.js',

  // UI: inline edit
  'src/ui/inline-edit.js',

  // UI: settings
  'src/ui/settings.js',

  // UI: smart context menu + quick start
  'src/ui/context-menu-smart.js',

  // UI: enhanced inspector (overrides basic)
  'src/ui/inspector-enhanced.js',

  // UI: extras (fitToScreen, patches, handlers)
  'src/ui/ui-extras.js',

  // UI: CRT + cursor + measurements + ref
  'src/ui/crt.js',

  // FX: sound
  'src/fx/sound.js',

  // UI: scope extras (preview, channel mgmt, export, tooltip)
  'src/ui/scope-extras.js',

  // UI: enhanced drawScope (overrides basic)
  'src/ui/scope-enhanced.js',

  // UI: sound triggers
  'src/ui/sound-triggers.js',

  // UI: interactive tutorials
  'src/ui/tutorials.js',

  // Components: encyclopedia
  'src/components/encyclopedia.js',

  // UI: statusbar
  'src/ui/statusbar.js',

  // UI: welcome
  'src/ui/welcome.js',

  // UI: about + validation UI
  'src/ui/about.js',

  // App: final init (loop, a11y, keyboard patches)
  'src/app.js',
];

function build() {
  const startTime = Date.now();

  // 1. Read CSS
  const css = fs.readFileSync('src/styles.css', 'utf8');

  // 2. Concatenate JS files
  let jsBundle = '';
  let totalJsLines = 0;
  let missingFiles = [];

  for (const file of JS_FILES) {
    if (!fs.existsSync(file)) {
      missingFiles.push(file);
      continue;
    }
    const content = fs.readFileSync(file, 'utf8');
    const lineCount = content.split('\n').length;
    totalJsLines += lineCount;
    jsBundle += `\n// ═══ ${path.basename(file)} ═══\n${content}\n`;
  }

  if (missingFiles.length > 0) {
    console.error('❌ Missing files:');
    missingFiles.forEach(f => console.error(`   ${f}`));
    process.exit(1);
  }

  // 3. Read HTML template
  let html = fs.readFileSync('src/index.html', 'utf8');

  // 4. Inline CSS and JS
  html = html.replace('/* __CSS_PLACEHOLDER__ */', css);
  html = html.replace('/* __JS_PLACEHOLDER__ */', jsBundle);

  // 5. Write dist/index.html
  fs.mkdirSync('dist', { recursive: true });
  fs.writeFileSync('dist/index.html', html);

  const distLines = html.split('\n').length;
  const distSize = (fs.statSync('dist/index.html').size / 1024).toFixed(0);
  const elapsed = Date.now() - startTime;

  console.log(`\n⚡ VoltXAmpere Build Complete`);
  console.log(`   JS modules:  ${JS_FILES.length} files`);
  console.log(`   JS lines:    ${totalJsLines}`);
  console.log(`   CSS lines:   ${css.split('\n').length}`);
  console.log(`   Total lines: ${distLines}`);
  console.log(`   Output:      dist/index.html (${distSize} KB)`);
  console.log(`   Time:        ${elapsed}ms`);
}

build();
