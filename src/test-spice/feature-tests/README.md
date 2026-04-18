# feature-tests — Great Reset Era (Sprint 104+)

Sprint 104 removed all 55 preset circuits from `src/components/presets.js`
and the four preset-dependent probes (`preset-roundtrip-scenarios.js`,
`preset-integrity-scenarios.js`, `preset-anchors.js`,
`preset-geometry-scenarios.js`). The repeated lesson from Sprints 98,
101, 102, and 103 — that a preset library hides bugs behind
"converged" and "modal didn't fire" and "round-trip matched" — made
the preset-first test strategy untenable.

This directory is the new foundation. One file per feature:

```
feature-tests/
  README.md                    ← this file
  resistor/                    ← planned: analytic V=IR, thermal coeffs, tolerance
  capacitor/                   ← planned: charge curve vs τ=RC, leakage
  inductor/                    ← planned: L·di/dt, saturation knee
  diode/                       ← planned: Shockley I-V, Vf(T), reverse breakdown
  bjt/                         ← planned: Gummel-Poon Ic(Vbe), β(Ic), Vce(sat)
  mosfet/                      ← planned: Level-1 Id(Vgs, Vds), Vth(T)
  jfet/                        ← planned: Shichman-Hodges, pinch-off
  opamp/                       ← planned: ideal + 2-pole, saturation, slew
  ac-analysis/                 ← planned: Bode / Nyquist against analytic RLC
  transient/                   ← planned: dt stability, stiff-circuit handling
```

Each feature folder contains:

1. **One SPICE netlist** (`*.cir`) with a canonical, LTspice-verified test.
2. **One puppeteer probe** (`*-scenarios.js`) that loads the netlist via
   `VXA.SpiceImport.parse()` — **never via `loadPreset`** — and asserts
   the measurable output against analytic or LTspice reference.
3. **One short `expected.md`** documenting the reference numbers and
   where they came from.

A preset can return to the simulator **only after** every component
used in that preset has its own passing feature test in this directory.
"Verified by analytic reference" replaces "ships in the gallery" as
the bar for correctness.

See `CHANGELOG.md [12.0.0-alpha.1]` for the rationale.
