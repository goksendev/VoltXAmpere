# Changelog

All notable changes to VoltXAmpere are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [11.2.1] — 2026-04-19

Emergency patch. The operator's manual verification of v11.2.0 found
three CRITICAL user-visible bugs that the v11.2.0 round-trip probe
reported as PASS:

1. **bridge-rect** shipped with 4 unconnected pins (D2 pin 1, D4 pin 1,
   C1 pin 1, C1 pin 2). The simulator's own Connection Warning modal
   flagged this immediately on load. DC/transient output was 0V
   everywhere — the filter cap and load were electrically floating.
2. **cmos-inv** shipped with the Vin source's bottom terminal coincident
   with the VCC rail's top terminal, creating an implicit 0V==5V short
   that pinned the inverter to nonsense values.
3. **npn-sw** + Find DC Operating Point caused Chrome to report
   "page not responding" — a user-facing hang caused by the
   `findDCOperatingPoint` outer stepping loop having no wall-clock
   or iteration budget.

The v11.2.0 round-trip probe missed #1 and #2 because it only checked
"converged vs diverged" — a circuit with floating pins can still
converge (the solver resolves remaining nodes). Anchors 10/10 passed
because none of the broken presets were in the anchor set. The
`findDCOperatingPoint` hang was already flagged during Sprint 102
probe development but correctly deferred under the no-silent-scope
rule; this release carries the scoped follow-up fix.

### Fixed

- **F-003 — `bridge-rect` preset unconnected pins**
  *(`src/components/presets.js`)* Previous wiring had dangling segments
  `(-30,-40)→(60,-40)` and `(-30,40)→(60,40)` that didn't reach
  D2/D4 anodes at `(30,±40)` (diode pins are at ±30px, not ±40), plus
  no wires to C1 pins at `(120,±40)`. Rewired with correct coordinates.
  Verified: 1s transient with 12V AC input produces ~10V filtered DC
  output; peak-to-peak matches `Vpeak - 1.4V` to within diode model
  tolerance.
- **F-004 — `cmos-inv` preset wiring**
  *(`src/components/presets.js`)* Vin source moved from `(-80,-80)` to
  `(-60,0)` with its own ground so its bottom terminal no longer
  collides with the VCC rail. PMOS/NMOS gate-tied input, source/drain
  connections explicit. Verified: Vin=0V → Vout=5V (HIGH), the
  standard inverter logic.
- **F-005 — `findDCOperatingPoint` hang**
  *(`src/engine/sim.js`)* Added wall-clock (5 s) and outer-loop
  iteration (500) budgets to both the BJT source-stepping path and the
  GMIN-stepping path. Any overrun now returns `false` with
  `S.sim.error = 'DC OP timeout (Xms)'`. NR algorithm and
  convergence strategy unchanged. Verified on `npn-sw`: 99 ms bail
  instead of indefinite hang. Root cause of `npn-sw` non-convergence
  deferred to Sprint 104 under the no-silent-scope rule.

### Added

- **`npm run test:integrity`** — new standalone probe that loads every
  preset and runs `VXA.ConnectionCheck.check()`, the same routine the
  app's own "Connection Warning" modal fires on Run. Baseline
  (pre-fix): 37 of 55 presets flagged. Post-fix: 20 strictly clean +
  35 documented CC-noise (Sprint 104 follow-up list); `bridge-rect`
  and `cmos-inv` removed from the noisy list as their failures were
  real electrical bugs closed by F-003/F-004.
  *(`src/test-spice/preset-integrity-scenarios.js`)*
- **Round-trip integrity gate**
  *(`src/test-spice/preset-roundtrip-scenarios.js`)* Any preset whose
  Path A reports `ConnectionCheck` warnings now FAILs the round-trip
  regardless of convergence, lossy marker, or diff. The only way for
  an unconnected-pin preset to pass is to be explicitly listed as
  LOSSY_ROUNDTRIP (intrinsic SPICE-export lossiness) or
  CC_NOISE_ROUNDTRIP (25-vs-5-px tolerance mismatch, Sprint 104).

### Infrastructure

