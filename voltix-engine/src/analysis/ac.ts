/**
 * AC (Small-Signal) Frequency-Domain Analysis.
 *
 * Workflow:
 *   1. Compute DC operating point (linearization point for nonlinear elements)
 *   2. Generate frequency sweep points (logarithmic or linear)
 *   3. At each frequency f:
 *      a. ω = 2πf
 *      b. Build complex MNA matrix with frequency-dependent stamps:
 *         - Resistor: Y = G (real conductance)
 *         - Capacitor: Y = jωC (imaginary admittance)
 *         - Inductor: Z = jωL → stamps as voltage source with impedance
 *         - Diode: linearized Geq from DC operating point (constant)
 *         - Voltage source: same as DC (complex KVL)
 *         - AC source: amplitude/phase from source definition
 *      c. Solve complex linear system → phasor voltages and currents
 *      d. Record magnitude (dB) and phase (degrees)
 *
 * Output: transfer function H(f) = V_out(f) / V_in(f) across frequency range.
 */

import { Complex } from '../utils/complex';
import { solveComplexLU } from '../core/complex-solver';
import { solveDCOperatingPoint } from '../core/newton';
import type { Component, StampContext } from '../components/component';
import { Resistor } from '../components/resistor';
import { Capacitor } from '../components/capacitor';
import { Inductor } from '../components/inductor';
import { Diode } from '../components/diode';
import { VoltageSource } from '../components/vsource';
import { CurrentSource } from '../components/isource';
import { GMIN } from '../utils/constants';

export type SweepType = 'dec' | 'lin' | 'oct';

export interface ACOptions {
  /** Start frequency (Hz) */
  fStart: number;
  /** Stop frequency (Hz) */
  fStop: number;
  /** Points per decade (for 'dec' sweep) or total points (for 'lin'). Default: 20 */
  pointsPerDecade?: number;
  /** Sweep type. Default: 'dec' */
  sweepType?: SweepType;
}

export interface ACResult {
  /** Frequency points (Hz) */
  frequencies: Float64Array;
  /** Signal name → magnitude in dB at each frequency */
  magnitude: Map<string, Float64Array>;
  /** Signal name → phase in degrees at each frequency */
  phase: Map<string, Float64Array>;
  /** Number of frequency points */
  numPoints: number;
}

/**
 * Source definition for AC analysis — which source provides the AC stimulus.
 * The source with this name will have magnitude=1, phase=0 (unit excitation).
 * All other voltage/current sources are set to 0 (shorted/opened) in AC.
 */
export interface ACSource {
  /** Name of the voltage source providing AC stimulus (e.g., "V1") */
  name: string;
  /** AC magnitude (default: 1) */
  magnitude?: number;
  /** AC phase in degrees (default: 0) */
  phaseDeg?: number;
}

