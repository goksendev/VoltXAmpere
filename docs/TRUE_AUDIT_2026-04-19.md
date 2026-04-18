# TRUE AUDIT — Sprint 101

**Date:** 2026-04-19
**Scope:** VoltXAmpere v11.1.0 (commit `93c36c0`, tag `v11.1.0`)
**Auditor:** Zenco (Claude Code) under Sprint 101 directive
**Methodology:** Pure read-only audit. Zero production code changes. All
findings severity-tagged with evidence paths, reproduction commands, and
recommended disposition for Sprint 102+.

---

## Executive Summary

The regression fences (`npm test` 11/11, `npm run scenarios` 14/14,
`npm run test:sparse` 25/25) are real — the solver produces the right
answer on the circuits they cover. But the audit uncovered a
**CRITICAL silent-correctness bug in the preset-build path** that is
not caught by any of them: 23 of the 24 preset circuits that use two
or more ground symbols fail to unify all grounds to node 0, causing
orphan floating nets. Only one preset (`rl`) diverges visibly; the
other 22 produce quietly wrong results.

The root cause is a single `break` in `src/engine/sim-legacy.js:91` that
stops ground detection after the first ground symbol. Every preset with
≥ 2 grounds that relies on both grounds for connectivity is affected.
Our standard scenario probes never touch `loadPreset()`; they bypass
the preset path entirely via SPICE netlist import, which is why the bug
has lived through at least Sprints 70 → 100 undetected.

Secondary findings:

- **9 test probes in `src/test-spice/` are not exercised by any npm
  script.** One of them (`test-harness.js`, 264 lines, no refs) is
  fully orphaned. Seven are diagnostic/screenshot tools, useful on
  demand but sometimes conflated with assertive tests.
- **Documentation / About dialog claims are mostly conservative and
  truthful** — actual counts match or beat claims for components
  (71 = 71), presets (55 = 55), and models (82 ≥ 78+). One minor drift:
  About dialog says "16 Analysis Tabs" but 17 tab IDs exist in
  `src/index.html`.
- **Physics debts noted in S98/S99 are real but consciously deferred:**
  BSIM3 TNOM is static (no runtime T coupling in stamp), LED V_F(T) is
  intentionally uncoupled per Sprint 84 comment, Zener BV has no
  temperature coefficient. None of these cause wrong answers at room
  temperature; they are accuracy debts flagged for future sprints.
- **Sparse solver scales to 1000-node ladders** with correct results
  and sub-30ms solve times. Build time (`buildCircuitFromCanvas`) is
  the dominant cost at that size (234 ms) — a practical bottleneck
  for circuits over ~2000 nodes, but not a correctness bug.

**Biggest surprise (Sprint 98 echo):** `npm run scenarios` has never
been able to catch the multi-ground preset bug because no scenario
calls `loadPreset()`. Every scenario uses `VXA.SpiceImport.parse()`.
The preset path and the SPICE import path are two separate build
lanes, and our entire test pyramid lives on the SPICE lane.

**Recommended Sprint 102 focus:** (1) Fix `sim-legacy.js:91` by
unioning all ground pin nodes instead of picking the first; (2) add
a scenario probe that calls `loadPreset()` for every ID and asserts
DC OP convergence + sane voltages; (3) convert `test-harness.js` to
either a proper CI probe or delete it.

---

## Findings by Severity

### 🔴 CRITICAL (2)

- **[F-001]** — `sim-legacy.js:91` break-after-first-ground unifies only
  the first ground symbol; other grounds become floating nets.
  (§ 3.4)
- **[F-002]** — 23 of 24 multi-ground presets in the library ship
  with ground symbols mapped to different nodes, silently wrong
  at DC/transient. Only `rl` diverges visibly.
  (§ 3.5)

### 🟠 HIGH (3)

- **[F-010]** — 9 probes in `src/test-spice/` are not invoked by any
  npm script. `test-harness.js` (264 lines) has zero references.
  (§ 2.3)
- **[F-011]** — `loadPreset()` path has no test coverage. The preset
  library is shipped to every user but never exercised by CI.
  (§ 3.1)
- **[F-012]** — `preset-functional-results.jsonl` shows 1 of 55 presets
  (`rl`) fails to complete a 200-step transient at default dt. Visible
  surface of F-002.
  (§ 3.3)

### 🟡 MEDIUM (3)

- **[F-020]** — BSIM3 stamp uses static `p.TNOM` with no runtime
  junction-T coupling (`src/engine/bsim3.js:55`). Sprint 83 coupled
  Level-1 MOSFET thermally; BSIM3 was not backported.
  (§ 4.3)
