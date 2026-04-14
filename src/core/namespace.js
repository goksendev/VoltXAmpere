/* ============================================================
   VoltXAmpere v8.0 — Browser Circuit Simulator
   ============================================================ */

// ──────── VXA NAMESPACE ────────
var VXA = {};

VXA.Config = (function() {
  return {
    VERSION: '8.0',
    GRID_SIZE: 20,
    PIN_SNAP: 18,
    MAX_UNDO: 100,
    AUTOSAVE_INTERVAL: 30000,
    AMBIENT_TEMP: 25,
    BOLTZMANN: 1.38e-23,
    THERMAL_VOLTAGE: 0.026,
    COLORS: {
      accent: '#00e09e', blue: '#3b82f6', red: '#f0454a', orange: '#f59e0b',
      yellow: '#eab308', purple: '#a855f7', pink: '#ec4899', cyan: '#06b6d4', green: '#22c55e',
      text: '#e0e7f0', text2: '#8899aa', text3: '#5a6a7a',
      bg: '#06080c', surface: '#0b0f15', border: '#1a2538'
    }
  };
})();

VXA.EventBus = (function() {
  var listeners = {};
  return {
    on: function(event, fn) {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(fn);
    },
    off: function(event, fn) {
      if (!listeners[event]) return;
      listeners[event] = listeners[event].filter(function(f) { return f !== fn; });
    },
    emit: function(event, data) {
      if (!listeners[event]) return;
      listeners[event].forEach(function(fn) { fn(data); });
    }
  };
})();

// ──────── CONSTANTS & STATE ────────
const GRID = 20, PIN_SNAP = 18, MAX_UNDO = 100;
const DPR = window.devicePixelRatio || 1;
const S = {
  parts: [], wires: [], nextId: 1,
  view: { ox: 0, oy: 0, zoom: 1, minZoom: 0.15, maxZoom: 6 },
  mode: 'select', placingType: null, placeRot: 0,
  sel: [], hovered: null, hoveredPin: null,
  wireStart: null, wirePreview: null,
  drag: { active: false, type: null, sx: 0, sy: 0, parts: [] },
  mouse: { x: 0, y: 0, wx: 0, wy: 0 },
  selBox: null, clipboard: null,
  undoStack: [], redoStack: [],
  sim: { running: false, t: 0, error: '' },
  scope: {
    ch: [
      { on: true,  color: '#00e09e', label: 'KN1', buf: new Float64Array(600), src: null, vDiv: 2 },
      { on: true,  color: '#3b82f6', label: 'KN2', buf: new Float64Array(600), src: null, vDiv: 2 },
      { on: false, color: '#f59e0b', label: 'KN3', buf: new Float64Array(600), src: null, vDiv: 2 },
      { on: false, color: '#a855f7', label: 'KN4', buf: new Float64Array(600), src: null, vDiv: 2 },
    ],
    ptr: 0,
    tDiv: 1e-3,
    trigger: { mode: 'auto', edge: 'rising', level: 0, src: 0 },
    probeMode: false,
    mode: 'yt',
    persist: false,
    math: '',
    cursors: false,
    cx1: 150, cx2: 450,
    cy1: 40, cy2: 120,
  },
  voltageMap: false, showGrid: true,
  netNames: {},
  annotations: [],
  subcircuits: {},
  hierarchyStack: [],
  groups: [],
  fps: 0, _fc: 0, _ft: performance.now(),
  reducedMotion: window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  // v6.0 state
  realisticMode: true,
  ambientTemp: 25,
  soundOn: false,
  soundVolume: 50,
  crtMode: false,
  currentDirection: 'conventional',
  wireStyle: 'catenary',
  bgStyle: 'techGrid',
  symbolStd: 'IEC',
  autoSave: true,
  damageList: [],
  particles: [],
  showHeatmap: false,
  animationsOn: true
};
VXA.State = S; // Backward compat reference
let needsRender = true;