export function runAC(
  components: readonly Component[],
  acSource: ACSource,
  options: ACOptions,
): ACResult {
  const {
    fStart,
    fStop,
    pointsPerDecade = 20,
    sweepType = 'dec',
  } = options;

  const acMag = acSource.magnitude ?? 1;
  const acPhase = ((acSource.phaseDeg ?? 0) * Math.PI) / 180;

  // ── Step 1: DC Operating Point for linearization ──
  const dcResult = solveDCOperatingPoint(components);

  // Collect diode linearized conductances from DC OP
  const diodeGeqs = new Map<string, number>();
  for (const comp of components) {
    if (comp instanceof Diode) {
      const ai = dcResult.nodeVoltages.get(comp.pins[0]!.node.toLowerCase().trim()) ?? 0;
      const ci = dcResult.nodeVoltages.get(comp.pins[1]!.node.toLowerCase().trim()) ?? 0;
      const Vd = ai - ci;
      const Geq = comp.conductance(Vd) + GMIN;
      diodeGeqs.set(comp.name, Geq);
    }
  }

  // ── Step 2: Build node map ──
  const nodeMap = new Map<string, number>();
  let nextNodeIndex = 0;

  function getNodeIndex(nodeName: string): number {
    const key = nodeName.toLowerCase().trim();
    if (key === '0' || key === 'gnd' || key === 'ground') return -1;
    let idx = nodeMap.get(key);
    if (idx === undefined) {
      idx = nextNodeIndex++;
      nodeMap.set(key, idx);
    }
    return idx;
  }

  // Count voltage sources (including inductors which stamp as vsources)
  let vsourceCount = 0;
  for (const comp of components) {
    for (const pin of comp.pins) getNodeIndex(pin.node);
    if (comp.type === 'vsource') vsourceCount++;
  }

  const nodeCount = nextNodeIndex;
  const matrixSize = nodeCount + vsourceCount;

  // ── Step 3: Generate frequency points ──
  const freqs = generateFrequencyPoints(fStart, fStop, pointsPerDecade, sweepType);
  const numPoints = freqs.length;

  // ── Step 4: Prepare result arrays ──
  const frequencies = new Float64Array(numPoints);
  const magnitude = new Map<string, Float64Array>();
  const phase = new Map<string, Float64Array>();

  for (const [name] of nodeMap) {
    magnitude.set(`V(${name})`, new Float64Array(numPoints));
    phase.set(`V(${name})`, new Float64Array(numPoints));
  }

  // ── Step 5: Frequency sweep ──
  for (let fi = 0; fi < numPoints; fi++) {
    const f = freqs[fi]!;
    frequencies[fi] = f;
    const omega = 2 * Math.PI * f;

    // Build complex MNA matrix
    const A: Complex[][] = new Array(matrixSize);
    for (let i = 0; i < matrixSize; i++) {
      A[i] = new Array(matrixSize);
      for (let j = 0; j < matrixSize; j++) {
        A[i]![j] = Complex.ZERO;
      }
    }
    const b: Complex[] = new Array(matrixSize).fill(Complex.ZERO);

    let vsIdx = 0;
    for (const comp of components) {
      stampAC(comp, A, b, nodeCount, vsIdx, omega, acSource, acMag, acPhase, diodeGeqs, getNodeIndex);
      if (comp.type === 'vsource') vsIdx++;
    }

    // Solve complex system
    const x = solveComplexLU(A, b);

    // Record results
    for (const [name, idx] of nodeMap) {
      const phasor = x[idx]!;
      magnitude.get(`V(${name})`)![fi] = phasor.magnitudeDB;
      phase.get(`V(${name})`)![fi] = phasor.phaseDeg;
    }
  }

  return { frequencies, magnitude, phase, numPoints };
}

/**
 * Stamp a component into the complex AC MNA matrix.
 */
