#!/usr/bin/env node
/**
 * VoltXAmpere Sprint 16 — Split index.html into modular files
 * This script reads the monolithic index.html and extracts sections into src/ files.
 * Run once: node split.js
 */

const fs = require('fs');
const path = require('path');

const lines = fs.readFileSync('index.html', 'utf8').split('\n');

function extract(startLine, endLine) {
  // Lines are 1-indexed in our map
  return lines.slice(startLine - 1, endLine).join('\n');
}

function write(filePath, content) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content);
  console.log(`  ✅ ${filePath} (${content.split('\n').length} lines)`);
}

console.log('🔧 VoltXAmpere Sprint 16 — Splitting index.html into modules...\n');

// ══════════════════════════════════════════════════
// 1. CSS (lines 29-366)
// ══════════════════════════════════════════════════
write('src/styles.css', extract(29, 366));

// ══════════════════════════════════════════════════
// 2. HTML template — head + body structure (no CSS/JS content)
// ══════════════════════════════════════════════════
const htmlHead = extract(1, 27); // meta tags (before <style>)
const htmlBody = extract(369, 722); // <body> through shortcuts modal + noscript
const htmlAiFab = extract(10429, 10450); // AI FAB + panel HTML
const htmlSplashScript = extract(10451, 10459); // splash failsafe script
const htmlBomModal = extract(10460, 10469); // BOM modal
const htmlEnd = '</body>\n</html>';

const htmlTemplate = `${htmlHead}
<style>
/* __CSS_PLACEHOLDER__ */
</style>
</head>
${htmlBody}

${htmlAiFab}
<!-- Splash failsafe: SEPARATE script so it runs even if main script has errors -->
${htmlSplashScript}
${htmlBomModal}

<script>
/* __JS_PLACEHOLDER__ */
</script>
${htmlEnd}
`;
write('src/index.html', htmlTemplate);

// ══════════════════════════════════════════════════
// 3. JavaScript modules
// ══════════════════════════════════════════════════

// --- CORE ---

// namespace.js: VXA namespace + Config + EventBus + State + globals
write('src/core/namespace.js', extract(725, 826));

// i18n.js: STR object + t() + setLanguage + update*Labels
write('src/core/i18n.js', extract(828, 1059));

// --- COMPONENTS ---

// definitions.js: gate helper + COMP definitions
write('src/components/definitions.js', extract(1060, 1861));

// presets.js: PRESETS array
write('src/components/presets.js', extract(1863, 2108));

// --- INTERACTION ---

// canvas-setup.js: canvas refs, resize, coord transforms, pin helpers
write('src/interaction/canvas-setup.js', extract(2110, 2155));

// history.js: undo/redo
write('src/interaction/history.js', extract(2156, 2174));

// helpers.js: fmtVal, nextName, mode actions, selection actions
write('src/interaction/helpers.js', extract(2175, 2249));

// context-menu.js: basic context menu functions
write('src/ui/context-menu-basic.js', extract(2250, 2264));

// clipboard.js: copy/paste/duplicate
write('src/interaction/clipboard.js', extract(2265, 2293));

// inspector-basic.js: basic inspector (will be overridden later)
write('src/ui/inspector-basic.js', extract(2294, 2431));

// mouse.js: mouse events
write('src/interaction/mouse.js', extract(2432, 2597));

// keyboard.js: keyboard events
write('src/interaction/keyboard.js', extract(2598, 2666));

// --- COMPONENTS (drawing) ---

// drawing.js: all draw functions (drawPart, drawWire, drawGrid, drawBackground, drawScope basic, etc.)
write('src/components/drawing.js', extract(2667, 3444));

// scope-controls.js: scope control functions
write('src/ui/scope-controls.js', extract(3445, 3480));

// --- ENGINE ---

// a11y-pwa.js: Sprint 10 - accessibility, PWA, changelog
write('src/ui/a11y-pwa.js', extract(3481, 3553));

// benchmark.js: VXA.Benchmark
write('src/engine/benchmark.js', extract(3554, 3587));

// validation.js: VXA.Validation (Sprint 13)
write('src/engine/validation.js', extract(3589, 3974));

// sparse.js: VXA.Sparse
write('src/engine/sparse.js', extract(3976, 4154));

// voltage-limit.js: VXA.VoltageLimit
write('src/engine/voltage-limit.js', extract(4157, 4193));

// stamps.js: VXA.Stamps
write('src/engine/stamps.js', extract(4196, 4415));

// adaptive.js: VXA.AdaptiveStep
write('src/engine/adaptive.js', extract(4418, 4435));

// sim.js: VXA.SimV2
write('src/engine/sim.js', extract(4438, 4938));

// --- MODELS ---

// models.js: VXA.Models
write('src/models/models.js', extract(4940, 5031));

// stamps-enhanced.js: diode_spice, bjt_gp, nmos_spice (enhanced stamp functions)
write('src/engine/stamps-enhanced.js', extract(5034, 5176));

// spice-parser.js: VXA.SpiceParser
write('src/models/spice-parser.js', extract(5179, 5216));

// --- SIM ENGINE (legacy MNA + render helpers) ---

// sim-legacy.js: MNA simulation engine + buildCircuitFromCanvas + simulationStep etc.
write('src/engine/sim-legacy.js', extract(5231, 5605));

// render-loop.js: render() + loop infrastructure
write('src/ui/render-loop.js', extract(5606, 5744));

// --- IO ---

// export-import.js: JSON export/import
write('src/io/export-import.js', extract(5745, 5835));

// share.js: URL sharing
write('src/io/share.js', extract(5836, 5882));

