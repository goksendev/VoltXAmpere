# VoltXAmpere Parity Audit — 2026-04-18

Sprint 91.5 — pre-migration inventory of build parity, dual-engine
structure, Sprint 69 open debts, and orphan code, ahead of the ES
modules migration planned for Sprint 92.

**Scope:** investigation only.  No behavioural changes to the simulator
in this sprint; test URLs were already updated in Sprint 91 for the
landing-page split.

---

## Bölüm 1 — Build Parity

Question: does `node build.js` recreate `simulator.html` byte-for-byte
from `src/`, or does the live simulator contain manual edits that are
not in the source tree?

### Method
```
$ node build.js                         # regenerate dist/index.html
$ diff simulator.html dist/index.html   # compare against live artefact
$ shasum simulator.html dist/index.html
```

### Result
- `diff` → **0 lines**
- `simulator.html` SHA1: `491f6760db2759599662b0f3e0d8c4e46d8b6d94`
- `dist/index.html` SHA1: `491f6760db2759599662b0f3e0d8c4e46d8b6d94`
- Line count: both 28841 lines

**Status: BUILD IS IDEMPOTENT.**

The root `simulator.html` is pure output of the concatenation of
`src/**/*.js` + `src/styles.css` into the `src/index.html` template.
No manual edits live outside `src/`.  Migration to ES modules can
rebuild confidently without risk of losing hand-patched simulator
code.

---

## Bölüm 2 — Dual Engine Parity

`src/engine/` contains two files whose names imply a legacy vs modern
split:

| file | size | top-level style | public surface |
| --- | --- | --- | --- |
| `src/engine/sim.js` | 64 KB | IIFE closure bound to `VXA.SimV2` | `solve()`, `findDCOperatingPoint()`, `getNRIter()`, `getConverged()`, `getNodeCount()`, `getBandwidth()`, `getSimMethod()`, `setSimMethod()`, `getCurrentGMIN()` |
| `src/engine/sim-legacy.js` | 29 KB | top-level function declarations in global scope | `UnionFind`, `buildCircuitFromCanvas`, `autoDetectDt`, `getAdaptiveSubsteps`, `parseSpiceModel`, `importSpiceModels`, `solveStep`, `simulationStep`, `resetSparseVerification` |

### Name-overlap

**Zero overlap** — the two files share no function names.  The split is
functional rather than versioned:

- `sim.js` owns the **inner MNA/NR solver** (stamps, LU, Newton step,
  adaptive damping, complex AC solve).
- `sim-legacy.js` owns the **outer simulation pipeline**: turning
  canvas parts into `SIM.comps`, detecting nodes via union-find,
  parsing `.MODEL` cards, choosing dt, driving the animation loop.

### Active usage of `sim-legacy.js`

Grep from `src/` (excluding `sim-legacy.js` itself) shows the
"legacy" functions are heavily called at runtime:

| function | non-self call sites |
| --- | --- |
| `buildCircuitFromCanvas` | **71** (every sweep, every import, every place-circuit path) |
| `simulationStep` | 5 (main render loop, commands tab, sim-speed wrapper) |
| `solveStep` | 6 (DC/temp/worst-case sweeps) |
| `importSpiceModels`, `parseSpiceModel`, `UnionFind`, `autoDetectDt`, `getAdaptiveSubsteps`, `resetSparseVerification` | internal but exercised on every .cir import |

**`sim-legacy.js` is NOT dead code.**  The filename is misleading —
the file is the simulation *orchestrator*, while `sim.js` (`VXA.SimV2`)
is the solver it drives.  Renaming it to something like
`sim-orchestrator.js` would be an accurate cleanup, but that is not
this sprint's scope.

### Dead-code estimate

No automated dead-code detection was run across all 126 build files;
given the clean build-parity result and the confirmed activity of
every `sim-legacy.js` export, no dead engine code is suspected.  A
future audit could run `rollup --config + tree-shake` analysis once
the ES modules conversion exposes real imports.

---

## Bölüm 3 — Sprint 69 Open Debts

The 17 April audit left four items unresolved.  Status today:

### HATA 13 — CCVS / CCCS branch-variable stamps

`src/engine/sim.js:415` stamps CCVS via a parasitic-conductance
approach:

```javascript
} else if (c.type === 'CCVS') {
  var rm = c.rm || 1000, gMeas = 0.1;
  St.stampG(matrix, c.ncP, c.ncN, gMeas);
  var gOut = 0.1;
  St.stampG(matrix, c.noP, c.noN, gOut);
  var vCtrl = (nodeV[c.ncP] || 0) - (nodeV[c.ncN] || 0);
  var iCtrl = vCtrl * gMeas, vTarget = rm * iCtrl;
  St.stampI(rhs, c.noP, gOut * vTarget);
  St.stampI(rhs, c.noN, -gOut * vTarget);
}
```