function stampAC(
  comp: Component,
  A: Complex[][],
  b: Complex[],
  nodeCount: number,
  vsIndex: number,
  omega: number,
  acSource: ACSource,
  acMag: number,
  acPhase: number,
  diodeGeqs: Map<string, number>,
  getNodeIndex: (name: string) => number,
): void {
  if (comp instanceof Resistor) {
    // Y = G (real conductance, same as DC)
    const i = getNodeIndex(comp.pins[0]!.node);
    const j = getNodeIndex(comp.pins[1]!.node);
    const G = Complex.real(1 / comp.resistance);

    addAdmittance(A, i, j, G);

  } else if (comp instanceof Capacitor) {
    // Y = jωC (pure imaginary admittance)
    const i = getNodeIndex(comp.pins[0]!.node);
    const j = getNodeIndex(comp.pins[1]!.node);
    const Y = new Complex(0, omega * comp.capacitance);

    addAdmittance(A, i, j, Y);

  } else if (comp instanceof Inductor) {
    // Inductor stamps like a voltage source with impedance jωL.
    // KVL: V(i) - V(j) = jωL × I_branch
    // MNA row: V(i) - V(j) - jωL × I = 0
    const i = getNodeIndex(comp.pins[0]!.node);
    const j = getNodeIndex(comp.pins[1]!.node);
    const row = nodeCount + vsIndex;
    const Z = new Complex(0, omega * comp.inductance);

    if (i >= 0) {
      A[i]![row] = A[i]![row]!.add(Complex.ONE);
      A[row]![i] = A[row]![i]!.add(Complex.ONE);
    }
    if (j >= 0) {
      A[j]![row] = A[j]![row]!.sub(Complex.ONE);
      A[row]![j] = A[row]![j]!.sub(Complex.ONE);
    }
    // -jωL × I on diagonal
    A[row]![row] = A[row]![row]!.sub(Z);
    // RHS = 0 (no DC in AC analysis for inductors)

  } else if (comp instanceof Diode) {
    // Linearized at DC OP — constant real conductance
    const i = getNodeIndex(comp.pins[0]!.node);
    const j = getNodeIndex(comp.pins[1]!.node);
    const Geq = diodeGeqs.get(comp.name) ?? GMIN;
    const G = Complex.real(Geq);

    addAdmittance(A, i, j, G);

  } else if (comp instanceof VoltageSource) {
    // Voltage source in AC: the designated AC source has mag/phase,
    // all others are 0V (short circuit in small-signal).
    const i = getNodeIndex(comp.pins[0]!.node);
    const j = getNodeIndex(comp.pins[1]!.node);
    const row = nodeCount + vsIndex;

    if (i >= 0) {
      A[i]![row] = A[i]![row]!.add(Complex.ONE);
      A[row]![i] = A[row]![i]!.add(Complex.ONE);
    }
    if (j >= 0) {
      A[j]![row] = A[j]![row]!.sub(Complex.ONE);
      A[row]![j] = A[row]![j]!.sub(Complex.ONE);
    }

    // AC excitation: only the designated source gets a nonzero value
    if (comp.name === acSource.name) {
      b[row] = Complex.fromPolar(acMag, acPhase);
    }
    // Other sources: b[row] = 0 (already initialized)

  } else if (comp instanceof CurrentSource) {
    // Current sources are 0 in AC small-signal (unless designated as AC source)
    // For now, current sources contribute nothing in AC.
  }
}

/**
 * Add a 2-terminal admittance Y between nodes i and j.
 * Standard stamp pattern (same as resistor but complex).
 */
function addAdmittance(A: Complex[][], i: number, j: number, Y: Complex): void {
  if (i >= 0) A[i]![i] = A[i]![i]!.add(Y);
  if (j >= 0) A[j]![j] = A[j]![j]!.add(Y);
  if (i >= 0 && j >= 0) {
    A[i]![j] = A[i]![j]!.sub(Y);
    A[j]![i] = A[j]![i]!.sub(Y);
  }
}

/**
 * Generate frequency sweep points.
 */
export function generateFrequencyPoints(
  fStart: number,
  fStop: number,
  pointsPerDecade: number,
  sweepType: SweepType,
): number[] {
  const points: number[] = [];

  if (sweepType === 'dec') {
    const decades = Math.log10(fStop / fStart);
    const totalPoints = Math.ceil(decades * pointsPerDecade);
    for (let i = 0; i <= totalPoints; i++) {
      const f = fStart * Math.pow(10, i / pointsPerDecade);
      if (f <= fStop * 1.001) points.push(f); // tiny tolerance for float
    }
  } else if (sweepType === 'oct') {
    const octaves = Math.log2(fStop / fStart);
    const pointsPerOctave = pointsPerDecade; // reuse parameter
    const totalPoints = Math.ceil(octaves * pointsPerOctave);
    for (let i = 0; i <= totalPoints; i++) {
      const f = fStart * Math.pow(2, i / pointsPerOctave);
      if (f <= fStop * 1.001) points.push(f);
    }
  } else {
    // Linear sweep
    const step = (fStop - fStart) / Math.max(pointsPerDecade - 1, 1);
    for (let f = fStart; f <= fStop * 1.001; f += step) {
      points.push(f);
    }
  }

  return points;
}
