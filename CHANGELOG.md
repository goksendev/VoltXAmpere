# Changelog

All notable changes to VoltXAmpere are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [11.0.0] — 2026-04-18

Thirteen-sprint release closing the thermal-electrical feedback loop
for every nonlinear active device in the simulator, modernising the
measurement and analysis surface, and maturing solver stability. All
11 main harness circuits plus 8 scenario probes green. See the Sprint
77 → 89 commits in `git log` for per-sprint implementation notes.

### Added

**Thermal-Electrical Physics Coupling**

- **BJT junction temperature** coupling via Gummel-Poon Vt(T) and
  Is(T) with the standard SPICE bandgap model (Eg = 1.12 eV default).
  Runaway vs safe topologies now show a 25.9 °C peak-Tj separation
  under identical electrical inputs. *(Sprint 81)*
- **MOSFET Level-1 junction coupling** via Vth(T) = Vth0 − 2 mV·ΔT
  and KP(T) ∝ (T/300)⁻¹·⁵ mobility degradation. 12 °C separation
  between runaway and negative-TC drive. *(Sprint 83)*
- **Diode Is(T)** scaling with configurable bandgap for Si (1.12 eV),
  Schottky (0.5 eV), and Ge (0.67 eV). V_F temperature coefficient
  measures −1.83 mV/°C on ideal Si — squarely in the textbook
  −1.9…−2.2 mV/°C window. *(Sprint 84)*
- **Inductor core saturation** L_eff(I) with configurable I_sat and
  knee sharpness exponent. Saturating topology leads ideal by 150 %
  at the knee point. *(Sprint 82)*
- **Curie-point derating** of I_sat: Isat(T) = Isat₀ · (1 − (T/T_c)^β).
  Solver tracks analytic model to three decimal places across 25 →
  180 °C. *(Sprint 88)*
- **Hysteresis core-loss channel** P_hyst ≈ Hc · |di/dt| · L — zero
  at DC, linear in frequency. *(Sprint 87)*
- **Eddy-current loss channel** P_eddy = Ke · (di/dt)² · L — zero at
  DC, quadratic in frequency. Measured log-log slope 1.921 (analytic
  2.00). *(Sprint 89)*

All loss channels feed `part._p`, which the existing Sprint 70f
thermal engine picks up as ordinary dissipation — so core heating
automatically drives Curie derating, closing the thermal loop.

**Analysis & Measurement**

- **AC-MNA Bode backend** replacing the old transient-sweep/sample
  approach. One complex-MNA linear solve per frequency versus 40 × 5
  transient steps — **155× speedup** on the 101-point reference
  sweep. Analytic key points match to < 0.1 dB / 1°. *(Sprint 78)*
- **Nyquist plot tab** sharing the AC-MNA backend. Unit circle and
  (−1, 0) stability marker overlays for Nyquist-criterion reading.
  *(Sprint 78)*
- **Multimeter probe** upgrade: wire attachment (not just pins),
  automatic AC RMS detection via 500-sample ring buffer, mode
  selector (auto / V / I / R / dB) with `m` key cycling, and
  MIN / MAX / PEAK hold with `h` key cycling. *(Sprint 79)*

**User Experience**

- **Interactive 8-step tutorial** with event-triggered advancement —
  drop a resistor, the tour advances; draw a wire, next step;
  and so on. `F1` anywhere restarts, `Esc` dismisses. *(Sprint 80)*

### Fixed

- **RL / RLC solver divergence.** BE and TRAP inductor Norton
  companion stamps carried an inverted sign (Sprint 77 forensic
  trace). Previously an RL circuit with τ = 1 µs diverged
  exponentially within 12 µs; now matches the analytic
  `I(t) = I_∞ · (1 − e^−t/τ)` within 0.2 % across the full
  transient. *(Sprint 77)*
- **Deep-saturation convergence** in the Gummel-Poon BJT stamp. The
  q1 floor was tightened 0.01 → 0.05 and qb explicitly clamped to
  [0.1, 100] with a NaN guard, so a saturated device no longer drags
  the outer-NR loop into a pathological operating point. *(Sprint 85)*
- **Outer-Newton-Raphson adaptive damping** with divergence rollback.
  When the per-iteration residual fails to shrink, the next Newton
  step is under-relaxed (α: 1.0 → 0.5 → 0.25 → 0.1); when it shrinks
  fast, damping relaxes back toward 1.0. Divergence guard no longer
  zero-wipes nodeV — it rolls back to the last good snapshot and
  retries with dt/2 (up to two retries) before surfacing the error.
  Side benefit: deep-saturation BJT now converges to the textbook
  `(V_cc − V_cesat)/R = 480 mA` operating point instead of the
  `898 mA` artefact Sprint 85 left behind. *(Sprint 86)*