// gallery.js: Gallery modal
write('src/ui/gallery.js', extract(5883, 5990));

// --- UI ---

// tutorials-basic.js: basic tutorial system
write('src/ui/tutorials-basic.js', extract(5991, 6030));

// touch.js: Touch support
write('src/interaction/touch.js', extract(6031, 6095));

// tabs.js: Tab switching
write('src/ui/tabs.js', extract(6096, 6111));

// dc-sweep.js: DC sweep analysis
write('src/ui/dc-sweep.js', extract(6112, 6181));

// --- ENGINE (Sprint 8 analysis suite) ---

// ac-analysis.js: VXA.ACAnalysis
write('src/engine/ac-analysis.js', extract(6182, 6363));

// noise-analysis.js: VXA.NoiseAnalysis
write('src/engine/noise-analysis.js', extract(6366, 6585));

// sensitivity.js: VXA.SensitivityAnalysis
write('src/engine/sensitivity.js', extract(6588, 6617));

// graph.js: VXA.Graph
write('src/ui/graph.js', extract(6634, 6706));

// --- IO (Sprint 9) ---

// blocks.js: VXA.Blocks (subcircuit)
write('src/io/blocks.js', extract(6725, 6759));

// spice-import.js: VXA.SpiceImport
write('src/models/spice-import.js', extract(6773, 6877));

// spice-export.js: VXA.SpiceExport
write('src/models/spice-export.js', extract(6899, 6951));

// --- UI (Sprint 9 continued) ---

// net-labels.js: Net label system + describeCircuit + verification etc.
write('src/ui/net-labels.js', extract(6952, 7019));

// bode.js: Bode plot
write('src/ui/bode.js', extract(7020, 7151));

// param-sweep.js: Parameter sweep
write('src/ui/param-sweep.js', extract(7152, 7198));

// fft.js: FFT analysis
write('src/ui/fft.js', extract(7199, 7272));

// monte-carlo.js: Monte Carlo
write('src/ui/monte-carlo.js', extract(7273, 7332));

// temp-sweep.js: Temperature sweep
write('src/ui/temp-sweep.js', extract(7333, 7383));

// noise-ui.js: Noise analysis UI runner
write('src/ui/noise-ui.js', extract(7384, 7426));

// sensitivity-ui.js: Sensitivity analysis UI runner
write('src/ui/sensitivity-ui.js', extract(7427, 7477));

// worst-case.js: Worst case analysis
write('src/ui/worst-case.js', extract(7478, 7560));

// svg-export.js: SVG export
write('src/io/svg-export.js', extract(7561, 7582));

// csv-export.js: CSV export
write('src/io/csv-export.js', extract(7583, 7600));

// pwa.js: PWA service worker registration
write('src/io/pwa.js', extract(7601, 7605));

// --- STARTUP + API ---

// startup.js: DOMContentLoaded, buildLeftPanel, loadPreset, API functions, etc.
write('src/core/startup.js', extract(7606, 8107));

// --- IO ---

// autosave.js: VXA.AutoSave
write('src/io/autosave.js', extract(8108, 8145));

// --- FX ---

// particles.js: VXA.Particles
write('src/fx/particles.js', extract(8147, 8296));

// thermal.js: VXA.Thermal
write('src/fx/thermal.js', extract(8298, 8379));

// damage.js: VXA.Damage
write('src/fx/damage.js', extract(8381, 8561));

// --- UI (Sprint 3 - Enhanced UI) ---

// inline-edit.js: Inline value edit system
write('src/ui/inline-edit.js', extract(8567, 8743));

// settings.js: Settings modal + persistence
write('src/ui/settings.js', extract(8744, 8865));

// context-menu-smart.js: Smart context menu + quick start + recent components
write('src/ui/context-menu-smart.js', extract(8866, 9021));

// inspector-enhanced.js: Enhanced inspector (overrides basic)
write('src/ui/inspector-enhanced.js', extract(9022, 9170));

// ui-extras.js: fitToScreen, duplicate patch, topbar handlers, settings load
write('src/ui/ui-extras.js', extract(9171, 9229));

// --- UI (Sprint 4 - CRT/Scope) ---

// crt.js: CRT mode, cursor measurement, scope measurements, reference waveform
write('src/ui/crt.js', extract(9230, 9366));

// --- FX ---

// sound.js: VXA.Sound
write('src/fx/sound.js', extract(9367, 9467));

// --- UI (Sprint 4 continued) ---

// scope-extras.js: source preview, channel mgmt, math, scope export, tooltip
write('src/ui/scope-extras.js', extract(9469, 9615));

// scope-enhanced.js: Enhanced drawScope (overrides basic)
write('src/ui/scope-enhanced.js', extract(9616, 9932));

// sound-triggers.js: Sound trigger patches
write('src/ui/sound-triggers.js', extract(9933, 9969));

// --- UI (Sprint 5) ---

// tutorials.js: Interactive tutorial system
write('src/ui/tutorials.js', extract(9970, 10135));

// encyclopedia.js: Component encyclopedia
write('src/components/encyclopedia.js', extract(10136, 10234));

// statusbar.js: Statusbar enhancement
write('src/ui/statusbar.js', extract(10235, 10280));

// welcome.js: Welcome experience
write('src/ui/welcome.js', extract(10281, 10293));

// about.js: About dialog + validation UI
write('src/ui/about.js', extract(10294, 10330));

// --- APP (final init) ---

// app.js: Welcome trigger, v6 keyboard shortcuts, loop, a11y init
write('src/app.js', extract(10328, 10428));

console.log('\n✅ Split complete! Now run: node build.js');