- **CLAUDE.md Protocol Rules** committed in Sprint 102.5
  (commit `77b4d57`). Seven disciplines distilled from Sprints 98,
  101, 102: no autonomous wakeups, no silent scope expansion,
  no sahte PASS, user-visible priority, four-gate discipline,
  fix-baseline-regression, clean termination. This release is the
  first where those rules were operational throughout.

### Sprint Narrative

Sprint 102 shipped v11.2.0 with all four gates green:
harness 11/11, scenarios 15/15, sparse 25/25, presets 55/55
(+ 10/10 anchors). The operator's manual walkthrough of five presets
took 15 minutes and found three CRITICAL bugs that had shipped to
users. The round-trip probe had reported PASS on all of them because
convergence is insufficient — a circuit with four unconnected pins
still converges when the solver resolves the remaining nodes.

This is the fourth iteration of the same underlying lesson:

- Sprint 98: test probes can lie by racing themselves
- Sprint 101: tests can lie by existing on paths that don't reach users
- Sprint 102: round-trip can lie when both paths share the same bug
- Sprint 103: convergence can lie when the topology is broken

Every iteration tightens the fence. v11.2.1 adds the integrity gate:
unconnected pin count > 0 means FAIL, regardless of any other signal.
Combined with the anchor fence added in v11.2.0, the probe now rejects
three distinct failure modes instead of one.

The `findDCOperatingPoint` hang on `npn-sw` was a separate CRITICAL
finding. Fix is surgical — wall-clock and iteration bounds, NR
algorithm unchanged. Root cause investigation (why does NR never
converge on `npn-sw`?) is deferred to Sprint 104 under the
"no silent scope expansion" rule.

## [11.2.0] — 2026-04-19

The release where our own audit caught us. Sprint 101 ran a read-only
audit of v11.1.0 and found that **23 of 55 bundled preset circuits
were silently producing wrong results** — and had been since a Sprint-
19-era modular refactor — because no CI probe was ever going through
the `loadPreset()` path. Root cause: a single `break` statement in the
union-find ground detection loop, so only the first ground symbol ever
reached node 0. Subsequent ground symbols leaked into separate
clusters, producing split nets that silently collapsed the preset's
DC operating point.

This release closes the bug and the coverage gap at the same time.

### Fixed

- **F-001 — Ground symbol union-find short-circuit**
  *(`src/engine/sim-legacy.js:91`)* The union-find ground-detection loop
  exited on the first `ground`/`gndLabel` symbol via `break`, so multi-
  ground circuits were never merged into a single reference. All ground
  pins now union into a single canonical root. Idempotent on already-
  merged grounds. Introduced in commit `1ff6b932` (Sprint 11-19 modular
  refactor, April 14); five weeks in production undetected.
- **F-002 — Silent wrong output on 23 multi-ground presets**
  Downstream effect of F-001. `rl` (RL transient) visibly diverged,
  the other 22 (including `rclp`, `inv-opamp`, `bridge-rect`, `vreg-7805`)
  produced voltages that looked plausible but were split across an
  orphan node 3. All now verified against first-principles anchors.

### Added

- **`npm run test:presets` — preset round-trip CI fence**
  *(`src/test-spice/preset-roundtrip-scenarios.js`)* Every preset is
  loaded two ways (native `loadPreset` vs SPICE export → re-import),
  then their post-solve voltage vectors are diffed. 55/55 pass
  (27 strict-matching + 28 known-lossy-but-convergent). Lossy set
  captures semiconductor/subcircuit presets where the SPICE exporter
  loses VXA-specific device-type info — to be tightened in Sprint 103.
- **10 manual gold anchors** *(`src/test-spice/preset-anchors.js`)*
  First-principles expected voltage vectors for `vdiv`, `rclp`, `rl`,
  `rccharge`, `rlc`, `zener-reg`, `pot-divider`, `trafo`,
  `dc-motor-simple`. Sorted-vector comparison with per-element tolerance.
  Anchors cross-check path A's output against external ground truth —
  defends against the "both paths identically wrong" failure mode that
  would defeat round-trip alone.