- **[F-021]** — LED V_F(T) uncoupled by design (S84 comment at
  `src/engine/sim.js:434`). No per-color bandgap either. Acceptable
  at room temp; inaccurate in thermal-runaway contexts for LED-based
  sense circuits.
  (§ 4.4)
- **[F-022]** — Zener breakdown-voltage temperature coefficient not
  modelled. Stamp uses static `params.BV`
  (`src/engine/stamps-enhanced.js:19`). Silicon zeners flip TC sign
  around 5-6 V — unmodelled.
  (§ 4.5)

### 🟢 LOW (4)

- **[F-030]** — About dialog (line 55) advertises "16 Analysis Tabs";
  `src/index.html` contains 17 distinct `data-tab` attributes.
  Cosmetic drift.
  (§ 5.3)
- **[F-031]** — Briefing mentions "20/20 SPICE prefixes"; `spice-import.js`
  actually handles 21 (B, C, D, E, F, G, H, I, J, K, L, M, O, Q, R, S,
  T, V, W, X, Y). Off by one in either direction depending on how Y is
  counted (it's a bespoke "custom" prefix).
  (§ 5.4)
- **[F-032]** — About dialog says "78+ SPICE Models"; the actual count
  is 82. The "+" makes the claim non-contradictory, but docs should
  catch up.
  (§ 5.2)
- **[F-033]** — Sparse solver dispatcher switches to banded at n > 30,
  but measurement shows dense is competitive or faster up to n ≈ 250
  on the synthetic ladder family. Threshold may be set too low.
  Not a correctness bug.
  (§ 4.2)

---

## 1. Dark Period Reconnaissance (Sprint 69-90)

### 1.1 Scope

Examined every commit between the Sprint 68 tip (`2dfada2`) and the
v11.0.0 release tag (`71cd40f`) — **34 commits** spanning Sprint 69
through Sprint 89 plus the packaging commit. Evidence in
`/tmp/audit/dark-period-commits.txt`.

### 1.2 Commit distribution

```
Sprint 69       → 1 commit  (12 bug-fix audit)
Sprint 70 a-h   → 13 commits (routing + current visualisation + thermal audit)
Sprint 71-76    → 6 commits
Sprint 77-80    → 4 commits (RL sign fix, Bode AC-MNA, probe, tutorial)
Sprint 81-89    → 9 commits (thermal-electrical coupling chain)
Packaging       → 1 commit (v11.0.0 release)
```

### 1.3 Churn metric (top 10 files touched)

```
  32 index.html                                    (landing/simulator merged until S91)
  32 dist/index.html                               (build output)
  30 src/test-spice/screenshots/06-opamp-buffer-v2.png
  29 src/test-spice/screenshots/07-555-astable-v2.png
  29 src/test-spice/screenshots/04-diode-bridge-v2.png
  17 src/engine/sim.js
  11 src/models/spice-import.js
   9 src/test-spice/puppeteer-harness.js
   5 src/io/spice-router.js
   5 src/io/spice-layout.js
```

The bulk of churn is the solver (`src/engine/sim.js`, 17 touches) and
SPICE import (`src/models/spice-import.js`, 11 touches). The screenshot
churn is expected (harness regenerates them per run).

### 1.4 Tests added / deleted

- **83 test-related files added** across the 34 commits. Evidence:
  `/tmp/audit/dark-period-tests-added.txt`.
- **0 tests deleted.** Evidence: `/tmp/audit/dark-period-tests-deleted.txt`.

No test coverage was lost during the dark period. The test surface
grew alongside features — 14 scenario probes, 11 reference circuits,
numerous diagnostic tools.

### 1.5 Tech-debt files introduced but not wired up

See § 2.3 below — 9 probes added during the dark period have no entry
in `package.json` scripts.

---

## 2. Test Probe Integrity Audit

### 2.1 Scope

Examined every `.js` file under `src/test-spice/` — **24 files
total** (vs Sprint 99 which audited 5). Evidence:
`/tmp/audit/all-probes.txt`, `/tmp/audit/probe-evaluate-pattern.txt`.

### 2.2 S98 race-condition pattern scan

Risk criterion: `sim.running = true` + multiple `page.evaluate()`
blocks + `await`s between them. Result:

| Probe | evals | awaits | run=T | run=F | verdict |
|-------|------:|-------:|------:|------:|---------|
| banded-matrix-dump.js | 1 | 5 | 0 | 2 | ✓ race-immune (no running=true) |
| bjt-collapse-diagnostic.js | 4 | 6 | 0 (in live code; 1 is in comment) | 1 | ✓ explicit running=false, S98-era fix present |
| bjt-saturation-scenarios.js | 3 | 6 | 0 | 2 | ✓ race-immune |
| bjt-stamp-snapshot.js | 3 | 6 | 0 | 1 | ✓ race-immune |
| bjt-thermal-scenarios.js | 4 | 5 | 0 (in live code) | 2 | ✓ S98 fix present |
| bode-nyquist-bench.js | 1 | 3 | 0 | 0 | ✓ single-evaluate |
| comprehensive-probe.js | 1 | 3 | 1 | 0 | ✓ single-evaluate (race-immune by Rule 2) |
| controlled-source-scenarios.js | 1 | 4 | 0 | 1 | ✓ single-evaluate |
| curie-derating-scenarios.js | 3 | 6 | 0 | 1 | ✓ race-immune |
| diode-thermal-scenarios.js | 1 | 4 | 0 | 1 | ✓ single-evaluate |
| eddy-frequency-scenarios.js | 3 | 6 | 0 | 1 | ✓ race-immune |
| hysteresis-scenarios.js | 3 | 6 | 0 | 1 | ✓ race-immune |
| inductor-saturation-scenarios.js | 3 | 6 | 0 | 3 | ✓ race-immune |
| jfet-model-scenarios.js | 1 | 4 | 0 | 1 | ✓ single-evaluate |
| mosfet-thermal-scenarios.js | 3 | 6 | 0 | 3 | ✓ race-immune |
| nyquist-screenshot.js | 2 | 4 | 0 | 0 | ✓ no sim interaction |
| preset-geometry-scenarios.js | 2 | 4 | 0 | 0 | ✓ no sim interaction |
| probe-scenarios.js | 1 | 4 | 2 | 2 | ✓ single-evaluate (toggles inside) |
| probe-screenshots.js | 1 | 4 | 2 | 2 | ✓ single-evaluate |
| puppeteer-harness.js | 2 | 4 | 2 | 2 | ✓ running=true/false paired within evaluates |
| rl-diagnostic.js | 1 | 3 | 1 | 0 | ✓ single-evaluate (Rule 2) |
| sparse-dense-differential-scenarios.js | 1 | 4 | 0 | 1 | ✓ race-immune |
| test-harness.js | 0 | 0 | 0 | 0 | **✗ not a probe (orphan — see § 2.3)** |
| tutorial-scenarios.js | 15 | 29 | 0 | 0 | ✓ UI-only, does not drive sim |

**Verdict:** All 23 active probes are race-safe. The S98 doctrine held
across the broader audit. No new F-### finding from this pass.

### 2.3 Probe-to-CI reachability  [F-010 / HIGH]

npm scripts in `package.json` exercise 14 `*-scenarios.js` files +
`puppeteer-harness.js` + `sparse-dense-differential-scenarios.js`. The
remaining **9 probes are not in any CI suite**:

```
banded-matrix-dump.js          diagnostic (S96 banded solver dump)
bjt-collapse-diagnostic.js     diagnostic (S97-S98 NR collapse)
bjt-stamp-snapshot.js          diagnostic (S98 Gummel-Poon snapshot)
bode-nyquist-bench.js          added S78, never wired into npm
comprehensive-probe.js         race-audited in S99 but unreachable in CI
nyquist-screenshot.js          screenshot generator
probe-screenshots.js           screenshot generator
rl-diagnostic.js               diagnostic (RL sign work)
test-harness.js                orphan — see below
```

**Evidence:** `/tmp/audit/orphan-probes.txt`,
`grep -rn "test-harness" --include="*.{js,json,md}" ~/Desktop/VoltXAmpere`
returns **zero hits**.

**Impact:** Diagnostic tools are fine as manual instruments, but their
presence alongside assertive tests could mislead a reader into assuming
"there's a probe for X" when X is only dumped, never asserted.

**Disposition:** Sprint 102: (a) audit each of the 9 to decide keep-as-diag
or promote-to-CI; (b) delete `test-harness.js` or resurrect it as a
valid scenarios file.

### 2.4 Assertion strength

Scan across 24 files for explicit PASS/FAIL logging, `process.exit`,
and `throw` patterns. Evidence:
`/tmp/audit/probe-assertion-strength.txt`.

- 14 scenario probes: explicit PASS/FAIL prints paired with process
  exit via npm's `|| exit 1` chain. Good hygiene.
- `sparse-dense-differential-scenarios.js`: uses `process.exit(allPass
  ? 0 : 1)`. Good.
- 9 non-CI probes: zero PASS/FAIL printing, zero exit-code assertion.
  They are dumpers, not validators. This is by design for the 8 named
  diagnostics, but `test-harness.js` has no PASS/FAIL and is clearly
  abandoned.

---

## 3. Preset Library Functional Verification

### 3.1 Scope

55 preset IDs extracted from `src/components/presets.js`, each loaded
into a headless Chromium via `loadPreset(id)`, built, and exercised
with DC OP + 200-step transient. Evidence:
`/tmp/audit/preset-functional.txt`,
`/tmp/audit/preset-functional-results.jsonl`.

The preset library is shipped to every user but **has zero coverage
in CI.** `npm run scenarios` only runs probes that go through
`VXA.SpiceImport.parse()`, which is a different build lane.
**[F-011 / HIGH]**

### 3.2 Geometry audit

Extended from Sprint 94's zero-length check. Evidence:
`/tmp/audit/preset-geometry.txt`.

```
Presets found:          55 / 55 (matches About dialog claim)
Duplicate IDs:          0
Missing id/name/parts/wires: 0
Missing desc/formula/color:  0
Zero-length wires:      0 (S94 validator holding)
Sub-pixel wires (<2px): 0
Overlapping components: 0
```

(An "orphan-pin" heuristic flagged 42/55 presets, but the heuristic
does not account for 3-pin transistors, direct pin-to-pin contacts
that skip an explicit wire, or ground pin offsets. These 42 are not
findings; disposition: refine the heuristic in a later sprint if
desired.)

### 3.3 Functional behaviour

Aggregate across 55 presets, 200 transient steps at dt = 1e-5:

```
OK:                   54 / 55
Load failures:        0
Build failures:       0
DC OP failures:       0
Transient NaN hits:   0
Transient early-exit: 1   ← preset 'rl' diverges at step 6
```

**[F-012 / HIGH]** `rl` preset fails with
`Simülasyon ıraksadı: node 3 = -8.15e+6` at step 6.

Same circuit topology (V=5V, R=1kΩ, L=1mH, τ=1µs) imported via SPICE
netlist `src/test-spice/14-rl-decay.cir` passes the puppeteer harness
at dt=1e-7 and dt=1e-6. Tested across dt = 1e-5, 1e-6, 1e-7, 6.67e-7
**via preset path: all four diverge.** Evidence:
`/tmp/audit/rl-preset-reverify.txt`.

Not a solver bug — a preset-build bug. See §§ 3.4 and 3.5.

### 3.4 Root cause — `sim-legacy.js:91` early break  [F-001 / CRITICAL]

**Location:** `src/engine/sim-legacy.js`, lines 88-93.

**Code:**
```javascript
// 3. Ground detection — find ground node root
let groundRoot = -1;
for (let i = 0; i < S.parts.length; i++) {
  if (S.parts[i].type === 'ground' || S.parts[i].type === 'gndLabel') {
    groundRoot = uf.find(partPinNodes[i][0]);
    break;   // ← bug: only first ground becomes node 0
  }
}
```

The loop exits on the **first** ground symbol. `groundRoot` is then
set to that ground's union-find root. Only nodes that happen to share
a UF set with the first ground get remapped to node 0. Any
subsequent ground symbol whose pin ended up in a different UF set
stays as a separate canonical node — effectively a floating net.

**Evidence:** `/tmp/audit/rl-preset-topology.txt`:

```json
"pinToNode": {
  "-60,-40": 1,     ← V+
  "-60,40":  0,     ← V- (unified with first ground GND1)
  "-60,60":  0,     ← GND1 pin
  "140,40":  3,     ← L's bottom pin — FLOATING
  "140,60":  3      ← GND2 pin — should be 0, is 3
}
```

SIM.N = 4 (node 0 ground + nodes 1, 2, 3) instead of the expected 3.
The inductor's bottom terminal becomes a pure integrator against a
floating node ⇒ divergence.

**Hypothesis:** The original author intended "find any ground symbol
to fix node 0's identity", assuming all grounds would already be in
the same UF set via wires. This is true for presets with a common
ground rail, but false for presets where each ground symbol is
locally wired (the common case in the preset library).

**Reproduction:**
```bash
cd ~/Desktop/VoltXAmpere
python3 -m http.server 8765 &
node /tmp/audit/rl-preset-topology.js
# pinToNode will show two different node indices for the two ground pins
```

### 3.5 Extent — 23 of 24 multi-ground presets affected  [F-002 / CRITICAL]

**Evidence:** `/tmp/audit/multi-ground-full.txt`.

| preset | grounds | ground nodes | visible behaviour |
|--------|--------:|-------------:|-------------------|
| rclp           | 2 | [0, 3]    | all voltages 0 (source node floating) |
| halfwave       | 2 | [0, 3]    | silently wrong |
| **rlc**        | 2 | **[0]**   | **✓ works** (both grounds share bottom rail wire) |
| rl             | 2 | [0, 3]    | diverges at step 6 |
| npn-sw         | 2 | [0, 6]    | silently wrong |
| cmos-inv       | 2 | [0, 5]    | silently wrong |
| inv-opamp      | 2 | [0, 4]    | silently wrong |
| noninv-opamp   | 2 | [0, 6]    | silently wrong |
| vreg-7805      | 3 | [0, 3, 5] | partially wrong |
| logic-demo     | 2 | [0, 6]    | silently wrong |
| dep-src        | 2 | [0, 3]    | silently wrong |
| dc-sweep-led   | 2 | [0, 3]    | silently wrong |
| bode-rc        | 2 | [0, 3]    | silently wrong |
| jfet-cs        | 2 | [0, 6]    | silently wrong |
| scr-phase      | 2 | [0, 4]    | silently wrong |
| param-sweep-rc | 2 | [0, 3]    | silently wrong |
| fft-square     | 2 | [0, 2]    | silently wrong |
| dff-toggle     | 2 | [0, 4]    | silently wrong |
| lissajous      | 2 | [0, 5]    | silently wrong |
| dc-motor       | 2 | [0, 3]    | silently wrong |
| bridge-rect    | 2 | [0, 7]    | silently wrong |
| sallen-key     | 2 | [0, 4]    | silently wrong |
| ldr-led        | 2 | [0, 3]    | silently wrong |
| trafo-demo     | 2 | [0, 3]    | silently wrong |

**23 / 24** multi-ground presets have their ground symbols mapped to
**different** node indices. Only `rlc` survives because its schematic
includes an explicit bottom rail wire (`y=60` across both sides) that
forces union-find to merge the two ground pins before ground detection
runs.

Spot-check on `rclp` (AC low-pass, 2 grounds):

```json
"rclp": { "N": 4, "dcVoltages": [0, 0, 0, 0], "finalVoltages": [0, 0, 0, 0] }
```

All voltages zero because the AC source's reference terminal is at
node 3, not node 0. The "simulation" runs, but the circuit is
electrically broken.

**Impact:** Every preset in the above list that a user loads will
render wrong voltages, wrong currents, wrong scope waveforms. Because
the numbers are finite (not NaN), no error message fires. This is the
worst class of bug: silent, confident, wrong.

**Recommended disposition:** Sprint 102 top priority. The fix is a
2-line replacement of the `break` loop with a union loop over all
ground pins. Regression guard: add `preset-functional-scenarios.js`
probe that loads every preset, asserts all ground pins map to node 0,
and asserts DC OP voltages are not uniformly zero on circuits with a
non-zero source.

---

## 4. Physics Stress Test Results

### 4.1 Scope

Targeted measurements on devices and solver paths outside the current
regression fence. Evidence:
`/tmp/audit/sparse-scaling.txt`,
`/tmp/audit/boost-stiff.txt`,
`/tmp/audit/physics-grep.txt`.

### 4.2 Sparse solver size scaling  [F-033 / LOW]

Synthetic resistor ladder (V-source through N series resistors to
load) at N = 50, 100, 250, 500, 1000:

| n | SIM.N | build (ms) | prod solve (ms) | forced-dense solve (ms) |
|--:|------:|-----------:|-----------------:|-------------------------:|
|   50 |   52 |   2.0 |  2.60 |  1.00 |
|  100 |  102 |   4.3 |  3.30 |  0.60 |
|  250 |  252 |  13.8 |  2.40 |  2.10 |
|  500 |  502 |  55.2 |  8.20 |  8.10 |
| 1000 | 1002 | 234.1 | 28.90 | 25.40 |

**Correctness:** All 5 sizes solve successfully with identical voltages
(verified via `prod-ok=true dense-ok=true`). No silent divergence,
no NaN, sparse-vs-dense parity holds — consistent with
`npm run test:sparse`.

**Performance observation:** Forced-dense is competitive or
**slightly faster** than the production dispatcher path at every size
tested. The Sprint 95 banded-at-`n>30` threshold may be set too
aggressively. Not a correctness issue; a performance-tuning
opportunity.

**Build-time dominance:** `buildCircuitFromCanvas()` takes 234 ms at
n = 1000 vs 29 ms to solve — build is O(n²-ish), solve is O(n) for
the banded path. For circuits above ~2000 nodes (not tested today) the
build step becomes the interactive bottleneck.

### 4.3 BSIM3 thermal coupling  [F-020 / MEDIUM]

**Location:** `src/engine/bsim3.js:55`.

```javascript
var T = p.TNOM || 300.15;
```

BSIM3 reads the TNOM parameter from the model at evaluation, but
there is no path that updates T from the part's `_thermal` struct.
Sprint 83 coupled Level-1 MOSFET stamps to `_thermal.T`; the same
wiring was not backported to BSIM3.

**Impact:** BSIM3 MOSFETs do not exhibit thermal-electrical feedback.
Vth(T) and mobility-µ(T) drifts are computed against static TNOM.
Scenario suites do not exercise BSIM3 specifically (the MOSFET thermal
scenarios drive Level-1). Below T_max, results are physically
reasonable; at the edge of the operating envelope or in a sustained
self-heating circuit, results will drift from reality.

**Disposition:** Sprint 103+ (after the critical ground fix lands).
The stamp-to-thermal wiring already exists for Level-1 and can be
adapted with ~30 lines.

### 4.4 LED V_F(T) and per-color bandgap  [F-021 / MEDIUM]

**Location:** `src/engine/sim.js:434-461`.

Sprint 84 comment explicitly defers LED thermal coupling:

```javascript
// Sprint 84: feed junction temperature into the stamp. LEDs
// are intentionally NOT coupled — their V_F(T) obeys
// material-specific laws that the silicon bandgap model
// can't fake; deferred to a future LED-thermal sprint.
```

The stamp hardcodes `dTjPass = 300` for `type === 'led'`, forcing LEDs
to isothermal behaviour. Silicon-diode bandgap (Eg = 1.12 eV default)
is used uniformly for non-LED diodes; per-color Eg (GaAs 1.4 eV red,
GaN 3.4 eV blue) is not modelled.

**Impact:** In the preset library, `led`, `dc-sweep-led`, `ldr-led`
and any pass-through LED usage will show temperature-invariant V_F.
This is an acknowledged debt, not a regression.

**Disposition:** Sprint 104+ or dedicated LED-thermal sprint.

### 4.5 Zener breakdown TC  [F-022 / MEDIUM]

**Location:** `src/engine/stamps-enhanced.js:19-34`.

```javascript
var BV = params.BV || 100, CJO = ..., VJ = ..., M = ..., TT = ...;
```

No `dBV/dT` coefficient. Silicon zeners transition TC sign around
BV ≈ 5-6 V (positive-TC avalanche above, negative-TC tunnel below);
this transition is not modelled.

**Impact:** `zener-reg` preset at sustained current shows constant BV
regardless of self-heating. Accuracy debt, not a wrong-answer bug.

**Disposition:** Sprint 104+.

### 4.6 Boost converter (S68 stiff regression)

**Test:** `src/test-spice/10-boost-converter.cir` via SPICE import,
1000 steps at dt = 1e-6.

```
steps: 1000
anyNaN: false
error: null
finalV: [0, 5, 4.938, 0, 4.116]
```

Completes without NaN or divergence. Sprint 68 stiff-circuit fix
still holds. No finding.

---

## 5. Documentation vs Reality

### 5.1 Component count  ✓

- README claim: "71+ components"
- About dialog (line 8): "71+ Components"
- Actual `COMP` registry in `src/components/definitions.js`: **71**
- Verdict: exact match. No finding.

Evidence:
`awk '/^var COMP = \{/,/^\};/' src/components/definitions.js | grep -cE "^[[:space:]]+[a-zA-Z0-9_]+:"` → 71.

### 5.2 Model count  [F-032 / LOW]

- About dialog (lines 9, 65): "78+ SPICE Models"
- Actual registry entries in `src/models/models.js`: **82**
- Verdict: claim is truthful (82 ≥ 78+). Claim is just stale — the
  "+" makes it non-contradictory but docs should catch up.

### 5.3 Analysis tab count  [F-030 / LOW]

- About dialog (line 55): "16 Analysis Tabs"
- Actual `data-tab="..."` count in `src/index.html`: **17**

Actual tabs:
```
bode, commands, contour2d, dcsweep, fft, montecarlo, noise, nyquist,
paramsweep, polezero, scope, sensitivity, sparam, tempsweep, timing,
transferfunc, worstcase
```

### 5.4 SPICE prefix support  [F-031 / LOW]

- Briefing: "20/20 SPICE prefixes"
- Actual branches in `spice-import.js`:
  `B, C, D, E, F, G, H, I, J, K, L, M, O, Q, R, S, T, V, W, X, Y` → **21**.

Y is a bespoke/custom prefix; if you exclude it, 20 standard SPICE
prefixes are handled, which matches the briefing. Minor wording
ambiguity.

### 5.5 Preset count  ✓

- About dialog: "55 Preset Circuits"
- Actual `id:` entries in `presets.js`: **55**
- Verdict: exact match.

### 5.6 Interactive tutorials

- About dialog: "25 Lessons × 24 Quiz × 5 Levels"
- Source files:
  - `src/ui/tutorials-basic.js` (237 lines)
  - `src/ui/tutorials.js` (189 lines)
  - `src/ui/tutorials-extended.js` (394 lines)

Per-file `lesson:` / structured-entry counts from the grep heuristic
did not return clean numbers (the files use varied object keys). Not
a finding; would need a lesson-counting script to validate. Deferred
to a later doc sync.

### 5.7 i18n coverage

`src/core/i18n.js` is 349 lines with **246** key entries. Sample
hard-coded string grep across `src/ui/*.js` shows many UI strings
still inlined (e.g. Turkish proverbs in `about.js` line 86). Not a
regression; a cosmetic debt tracked here for awareness. No severity
tag — this is standard i18n partial coverage.

---

## Appendix A — Evidence Files

All under `/tmp/audit/`:

**Block 1 (Dark Period Recon):**
- `dark-period-commits.txt` — 34 commits listed
- `dark-period-files.txt` — every file per commit
- `dark-period-churn.txt` — top 30 by edit count
- `dark-period-tests-added.txt` — 83 files
- `dark-period-tests-deleted.txt` — 0 files
- `current-probes.txt`, `orphan-probes.txt` — probe reachability

**Block 2 (Probe Audit):**
- `all-probes.txt` — 24 files
- `probe-evaluate-pattern.txt` — evals/awaits/running per file
- `probe-sim-running-audit.txt` — sim.running usage per file
- `probe-assertion-strength.txt` — PASS/FAIL/exit/throw scan

**Block 3 (Preset Audit):**
- `preset-geometry-audit.js` — extended geometry scan script
- `preset-geometry.txt` — geometry results
- `preset-functional-audit.js` — puppeteer functional runner
- `preset-functional.txt` — 55-preset test results
- `preset-functional-results.jsonl` — per-preset JSON detail
- `multi-ground-presets.js` / `.txt` — 24 presets with ≥ 2 grounds
- `multi-ground-correctness.js` / `.txt` — DC/transient voltage check
- `multi-ground-full-check.js` / `.txt` — ground-node mapping check
- `rl-preset-topology.js` / `.txt` — root-cause SIM topology dump
- `rl-preset-reverify.js` / `.txt` — dt-sweep of rl preset

**Block 4 (Physics Stress):**
- `gen-ladder.js` — ladder netlist generator
- `ladder-{50,100,250,500,1000}.cir` — synthetic ladders
- `sparse-scaling-audit.js` / `sparse-scaling.txt` — size scaling
- `sparse-scaling-results.json` — raw numbers
- `boost-stiff-regression.js` / `boost-stiff.txt` — S68 check
- `physics-grep.txt` — BSIM3 / LED / Zener source scan

**Block 5 (Docs vs Reality):**
- `docs-reality.txt` — consolidated counts

**Total evidence files:** 39 (well over the 12 required).

---

## Appendix B — Metrics Summary

| Metric | Value | Source |
|---|---:|---|
| Source JS files | 125 | build.js output |
| Source JS lines | 27,905 | build.js output |
| CSS lines | 423 | build.js output |
| Built simulator.html total | 29,120 | build.js output |
| Presets | 55 | grep preset IDs |
| Multi-ground presets | 24 | node script |
| Multi-ground presets with split ground node | 23 | node script |
| Components in COMP registry | 71 | awk /^var COMP = \{/ |
| SPICE model registry entries | 82 | grep entry count |
| Analysis tabs | 17 | grep data-tab |
| SPICE prefix handlers | 21 | grep ch === |
| Test probe files | 24 | find src/test-spice -name '*.js' |
| Probes invoked by npm scripts | 15 | audit |
| Probes not invoked by any npm script | 9 | audit |
| i18n key entries | 246 | grep |
| Dark-period commits | 34 | git log 2dfada2..71cd40f |
| Tests added during dark period | 83 | git log --diff-filter=A |
| Tests deleted during dark period | 0 | git log --diff-filter=D |

---

## Appendix C — Replication Commands

Copy-paste ready. Assumes repo at `~/Desktop/VoltXAmpere` and
Python 3 for the static server.

### Start dev server (required for puppeteer probes)
```bash
cd ~/Desktop/VoltXAmpere
python3 -m http.server 8765 &
```

### Block 1 — Dark period recon
```bash
mkdir -p /tmp/audit
cd ~/Desktop/VoltXAmpere
git log --oneline --reverse 2dfada2..71cd40f > /tmp/audit/dark-period-commits.txt
git log --name-only --format="=== %h %s ===" --reverse 2dfada2..71cd40f > /tmp/audit/dark-period-files.txt
git log --name-only --format="" --reverse 2dfada2..71cd40f | grep -v '^$' | sort | uniq -c | sort -rn | head -30 > /tmp/audit/dark-period-churn.txt
git log --diff-filter=A --name-only --format="" --reverse 2dfada2..71cd40f | grep -E "(test|scenario|probe)" | sort -u > /tmp/audit/dark-period-tests-added.txt
git log --diff-filter=D --name-only --format="" --reverse 2dfada2..71cd40f | grep -E "(test|scenario|probe)" | sort -u > /tmp/audit/dark-period-tests-deleted.txt
```

### Block 2 — Probe audit
```bash
cd ~/Desktop/VoltXAmpere
find src/test-spice -name "*.js" -type f | sort > /tmp/audit/all-probes.txt
for f in $(cat /tmp/audit/all-probes.txt); do
  count=$(grep -c "page\.evaluate" "$f")
  awaits=$(grep -cE "^[[:space:]]*await " "$f")
  runtrue=$(grep -cE "sim\.running[[:space:]]*=[[:space:]]*true" "$f")
  runfalse=$(grep -cE "sim\.running[[:space:]]*=[[:space:]]*false" "$f")
  printf "%-45s evals=%-3s awaits=%-3s run=T:%s F:%s\n" "$(basename $f)" "$count" "$awaits" "$runtrue" "$runfalse"
done > /tmp/audit/probe-evaluate-pattern.txt
grep -rn "test-harness" --include="*.{js,json,md}" ~/Desktop/VoltXAmpere  # should return nothing → orphan
```

### Block 3 — Preset audit
```bash
# Geometry scan (the audit script is checked into /tmp/audit/)
node /tmp/audit/preset-geometry-audit.js > /tmp/audit/preset-geometry.txt 2>&1
# Full functional audit (requires dev server up)
node /tmp/audit/preset-functional-audit.js > /tmp/audit/preset-functional.txt 2>&1
# Multi-ground mapping check
node /tmp/audit/multi-ground-full-check.js > /tmp/audit/multi-ground-full.txt 2>&1
# Root-cause inspection for the rl preset
node /tmp/audit/rl-preset-topology.js > /tmp/audit/rl-preset-topology.txt 2>&1
```

### Block 4 — Physics stress
```bash
node /tmp/audit/gen-ladder.js
node /tmp/audit/sparse-scaling-audit.js > /tmp/audit/sparse-scaling.txt 2>&1
node /tmp/audit/boost-stiff-regression.js > /tmp/audit/boost-stiff.txt 2>&1
```

### Block 5 — Docs vs reality
```bash
cd ~/Desktop/VoltXAmpere
# COMP count
awk '/^var COMP = \{/,/^\};/' src/components/definitions.js | grep -cE "^[[:space:]]+[a-zA-Z0-9_]+:\s*\{"
# Model count
grep -cE "'[a-zA-Z0-9_]+'\s*:\s*\{" src/models/models.js
# Tabs
grep -oE "data-tab=['\"][^'\"]+['\"]" src/index.html | sort -u | wc -l
# SPICE prefixes
grep -oE "(ch|_pCh)\s*===\s*'([A-Z])'" src/models/spice-import.js | sort -u
# Presets
grep -oE "\bid:'[^']+'" src/components/presets.js | wc -l
```

### Shutdown
```bash
pkill -f "python3 -m http.server 8765"
```

---

## End of report

**Status:** Sprint 101 complete. 2 critical findings, 3 high, 3 medium,
4 low. Follow-up spec sprints recommended:

- **Sprint 102:** Fix F-001 ground union bug + add preset-functional
  CI probe + resolve F-010 orphan probes / `test-harness.js`.
- **Sprint 103:** BSIM3 runtime-T backport (F-020).
- **Sprint 104:** LED V_F(T) per-color + Zener BV TC (F-021, F-022).
- **Ongoing:** Doc sync for model count, tab count, SPICE prefix
  phrasing.

No code changes introduced by this audit. `git status` shows only this
report file modified.
