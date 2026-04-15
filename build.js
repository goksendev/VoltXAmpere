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
  'src/components/preset-meta.js',

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

  // Engine: BSIM3v3 MOSFET (Sprint 41 — v9.0)
  // Loaded BEFORE spice-parser so the parser can mark BSIM3-class cards.
  'src/engine/bsim3.js',

  // Models: SPICE parser
  'src/models/spice-parser.js',

  // Models: subcircuit (.SUBCKT) — Sprint 38 (v9.0)
  'src/models/subcircuit.js',

  // Models: .LIB import + vendor library loader — Sprint 42 (v9.0)
  'src/models/lib-import.js',

  // Engine: parametric design (Sprint 39 — v9.0)
  'src/engine/params.js',
  'src/engine/step-analysis.js',
  'src/engine/measure.js',

  // Engine: .IC + PWL/EXP/SFFM sources (Sprint 40 — v9.0)
  'src/engine/initial-conditions.js',
  'src/engine/sources.js',

  // Engine: SimBridge (Sprint 43 — v9.0)
  // NOTE: sim-worker-body.js is embedded separately via VXA._workerCode;
  // it is NOT concatenated into the main bundle.
  'src/engine/sim-bridge.js',

  // Engine: SparseFast CSC+LU + Circuit serializer (Sprint 44 — v9.0)
  'src/engine/sparse-fast.js',
  'src/engine/circuit-serializer.js',

  // Engine: SpatialIndex quadtree (Sprint 45 — v9.0)
  'src/engine/spatial-index.js',

  // Engine: Behavioral source + Laplace (Sprint 47 — v9.0)
  'src/engine/behavioral.js',

  // Engine: Convergence Ultimate (pseudo-transient + 4-tier DC OP) — Sprint 48 (v9.0)
  'src/engine/convergence.js',

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

  // Engine: pole-zero analysis (Sprint 21)
  'src/engine/pole-zero.js',

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

  // IO: Netlist editor (Sprint 46 — v9.0)
  'src/io/netlist-editor.js',

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

  // FX: chaos monkey (Sprint 13)
  'src/fx/chaos-monkey.js',

  // FX: holographic UI (Sprint 14)
  'src/fx/holographic-ui.js',

  // Engine: digital simulation (Sprint 17)
  'src/engine/digital.js',

  // Engine: mixed-signal bridge (Sprint 18)
  'src/engine/mixed-signal.js',

  // AI: error detection (Sprint 16) — must load before ai-engine
  'src/ai/ai-errors.js',

  // AI: engine with tool use (Sprint 15)
  'src/ai/ai-engine.js',

  // FX: spatial audio (Sprint 12)
  'src/fx/spatial-audio.js',

  // Engine: Time Machine (Sprint 11)
  'src/engine/time-machine.js',

  // UI: inline edit
  'src/ui/inline-edit.js',

  // UI: settings
  'src/ui/settings.js',

  // UI: smart context menu + quick start
  'src/ui/context-menu-smart.js',

  // UI: enhanced inspector (overrides basic)
  'src/ui/inspector-enhanced.js',

  // Sprint 19: SPICE Import Modal + UX
  'src/ui/spice-modal.js',

  // UI: advanced analysis (Sprint 21: P-Z, Contour, H(s))
  'src/ui/advanced-analysis.js',

  // UI: Commands tab (.PARAM/.STEP/.MEAS) — Sprint 39 (v9.0)
  'src/ui/commands-tab.js',

  // UI: Inspector source-type + IC add-ons (Sprint 40 — v9.0)
  'src/ui/inspector-sources.js',

  // UI: Model Browser modal — Sprint 42 (v9.0)
  'src/ui/model-browser.js',

  // UI: Render optimization — LayerCache + LOD helper (Sprint 45 — v9.0)
  'src/ui/layer-cache.js',
  'src/ui/lod-render.js',

  // UI: Netlist panel (drawer + shortcut) — Sprint 46 (v9.0)
  'src/ui/netlist-panel.js',

  // UI: Waveform Viewer Pro + Convergence warning — Sprint 49 (v9.0)
  'src/ui/scope-pro.js',
  'src/ui/convergence-warning.js',

  // UI: breadboard 3D view
  'src/ui/breadboard.js',

  // UX extras: popup, probe dock, rulers
  'src/ui/ux-extras.js',

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
  'src/ui/tutorials-extended.js',
  'src/ui/sim-speed.js',

  // Components: encyclopedia
  'src/components/encyclopedia.js',

  // UI: statusbar
  'src/ui/statusbar.js',

  // UI: welcome
  'src/ui/welcome.js',

  // UI: about + validation UI
  'src/ui/about.js',

  // UI: Timeline bar (Sprint 11)
  'src/ui/timeline-bar.js',

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

  // Sprint 43: capture worker body text and expose as VXA._workerCode
  // NOTE: src/app.js ends with an inline </script> tag (legacy), so we cannot
  // append the worker-code assignment to the main bundle. Instead, inject a
  // separate <script> block right before </body>, using a safe JSON.stringify.
  const WORKER_BODY_PATH = 'src/engine/sim-worker-body.js';
  let workerCode = '';
  if (fs.existsSync(WORKER_BODY_PATH)) {
    workerCode = fs.readFileSync(WORKER_BODY_PATH, 'utf8');
  }
  // Guard: escape any </script in the payload to avoid HTML parser breakage
  const safeWorkerCode = JSON.stringify(workerCode).replace(/<\/script/gi, '<\\/script');
  const workerScriptBlock =
    '<script>\n// ═══ sim-worker-body.js (embedded for Web Worker) ═══\n' +
    'if (typeof VXA !== "undefined") { VXA._workerCode = ' + safeWorkerCode + '; }\n' +
    '</script>\n';

  // 4. Inline CSS, JS, and build timestamp
  html = html.replace('/* __CSS_PLACEHOLDER__ */', css);
  html = html.replace('/* __JS_PLACEHOLDER__ */', jsBundle);
  html = html.replace('__BUILD_TIME__', new Date().toISOString().slice(0, 16).replace('T', ' '));
  // Inject worker-code block before the final </body>. Use lastIndexOf to avoid
  // matching a literal '</body>' string inside JS (e.g. startup.js report template).
  const bodyIdx = html.lastIndexOf('</body>');
  if (bodyIdx >= 0) {
    html = html.slice(0, bodyIdx) + workerScriptBlock + html.slice(bodyIdx);
  }

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

  // Auto-copy to root index.html (for Vercel deploy)
  fs.copyFileSync('dist/index.html', 'index.html');
  console.log(`   Root index.html updated ✅`);
}

build();