No branch-variable row is ever added to the MNA matrix for CCVS or
CCCS (`sim.js:423` uses the same `gMeas = 0.1` pattern).  A
SPICE-conformant implementation would augment the matrix with an
auxiliary equation `v_noP − v_noN − rm·i_branch = 0` and expose
`i_branch` as a column.

`src/engine/circuit-serializer.js:42` already counts CCVS/CCCS in
`branchTypes`, so the infrastructure for a branch row is scaffolded
but unused.

**Status: OPEN.**  Still parasitic-conductance approximation.

### HATA 14 — JFET custom `.MODEL`

`src/engine/sim-legacy.js:264`:

```javascript
else if (p.type === 'njfet') {
  comps.push({type:'JFET', polarity: 1, n1:nodes[0], n2:nodes[1],
              n3:nodes[2], Idss:0.01, Vp:-2, part:p});
}
else if (p.type === 'pjfet') {
  comps.push({type:'JFET', polarity:-1, n1:nodes[0], n2:nodes[1],
              n3:nodes[2], Idss:0.01, Vp: 2, part:p});
}
```

`Idss` and `Vp` are hard-coded.  `src/models/spice-import.js:171`
correctly identifies PJF vs NJF from `.MODEL` cards but the resolved
model object is discarded — its parameters never reach the component
record.

**Status: OPEN.**  Still hard-coded Idss = 10 mA, Vp = ±2 V
regardless of user-supplied `.MODEL` values.

### HATA 15 — Preset geometry

No `validatePresetGeometry()` function, no preset audit anywhere in
the tree (`grep` found only `validateLayout` in the test harness and
`validate` in the netlist editor, neither targeting presets).

Scan of `src/components/presets.js` for degenerate wires
(`x1 === x2 && y1 === y2`):

```
33 zero-length wires across 269 total preset wires — ~12%
```

Examples:
```
line 30: x1:140, y1:  0, x2:140, y2:  0   (seri-paralel direnç)
line 52: x1: 80, y1:  0, x2: 80, y2:  0
line 56: x1: 60, y1: 80, x2: 60, y2: 80
line 62: x1:-160,y1: 40, x2:-160,y2: 40
line 66: x1:-160,y1: 40, x2:-160,y2: 40    (duplicate of 62)
line 67: x1: 20, y1: 60, x2: 20, y2: 60
```

These degenerate wires don't render but still occupy a slot in the
preset's wire array.  They look like relics of hand-drawn
preset construction that was never cleaned up.

**Status: OPEN.**  33 degenerate wires remain; no audit function
prevents new ones from being introduced.

### HATA 16 — Sparse vs dense differential test

`src/test-spice/` has 17 JS files.  None of them exercise the sparse
solver against the dense solver for the same circuit:

```
$ grep -rn "useSparse\|verifySparse" src/test-spice/
(no matches)
$ ls src/test-spice/*sparse*
(no matches)
```

The runtime flag `_useSparse` exists (`sim-legacy.js:380
resetSparseVerification()`), and `sparse-fast.js` provides CSC+LU, but
no test ever flips the two solvers and asserts the node-voltage
vectors agree.

**Status: OPEN.**  Sparse path unverified against dense baseline.

### Summary
| debt | status | evidence |
| --- | --- | --- |
| HATA 13 — CCVS/CCCS branch-variable | **OPEN** | `sim.js:415,423` parasitic `gMeas=0.1` |
| HATA 14 — JFET custom model | **OPEN** | `sim-legacy.js:264-268` hard-coded Idss/Vp |
| HATA 15 — preset geometry | **OPEN** | 33 zero-length wires, no validator |
| HATA 16 — sparse differential test | **OPEN** | no test file exists |

All four Sprint 69 debts remain unresolved as of 2026-04-18.

---

## Bölüm 4 — Orphan Code Detection

### Manifest vs filesystem

```
$ grep -oE "'src/[^']+\.js'" build.js | tr -d "'" | sort -u | wc -l
126

$ find src -name "*.js" ! -path "*/test-spice/*" | sort | wc -l
126

$ comm -23 all-src.txt build-reads.txt
(empty)

$ comm -13 all-src.txt build-reads.txt
(empty)
```

**126 source files, 126 manifest entries, 0 orphans, 0 phantoms.**

Every JS file under `src/` (excluding `src/test-spice/` harness
scripts, as expected) is referenced by `build.js`.  Every manifest
entry maps to an existing file.