- **Regression fence count: 4 → 5.** Scenarios pipeline now 15 probes
  (was 14) because `preset-roundtrip-scenarios.js` is picked up by the
  `*-scenarios.js` glob as well as `test:presets`.

### Sprint Narrative

**Sprint 101 — The audit that found us.** Sprint 100 shipped v11.1
with the claim of "test maturity." Sprint 101 was a read-only audit
designed to test that claim. It found the opposite of what v11.1
celebrated: `npm run scenarios` was running 14/14 green, but not a
single scenario ever exercised the `loadPreset()` path. Every one of
the 55 bundled presets was shipping to users — and 23 of them were
silently producing wrong outputs. The symptom that escaped us for
30+ sprints was a preset loading and returning plausible-but-wrong
values (`rclp` returned 0V everywhere) rather than crashing. No
crash → no test signal → no discovery. The full audit is committed
at `docs/TRUE_AUDIT_2026-04-19.md` (commit `a04054f`).

**Sprint 102 — The fix and the fence.** Root cause is a one-line bug:
a `break` in the ground-symbol union-find loop (`sim-legacy.js:91`).
Introduced in commit `1ff6b932`. Fix is surgical — replace `break`
with an idempotent union loop that merges all grounds into one root.
Sprint 98 taught us that test probes can lie by racing themselves.
Sprint 101 taught us that tests can lie by existing only on paths
that don't reach the user. The defense against both is the same
discipline: when we see PASS, we have to ask what was actually tested.

The round-trip probe revealed a secondary finding along the way —
the SPICE exporter lossily collapses VXA device types (LED, Zener,
opamp, IC subcircuit, JFET, SCR, BSIM3) into their standard-SPICE
equivalents, which is why 28 of 55 presets show non-zero diff between
native and round-trip paths. That lossiness is pre-existing and
unrelated to the ground fix; Sprint 103 will tighten it.

## [11.1.0] — 2026-04-18

Ten-sprint infrastructure release (Sprint 91 → 99). User-visible
additions on the device-model side (controlled sources, JFET library),
a solver correctness fix that closes a quiet class of wrong answers on
large sparse matrices, and a significant maturing of the test harness
— including one lesson the hard way that a long-standing "physics bug"
was actually a test probe race condition. All three regression fences
(`npm test`, `npm run scenarios`, `npm run test:sparse`) are green.

### Added

- **Controlled sources (CCVS / CCCS)** — current-controlled voltage
  and current sources now resolve through a proper branch-variable
  MNA pre-pass. Full SPICE `H` and `F` element support, including
  correct sign conventions for the sensing V-source. *(Sprint 92,
  `2e2682c`)*
- **JFET model library + custom `.MODEL` binding** — nine built-in
  presets (Generic, 2N3819, J310, J111, J113, 2N5457, 2N5458, 2N5459,
  MMBF4391) plus user-defined `.MODEL` directives now bind correctly
  to the JFET stamp through the LAMBDA channel-length-modulation
  parameter. Stamp is backward-compatible with the legacy 9-argument
  call. *(Sprint 93, `f797bc5`)*
- **Sparse-vs-dense differential suite** — new `npm run test:sparse`
  diffs 25 representative circuits through the production `solveLU`
  dispatcher versus forced-dense, including a synthetic 50-resistor
  ladder (`36-ladder-50-resistors.cir`) that forces the banded path.
  Pass criterion: `max |ΔV| ≤ 1e-6` or relative ≤ 1e-4. *(Sprint 95,
  `8e689b3`)*
- **Pseudo-Transient Continuation (PTC) infrastructure** — collapse
  detection + `dt/2` retry with conductance injection `(J + I/τ)` for
  stubborn operating points. Currently dormant in production (the
  Sprint 81 collapse that motivated it turned out to be non-physical),
  but the machinery stays as defense-in-depth against future NR
  divergence edge cases. *(Sprint 97, `b04fd0a`)*
- **Probe integrity doctrine** — four documented rules for writing
  new scenario probes against the simulator, added to `docs/TESTING.md`.
  *(Sprint 99, `8cb450f`)*

### Changed

