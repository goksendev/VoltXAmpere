# VoltXAmpere

[![version](https://img.shields.io/badge/version-12.0.0--alpha.1-ff9b54)](./CHANGELOG.md)
[![harness](https://img.shields.io/badge/harness-11%2F11_pass-22cc44)](./src/test-spice/puppeteer-harness.js)
[![scenarios](https://img.shields.io/badge/scenarios-13_files-22cc44)](./src/test-spice)
[![sparse](https://img.shields.io/badge/sparse-25%2F25_pass-22cc44)](./src/test-spice/sparse-dense-differential-scenarios.js)
[![license](https://img.shields.io/badge/license-MIT-blue)](./LICENSE)

Professional web-based circuit simulator — 71+ components, full
SPICE parser, complete thermal-electrical coupling, AC-MNA analysis,
interactive multimeter, Bode and Nyquist plotting.

Live at **[voltxampere.com](https://voltxampere.com)**.

## v12.0.0-alpha.1 — The Great Reset

All 55 bundled preset circuits have been removed and preset-based
testing abandoned. The v11.x line accumulated four consecutive audit
findings rooted in the same problem — the preset library was the
de-facto CI surface, and every test family eventually admitted it was
insufficient to guard what presets ship to users.

The foundation is being rebuilt feature-by-feature under
`src/test-spice/feature-tests/`. A preset returns to the simulator
only after every component it uses has its own passing test there,
verified against analytic or LTspice reference.

Three regression fences remain: `npm test` (11/11 harness),
`npm run scenarios` (13 device/physics/UX probes), and
`npm run test:sparse` (25/25 sparse-vs-dense). Each tests a specific
solver path or device model against a specific external reference.

See [CHANGELOG.md](./CHANGELOG.md#1200-alpha1--2026-04-19) for the
full rationale and the planned rebuild order.

## What's New in 11.2.1

Emergency patch. v11.2.0 shipped 55/55 "PASS" but operator manual
verification found three critical user-visible bugs the probe had
reported as green — convergence alone is not correctness.

- **`bridge-rect` preset wiring fixed** — four unconnected pins
  (D2/D4 anodes and C1 top/bottom). Now produces ~10V filtered
  output from 12V AC input.
- **`cmos-inv` preset wiring fixed** — Vin source's bottom terminal
  was shorting to VCC. Inverter now gives Vout=5V when Vin=0V.
- **`findDCOperatingPoint` no longer hangs** — 5 s wall-clock + 500
  iteration budget added. Chrome stays responsive on `npn-sw`.
- **New `npm run test:integrity`** and round-trip integrity gate —
  any preset with unconnected pins now FAILs regardless of other
  signals. Third fence added alongside the existing round-trip +
  anchor ones.

See [CHANGELOG.md](./CHANGELOG.md#1121--2026-04-19) for the full
entry including Sprint Narrative.

## What's New in 11.2

Audit-driven release. Sprint 101's read-only audit of v11.1 found a
one-line bug in the ground union-find loop that had been silently
breaking 23 of 55 bundled preset circuits for 30+ sprints. No scenario
probe had ever gone through the `loadPreset()` path, so the bug hid in
plain sight. This release fixes the bug (`sim-legacy.js:91`) and adds
the missing fence.

- **Ground union-find fix** — all `ground`/`gndLabel` symbols now merge
  into a single node 0. Multi-ground circuits that used to silently
  return wrong voltages (or diverge, in the case of `rl`) now solve
  correctly.
- **`npm run test:presets`** — new 55-preset round-trip CI probe.
  Loads every preset two ways (native + SPICE round-trip) and
  cross-checks against 10 manual first-principles gold anchors.
  Defends against both the bug type that hid this one and the
  "both paths identically wrong" failure mode.

See [CHANGELOG.md](./CHANGELOG.md#1120--2026-04-19) for the full entry
including Sprint Narrative and the Sprint 101 audit link.

## What's New in 11.1

Ten-sprint infrastructure release (Sprints 91 → 99). Key additions:

- **Controlled sources (CCVS / CCCS)** — full SPICE `H` and `F` elements
  with branch-variable MNA stamps.
- **JFET model library** — nine presets plus user-defined `.MODEL`
  directives now bind to the JFET stamp end-to-end.
- **Sparse solver correctness** — banded LU fill-in bandwidth corrected
  to `2·bw` (LAPACK GBTRF). Closes a quiet class of wrong answers on
  larger sparse matrices.
- **Test harness maturity** — new 25-circuit sparse-vs-dense
  differential suite (`npm run test:sparse`), preset geometry validator,
  and a documented probe-writing doctrine after a six-month-old "BJT
  collapse" turned out to be a test race, not physics.

See [CHANGELOG.md](./CHANGELOG.md#1110--2026-04-18) for the full entry
including per-sprint narrative.

## What's New in 11.0

- **Thermal-electrical chain closed.** Every nonlinear active device
  (BJT, MOSFET Level-1, diode, inductor) now reacts to junction
  temperature. Thermal runaway, Curie-point Isat derating, and
  core-saturation self-heating are modelled physically. See the
  [CHANGELOG](./CHANGELOG.md) for per-sprint detail.
- **AC analysis 155× faster** — Bode and the new Nyquist tab share a
  complex-MNA backend.
- **Professional multimeter probe** — drag onto pins *or* wires,
  automatic AC RMS detection, V / I / R / dB mode selector,
  MIN / MAX / PEAK hold.
- **Hysteresis + eddy-current losses** — configurable core-loss
  model with measurable f¹ (hysteresis) and f² (eddy) scaling.
- **Solver stability matured** — adaptive NR damping, divergence
  rollback, deep-saturation convergence to textbook values.
- **Interactive tutorial** — 8-step event-triggered onboarding.

See [CHANGELOG.md](./CHANGELOG.md) for the complete list, including
new SPICE tokens (`Isat=`, `Nsat=`, `Hc=`, `Ke=`, `Tcurie=`,
`CurieExp=`, diode `Eg=`) and known-issue tracking.

## Quick Start

```bash
git clone https://github.com/goksendev/VoltXAmpere.git
cd VoltXAmpere
python3 -m http.server 8765
# Landing: http://localhost:8765/
# Simulator: http://localhost:8765/simulator.html
```

## Testing

```bash
npm test               # main harness — 11 reference circuits
npm run scenarios      # sequential: 13 device / physics / UX probes
npm run test:sparse    # sparse-vs-dense differential — 25 circuits
```

Every commit in the Sprint 77 → 99 series was verified against the
three regression fences before landing on `main`. See
[docs/TESTING.md](./docs/TESTING.md) for the probe-writing doctrine.

## Build

A single-file build concatenates the modular `src/` tree into
`simulator.html` (~29 k lines); the landing page (`index.html`) is
served directly:

```bash
npm run build          # or: node build.js
```

## Architecture

```
src/engine/      — solver (MNA + NR + BE/TRAP companions),
                   stamps, thermal model, AC analysis
src/components/  — 71+ component definitions + drawing code
src/ui/          — inspectors, scope, Bode, Nyquist, tutorial
src/models/      — SPICE parser, model library, BSIM3
src/test-spice/  — puppeteer harness + scenario probes
src/fx/          — visual / audio effects (halos, damage,
                   holographic multimeter)
```

## SPICE Syntax Highlights (v11)

New inductor attributes — all tokens are case-insensitive and
position-free past the inductance value:

```
L1 2 0 100u Isat=3 Nsat=4 Hc=0.05 Ke=1e-10 Tcurie=220 CurieExp=2
```

- `Isat=X` — saturation current (A)
- `Nsat=X` — knee sharpness (default 4)
- `Hc=X` — coercive-current proxy (A), hysteresis loss
- `Ke=X` — eddy-current coefficient (W·s²/(A²·H))
- `Tcurie=X` — Curie temperature (°C, default 220 MnZn)
- `CurieExp=X` — derating exponent (default 2)

Diodes accept a new bandgap field via `.MODEL D(…Eg=1.12)` for
Si / Schottky / Ge temperature-scaling.

## License

MIT — see [LICENSE](./LICENSE).