### Gitignore hygiene

```
node_modules/, voltix-engine/node_modules/, voltix-engine/dist/
.DS_Store, Thumbs.db
.vscode/, .idea/
.env, .env.*, .vercel
src.zip
src-backup-*/
```

- No build artefact (`simulator.html`, `dist/index.html`) is ignored.
- `src-backup-20260417/` is gitignored and unused by `build.js`.
- No `voltix-engine/` file is referenced from `src/`
  (separate experimental directory, safely isolated).

### Dead-code (conservative estimate)

No automated dead-function sweep performed.  The build-parity pass
plus the confirmed activity of every named `sim-legacy.js` export
suggest engine dead code is low; a full audit would require
tree-shaking the ES-module output that Sprint 92 will produce.

---

## Bölüm 5 — Migration Risk Assessment

| concern | assessment |
| --- | --- |
| Build idempotent? | **Yes** — byte-for-byte match with regenerated artefact |
| Source of truth clear? | **Yes** — every simulator byte originates in `src/` |
| Orphan files? | **None** — 126/126 manifest ↔ filesystem match |
| Dual-engine risk? | **Low, but mislabeled** — `sim-legacy.js` is not legacy; it is the orchestrator |
| Open behavioural debts? | **4 from Sprint 69**, none regressions of current behaviour |
| Code-loss risk in migration? | **LOW**, provided the ES modules refactor keeps both `sim.js` and `sim-legacy.js` call surfaces intact |

### Risks to manage during Sprint 92

1. **Do not delete `sim-legacy.js`** on the assumption the name
   implies dead code.  It is the live circuit-to-SIM bridge plus
   the animation driver.  Rename it, module-ise it, but preserve
   every export.

2. **`buildCircuitFromCanvas` has 71 call sites.**  ES modules
   conversion must expose this as a named export and update every
   caller in the same commit; a stale global `buildCircuitFromCanvas`
   reference will fatal-throw in module scope.

3. **MNA matrix layout changes** (HATA 13 CCVS/CCCS branch rows)
   would ripple through `sim.js`, `stamps.js`, `sparse-fast.js`,
   `circuit-serializer.js`.  Keep that work *out* of the modularisation
   sprint — it deserves its own before/after regression.

4. **Test URLs updated in Sprint 91** (`/simulator.html`).  Harness
   is green at 11/11, so the migration can trust the regression
   surface.

### Recommendation

**(A) Migration can start in Sprint 92 — with guardrails.**

Prerequisite: the migration sprint must explicitly preserve every
`sim-legacy.js` export and not confuse "legacy" in the filename for
"removable".  The four Sprint 69 debts are **not blockers** for
modularisation — they are local behavioural bugs that stay local
whether the engine is IIFE or ES module.

Suggested ordering:
- **Sprint 92**: scaffold build system (Rollup or esbuild), produce
  the same `simulator.html` from ES module inputs with byte-parity
  assertion in CI.
- **Sprint 93**: engine split (solver core vs orchestrator vs stamps),
  keeping public names stable.
- **Sprint 94**: UI split.
- **Sprint 95**: source maps + dev tooling.
- **Sprint 96** *(or 97+)*: tackle the Sprint 69 debts once
  modularisation has given us smaller surfaces to test against.
- **Sprint 96** *(original plan)*: pseudo-transient continuation for
  Sprint 81 thermal collapse — unchanged.

---

## Appendix — Commands used

```bash
# Build parity
node build.js
diff simulator.html dist/index.html
shasum simulator.html dist/index.html

# Dual engine
grep -nE "^function [a-zA-Z]|^var [a-zA-Z_]+ *= *function" \
  src/engine/sim.js src/engine/sim-legacy.js

# Runtime usage of sim-legacy
grep -rn "buildCircuitFromCanvas" src/ --include="*.js" \
  | grep -v "src/engine/sim-legacy.js" | wc -l

# Sprint 69 debts
grep -rn "CCVS\|CCCS" src/engine/
grep -rn "njfet\|NJFET" src/engine/ src/models/
grep -oE 'x1:(-?[0-9]+),y1:(-?[0-9]+),x2:(-?[0-9]+),y2:(-?[0-9]+)' \
  src/components/presets.js \
  | awk -F'[:,]' '$2==$6 && $4==$8' | wc -l
ls src/test-spice/*sparse*        # (no matches)

# Orphan files
grep -oE "'src/[^']+\.js'" build.js | tr -d "'" | sort -u
find src -name "*.js" ! -path "*/test-spice/*" | sort
```

_Audit by Zenco Baba + Tamirci Zenco, 2026-04-18._
