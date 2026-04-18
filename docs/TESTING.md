# VoltXAmpere Test Infrastructure

VoltXAmpere ships with three layers of regression coverage. Each
layer has a distinct purpose — together they catch everything from
"did the button change colour" through "did the solver silently
produce the wrong answer on a 50-node circuit".

## Running everything

```bash
npm install        # puppeteer is the only dependency
npm run build      # regenerate simulator.html from src/
npm test           # main harness (11 circuits)
npm run scenarios  # physics + infrastructure scenario probes
npm run test:sparse # sparse vs dense differential (HATA 16)
```

CI should run `build`, `test`, `scenarios`, and `test:sparse` on
every pull request.

## Layer 1 — Main harness (`npm test`)

`src/test-spice/puppeteer-harness.js` loads each of 11 reference
circuits in a headless Chromium, drives them through the live
`VXA.SpiceImport` → `buildCircuitFromCanvas` → `VXA.SimV2.solve`
pipeline, and asserts canvas-level invariants:

- parse / place succeed without errors
- every SPICE net is preserved in `SIM.comps`
- no wires are diagonal or cross components
- ground symbols resolve to node 0
- per-node KCL balance stays below 1 nA
- V-source branch current + power sign agree

Reference circuits: voltage-divider, parallel-r, rlc-series,
diode-bridge, ce-amp, opamp-buffer, 555-astable,
voltage-regulator, h-bridge, boost-converter, rl-decay.

## Layer 2 — Scenario probes (`npm run scenarios`)

`src/test-spice/*-scenarios.js` is a suite of physics-focused
probes that each exercise one non-linear device or subsystem.  The
`npm run scenarios` script sequences them and halts on the first
failure. Current line-up (14 files, 50+ assertions):

| probe | sprint | asserts |
| --- | --- | --- |
| `bjt-saturation-scenarios` | 85/86 | saturated BJT stays at textbook I_c |
| `bjt-thermal-scenarios` | 81 | T_j runaway separation ≥ 25 °C |
| `controlled-source-scenarios` | 92 | CCVS / CCCS branch-variable MNA (HATA 13) |
| `curie-derating-scenarios` | 88 | inductor I_sat(T) follows analytic |
| `diode-thermal-scenarios` | 84 | V_F slope −1.83 mV/°C on Si |
| `eddy-frequency-scenarios` | 89 | P_eddy ∝ f² |
| `hysteresis-scenarios` | 87 | P_hyst ∝ f¹ |
| `inductor-saturation-scenarios` | 82 | L_eff(I) knee + sat flag |
| `jfet-model-scenarios` | 93 | JFET .MODEL binding (HATA 14) |
| `mosfet-thermal-scenarios` | 83 | V_th(T) + KP(T) runaway Δ = 12 °C |
| `preset-geometry-scenarios` | 94 | no zero-length preset wires (HATA 15) |
| `probe-scenarios` | 79 | multimeter wire-attach + AC RMS + dB modes |
| `sparse-dense-differential-scenarios` | 95 | LU parity (HATA 16) |
| `tutorial-scenarios` | 80 | 8-step onboarding advances on trigger events |

A new probe should be added here whenever a sprint touches a
device model, a solver path, or a user-visible interaction.

## Layer 3 — Sparse vs dense differential (`npm run test:sparse`)

`src/test-spice/sparse-dense-differential-scenarios.js` is the
test that Sprint 95 added to close Sprint 69's HATA 16.  For every
one of 25 representative circuits — 24 from the regular suite
plus a synthetic 50-resistor ladder (`36-ladder-50-resistors.cir`)
that pushes the MNA matrix past the `n=30` threshold — it:

1. Solves with the production `VXA.Sparse.solveLU` dispatcher
   (dense for `n ≤ 30`, banded for `n > 30`).
2. Solves again with `solveLU` overridden to `solveLU_dense`.
3. Compares the final node-voltage vectors.

Pass criterion: `max |ΔV| ≤ 1e-6` **or** `max relative ≤ 1e-4`.

For small circuits the production path reduces to dense, so the
diff is exactly `0.0` — which itself verifies the dispatcher's
threshold hasn't drifted. The 50-node ladder lands on the banded
path with a bandwidth of 1 and compares at floating-point
precision to the dense ground truth.

A separate diagnostic mode inside the same probe also forces
banded on every circuit and reports any discrepancies as
`⚠` warnings without failing the suite. This caught a banded
solver regression with branch-variable stamps during Sprint 95
development — those three small-matrix cases never reach the
banded path in production (the dispatcher restricts banded to
`n > 30`) but the diagnostic keeps them visible as deferred debt.

## Regression prevention matrix

| layer | what it catches |
| --- | --- |
| `build.js` preset validator | zero-length preset wires reintroduced |
| `npm test` (harness) | schematic placement / KCL regressions |
| `npm run scenarios` | physics coupling, solver convergence, UI flows |
| `npm run test:sparse` | LU dispatcher drift + banded vs dense drift |

## Adding a new test

- **Device-level regression**: add a `.cir` fixture and a
  `*-scenarios.js` probe next to the existing ones. Use
  `bjt-thermal-scenarios.js` as a template — it already shows the
  fresh-state / buildCircuit / simulate / assert pattern.
- **Component geometry / rendering**: extend
  `preset-geometry-scenarios.js` or add a new `*-scenarios.js`
  that uses Puppeteer to inspect the canvas.
- **Solver**: extend `sparse-dense-differential-scenarios.js` by
  appending a circuit file name to the `CIRCUITS` list.  Large
  matrices (`n > 30`) are the most valuable additions — they
  actually exercise the banded path.