### SPICE Netlist Extensions

Inductor line accepts additional position-free tokens (all
case-insensitive):

| Token        | Units             | Meaning                            |
| ------------ | ----------------- | ---------------------------------- |
| `Isat=X`     | A                 | saturation current                 |
| `Nsat=X`     | (dimensionless)   | knee sharpness exponent (default 4)|
| `Hc=X`       | A                 | coercive-current proxy             |
| `Ke=X`       | W·s²/(A²·H)       | eddy-current coefficient           |
| `Tcurie=X`   | °C                | Curie point (default 220, MnZn)    |
| `CurieExp=X` | (dimensionless)   | derating exponent (default 2)      |

Example (a MnZn-ferrite SMPS inductor):

```
L1 2 0 100u Isat=3 Nsat=4 Hc=0.05 Ke=1e-10 Tcurie=220
```

Diode models accept a new `Eg` field via `.MODEL D(…)` for
temperature-scaling under non-Si bandgaps. Default remains 1.12 eV.

### Internal

- NR iteration budget raised 30 → 60 to accommodate thermal-driven
  operating-point shifts between outer solver calls.
- Divergence guard replaced zero-wipe with snapshot-rollback + dt/2
  retry; the legacy zero-clamp still runs as a last-resort fallback
  when all retries fail.
- VXA.Thermal accessor `ensureThermal(part)` exposed so probes /
  tests can pin junction temperature without waiting for the thermal
  integrator to reach steady state.

### Regression

All 11 main harness circuits pass under `node src/test-spice/puppeteer-harness.js`:

- 01 voltage-divider, 02 parallel-r, 03 rlc-series
- 04 diode-bridge, 05 ce-amp, 06 opamp-buffer, 07 555-astable
- 08 voltage-regulator, 09 h-bridge, 10 boost-converter
- 14 rl-decay (Sprint 77 analytic verification)

Scenario probes (8) under `src/test-spice/*-scenarios.js`:

- `inductor-saturation-scenarios.js` — Sprint 82 Isat verification
- `hysteresis-scenarios.js` — Sprint 87 core loss f¹
- `curie-derating-scenarios.js` — Sprint 88 Isat(T)
- `eddy-frequency-scenarios.js` — Sprint 89 f² scaling
- `bjt-thermal-scenarios.js` — Sprint 81 Δ = 25.9 °C
- `mosfet-thermal-scenarios.js` — Sprint 83 Δ = 12 °C
- `diode-thermal-scenarios.js` — Sprint 84 −1.83 mV/°C
- `bjt-saturation-scenarios.js` — Sprint 85/86 stable 488 mA

### Known Issues / Deferred

Tracked as explicit technical debt for Package 3:

- **Sprint 81 runaway collapse** at t ≈ 0.26 s. The solver finds an
  alternate Ic = 0 equilibrium as Tj crosses ~57 °C, rather than
  continuing along the thermal-coupled trajectory. Needs
  pseudo-transient continuation / equilibrium bridging — scheduled
  as Sprint 96 in Package 3.
- **BSIM3 MOSFET** still uses static TNOM for temperature; a runtime-T
  retrofit needs the whole Vth_body / Vth_DIBL / Vth_SCE chain to
  take `T` as an input.
- **LED V_F(T)** obeys AlGaAs / GaN material-specific laws — the
  silicon bandgap model we default to is wrong for LEDs, so the
  coupling is deliberately bypassed for LED-typed parts.
- **Zener avalanche TC** (positive above ~6 V, negative below).
- **Full Jiles-Atherton hysteresis** (requires N · A_eff · l_eff
  geometry the lumped inductor doesn't carry).
- **Skin-effect / AC wire resistance** — orthogonal to core-loss.
- **Transformer mutual-inductance with hysteresis.**

---

## [10.0.0] and earlier

Pre-Sprint-77 history is preserved in the full `git log`. v10.0
marked completion of the initial SPICE parser, MNA solver with
Backward-Euler / Trapezoidal companions, sparse LU factorisation,
thermal-damage engine, and 71+ component library.

[11.0.0]: https://github.com/goksendev/VoltXAmpere/releases/tag/v11.0.0