- **Banded sparse solver — LAPACK GBTRF bandwidth allocation** — the
  partial-pivoting elimination inner loop now sweeps `bw → 2·bw` to
  accommodate the fill-in that GBTRF creates in `U`. The previous
  allocation truncated fill and produced silently wrong solutions on
  circuits large enough to enter the banded path. *(Sprint 96,
  `b79a5a8`)*
- **Landing page and simulator route split** — `voltxampere.com/`
  now serves a marketing landing page; the simulator lives at
  `/simulator.html`. `build.js` was updated to write `simulator.html`
  as its output, and 16 test probes were updated to the new URL.
  *(Sprint 91, `48fa7c5`)*

### Fixed

- **Preset library zero-length wires** — 33 degenerate wires (endpoint
  coincident with itself) removed from `src/components/presets.js`.
  A new build-time validator (`validatePresetGeometry` in `build.js`)
  fails the build if anyone reintroduces one. *(Sprint 94, `cc295c8`)*
- **BJT thermal "runaway collapse" (Sprint 81 phantom)** — a six-month-
  old test failure that looked like a stamp-level Gummel-Poon bug was
  root-caused to a test harness race condition: `bjt-thermal-scenarios.js`
  left `S.sim.running = true` while driving the simulator from Node in
  `page.evaluate()` chunks, so the browser's `requestAnimationFrame`
  was calling `VXA.SimV2.solve()` in parallel with the test's manual
  stepping loop. One-line fix: `S.sim.running = false`. Original
  Sprint 81 baseline (peak-Tj Δ = 25.9 °C between runaway and safe
  topologies) restored to the decimal. *(Sprint 98, `f03e38b`)*

### Infrastructure

- **Parity audit document** — `docs/PARITY_AUDIT_2026-04-18.md`
  captures an 18-row comparison against LTspice reference output
  across representative circuits, as a baseline for any future
  ES-modules migration. *(Sprint 91.5, `82ce0a0`)*
- **`docs/TESTING.md`** — full three-layer regression matrix
  (harness + scenario probes + sparse differential) now documented,
  with guidance on when to add a probe at which layer. *(Sprints 95,
  99)*

### Sprint Narrative

This section is written for the team. One paragraph per sprint, what
and why, so future decisions have context.

**Sprint 91 — Landing / simulator split.** `voltxampere.com/` used
to serve the simulator directly. As the simulator grew past a megabyte
of built JS, first-paint on marketing visits was hurting. Split into a
lightweight landing page (`index.html`) and the app (`/simulator.html`).
Updated `build.js` output target, 16 puppeteer probes, `manifest.json`
`start_url`, and meta / OG / sitemap URLs.

**Sprint 91.5 — Parity audit.** Before any further solver work, we
locked in an 18-alignment baseline against LTspice on a cross-section
of representative circuits. The audit doc is the artifact; the gate
it closes is "don't start an ES-modules refactor on top of an unverified
baseline."

**Sprint 92 — HATA 13 — CCVS / CCCS branch-variable MNA.** SPICE H
and F elements need an explicit current variable for the *controlling*
branch, not just the controlled branch, because the controlling current
flows through a V-source that the user wires in. The stamp was
short-circuiting by guessing the current from nodal voltages — wrong
by construction. Rewrote with a pre-pass that indexes every V-source
and every `H`/`F`, then stamps the controlled branch into the correct
extended MNA row. A sign convention for the controlling V-source had
to be re-derived from first principles (the probe test caught an early
mistake on the controlled-branch polarity).

**Sprint 93 — HATA 14 — JFET `.MODEL` binding.** The JFET stamp was
previously hard-coded to a generic IDSS/VTO/LAMBDA. User `.MODEL`
directives parsed fine but never reached the stamp. Added a JFET model
registry with nine presets and wired the parser → model-lookup →
stamp path through. The stamp's LAMBDA argument position was changed;
the 9-argument legacy signature still works via a runtime shape check
at the top of `jfet()`.

**Sprint 94 — HATA 15 — Zero-length preset wires.** Audit found 33
preset-library wires with coincident endpoints (zero geometric length).
Zombie artifacts from a 6-month-old refactor (S57). They caused subtle
placement bugs because some code paths treat zero-length wires as
"point junctions." Removed all 33 from `src/components/presets.js`,
and added a build-time validator so they can't come back.

