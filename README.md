# VoltXAmpere

[![version](https://img.shields.io/badge/version-11.0.0-00e09e)](./CHANGELOG.md)
[![harness](https://img.shields.io/badge/harness-11%2F11_pass-22cc44)](./src/test-spice/puppeteer-harness.js)
[![scenarios](https://img.shields.io/badge/scenarios-8%2F8_pass-22cc44)](./src/test-spice)
[![license](https://img.shields.io/badge/license-MIT-blue)](./LICENSE)

Professional web-based circuit simulator — 71+ components, full
SPICE parser, complete thermal-electrical coupling, AC-MNA analysis,
interactive multimeter, Bode and Nyquist plotting.

Live at **[voltxampere.com](https://voltxampere.com)**.

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
# Open http://localhost:8765/index.html
```

## Testing

```bash
npm test               # main harness — 11 reference circuits
npm run scenarios      # sequential: 8 thermal / saturation probes
```

Every commit in the Sprint 77 → 89 series was verified against both
the main harness and the scenario suite before landing on `main`.

## Build

A single-file build concatenates the modular `src/` tree into
`index.html` (~29 k lines):

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
