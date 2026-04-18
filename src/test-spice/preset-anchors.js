// Sprint 102 — Manual gold anchors.
//
// Each anchor carries an expected VOLTAGE VECTOR produced by loadPreset
// path A after 10 short solve() steps (≈100µs). Values are sorted
// ascending so they don't depend on node-numbering stability.
// Expected vectors are derived by hand from the preset's own parts
// (see preset-roundtrip-scenarios.js for where these are consumed).
// If a preset is later edited to change component values these anchors
// must be updated manually — that is the point of a gold anchor.
//
// Tolerance is per-element: |V_sorted[i] - expected_sorted[i]| must be
// ≤ tol for all i. Wider tolerance is allowed for semiconductor-heavy
// presets where Vf / Vz / Vth carry model-dependent scatter.
//
// These anchors are the external ground truth that the round-trip
// probe cannot catch by itself — if both SPICE paths happened to be
// identically wrong, anchors still fail.

module.exports = [
  {
    id: 'vdiv',
    description: 'Voltage divider 12V / 1k / 2.2k ⇒ 8.25V midpoint',
    expectedSorted: [0, 8.25, 12],
    tol: 0.05,
    why: '12V × 2.2k/(1k+2.2k) = 8.25V',
  },
  {
    id: 'rclp',
    description: 'RC low-pass, AC source ⇒ all DC voltages 0',
    expectedSorted: [0, 0, 0],
    tol: 0.01,
    why: 'AC source has 0V DC component',
  },
  {
    id: 'rl',
    description: 'RL transient at steady state, inductor is a short',
    expectedSorted: [0, 0, 5],
    tol: 0.05,
    why: 'V+ = 5V, L short at DC ⇒ mid-node tied to GND',
  },
  {
    id: 'rccharge',
    description: 'Switched RC charging, cap discharged at t=0',
    expectedSorted: [0, 0, 5, 5],
    tol: 0.5,
    why: 'V+=5V, switch closed, cap ramping from 0V',
  },
  {
    id: 'rlc',
    description: 'RLC series, supply rail 10V must appear at one node',
    // At t≈100µs the circuit is mid-oscillation (f0≈1.6kHz, period≈628µs).
    // We sanity-check supply-rail presence + ground present, not the
    // dynamic state. Anchor extracts min and max of V; middle nodes
    // can be anywhere in (0, 10).
    expectedMinMax: { min: 0, max: 10, tol: 0.5 },
    why: 'V+=10V and GND=0V must both be in node set; middle nodes transient',
  },
  {
    id: 'zener-reg',
    description: 'Zener clamped at ~5.1V, 12V supply',
    expectedSorted: [0, 5.1, 12],
    tol: 0.3,
    why: '12V source, zener holds output near nominal Vz',
  },
  {
    id: 'pot-divider',
    description: 'Pot divider supply rail and tap',
    expectedSorted: [0, 5, 10],
    tol: 0.5,
    why: '10V supply and pot wiper at or near midpoint',
  },
  {
    id: 'trafo',
    description: 'AC source ⇒ DC OP is 0 everywhere',
    expectedSorted: [0, 0, 0, 0],
    tol: 0.5,
    why: 'AC source has 0V DC component; 4 nodes',
  },
  {
    id: 'dc-motor-simple',
    description: 'Simple motor + resistor, 12V supply',
    expectedSorted: [0, 12],
    tol: 0.1,
    why: 'DC motor modelled as resistor; only 2 nodes (N=2)',
  },
  {
    id: 'vdiv',
    // Second-entry tag to validate anchor system doesn't accidentally collapse
    // multiple anchors for same preset.
    key: 'vdiv-supply-rail',
    description: 'Voltage divider supply rail is exactly 12V',
    expectedSorted: [0, 8.25, 12],
    tol: 0.05,
    why: 'Confirms supply rail matches vdc.val',
  },
];