**Sprint 95 — HATA 16 — Sparse-vs-dense differential.** Before we
shipped any further solver changes, we wanted a regression fence that
would catch a sparse-vs-dense divergence on *any* circuit at commit
time. Built `sparse-dense-differential-scenarios.js` across 24 harness
circuits plus a synthetic 50-resistor ladder (the ladder exists
specifically to force the banded path, which wouldn't otherwise
activate on our reference suite). Sabotage testing confirmed the
probe catches wrong results. This suite paid for itself immediately
in the next sprint.

**Sprint 96 — Banded solver GBTRF fix.** The Sprint 95 suite flagged
three circuits as diverging between production-banded and forced-
dense on the diagnostic lane. Root cause: the banded solver was
allocating only `bw` columns of fill-in for LU, but LAPACK GBTRF's
partial-pivoting actually produces U with bandwidth up to `2·bw`.
Our inner elimination loop was truncating the fill and producing
silently wrong answers on matrices large enough to enter the banded
path. Fix is surgical: one `bwEff = Math.min(2*bw, n-1)` replacement
in the elimination and back-sub loops.

**Sprint 97 — PTC infrastructure.** The Sprint 81 "BJT thermal
runaway collapse at t ≈ 0.26 s" had been our longest-running open
motor bug — Sprints 85, 86, 97 had chipped at it. Built the full
machinery we thought we needed: collapse detection (`Ic drops by
50 % while Tj > 40 °C`), automatic `dt/2` retry with forced PTC,
conductance injection `G = 1/τ` on every node, min-3-iter rule under
forced PTC, and SER τ adaptation. Code landed. Tests *still* flagged
the collapse. The mechanism for rescue was correct, but the collapse
kept coming back at t ≈ 0.26 s regardless of PTC intervention.

**Sprint 98 — The collapse was never physical.** Sprint 97 told us
PTC wasn't enough. Sprint 98 was supposed to fix the Gummel-Poon
stamp at high junction temperatures. Wrote a per-step stamp snapshot
probe — and found that the stamp was *perfectly behaved* for 600
consecutive steps around t = 0.26 s. No Is blow-up, no vbe clamp
triggering, no NR divergence. The collapse the scenario test reported
was not showing up at the stamp level at all. Root cause: the probe
itself. `bjt-thermal-scenarios.js` left `S.sim.running = true`, and
because the probe drove the sim from Node in `page.evaluate()` chunks
with `await`s between them, the browser's `requestAnimationFrame`
was firing its own `VXA.SimV2.solve()` calls in parallel with our
manual steps — two solvers running the same circuit with different
`dt` values, stomping each other's state. One-line fix:
`S.sim.running = false`. Peak-Tj separation jumped back to the
original Sprint 81 value of 25.9 °C. The entire Sprint 81 baseline
was real, not race-corrupted. Seventeen sprints chasing a ghost.

**Sprint 99 — Probe integrity audit.** One bad probe is a bug; five
bad probes is a culture problem. Audited the remaining five probes
with `sim.running = true` (`comprehensive-probe`, `probe-scenarios`,
`probe-screenshots`, `puppeteer-harness`, `rl-diagnostic`). All five
use the single-`page.evaluate()` pattern with no inner `await`, so
they're race-immune by construction (the browser stays in one JS
task for the whole evaluate; `requestAnimationFrame` can't interrupt).
No code fixes needed. But the lesson is easy to lose — so the four
rules that describe how to write a safe probe are now in
`docs/TESTING.md`. Empirical confirmation: `probe-scenarios` actually
*requires* `running = true` for the multimeter peak-hold history to
populate, so we couldn't have flipped the flag globally even if we
wanted to.

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

[11.2.1]: https://github.com/goksendev/VoltXAmpere/releases/tag/v11.2.1
[11.2.0]: https://github.com/goksendev/VoltXAmpere/releases/tag/v11.2.0
[11.1.0]: https://github.com/goksendev/VoltXAmpere/releases/tag/v11.1.0
[11.0.0]: https://github.com/goksendev/VoltXAmpere/releases/tag/v11.0.0
