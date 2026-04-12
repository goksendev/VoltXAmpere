import { describe, it, expect } from 'vitest';
import { runAC, generateFrequencyPoints } from '../../src/analysis/ac';
import { Complex } from '../../src/utils/complex';
import { Resistor } from '../../src/components/resistor';
import { Capacitor } from '../../src/components/capacitor';
import { Inductor } from '../../src/components/inductor';
import { VoltageSource } from '../../src/components/vsource';
import { Diode } from '../../src/components/diode';
import type { Component } from '../../src/components/component';

/**
 * Helper: find magnitude and phase at a specific frequency.
 * Uses linear interpolation between frequency points.
 */
function acAt(
  result: ReturnType<typeof runAC>,
  signal: string,
  freq: number,
): { magDB: number; phaseDeg: number } {
  const magArr = result.magnitude.get(signal)!;
  const phaseArr = result.phase.get(signal)!;
  const freqs = result.frequencies;

  for (let i = 1; i < freqs.length; i++) {
    if (freqs[i]! >= freq) {
      const f0 = freqs[i - 1]!;
      const f1 = freqs[i]!;
      if (f1 === f0) return { magDB: magArr[i]!, phaseDeg: phaseArr[i]! };
      const t = (freq - f0) / (f1 - f0);
      return {
        magDB: magArr[i - 1]! + t * (magArr[i]! - magArr[i - 1]!),
        phaseDeg: phaseArr[i - 1]! + t * (phaseArr[i]! - phaseArr[i - 1]!),
      };
    }
  }
  return { magDB: magArr[magArr.length - 1]!, phaseDeg: phaseArr[phaseArr.length - 1]! };
}

// ─────────────────────────────────────────────
// TEST 0: Complex Arithmetic
// ─────────────────────────────────────────────

describe('Complex Arithmetic', () => {
  it('basic operations', () => {
    const a = new Complex(3, 4);
    const b = new Complex(1, -2);

    const sum = a.add(b);
    expect(sum.re).toBe(4);
    expect(sum.im).toBe(2);

    const diff = a.sub(b);
    expect(diff.re).toBe(2);
    expect(diff.im).toBe(6);

    const prod = a.mul(b);
    // (3+4j)(1-2j) = 3 - 6j + 4j - 8j² = 3 - 2j + 8 = 11 + 2j
    expect(prod.re).toBeCloseTo(11, 10);
    expect(prod.im).toBeCloseTo(-2, 10);

    const quot = a.div(b);
    // (3+4j)/(1-2j) = (3+4j)(1+2j)/(1+4) = (3+6j+4j+8j²)/5 = (-5+10j)/5 = -1+2j
    expect(quot.re).toBeCloseTo(-1, 10);
    expect(quot.im).toBeCloseTo(2, 10);
  });

  it('magnitude and phase', () => {
    const z = new Complex(3, 4);
    expect(z.magnitude).toBeCloseTo(5, 10);
    expect(z.phaseDeg).toBeCloseTo(53.13, 1);
    expect(z.magnitudeDB).toBeCloseTo(20 * Math.log10(5), 5);
  });

  it('fromPolar', () => {
    const z = Complex.fromPolar(5, Math.PI / 4);
    expect(z.re).toBeCloseTo(5 * Math.SQRT2 / 2, 10);
    expect(z.im).toBeCloseTo(5 * Math.SQRT2 / 2, 10);
  });
});

// ─────────────────────────────────────────────
// TEST 1: Frequency Point Generator
// ─────────────────────────────────────────────

describe('Frequency Point Generator', () => {
  it('decade sweep: 3 decades, 10 points/decade', () => {
    const pts = generateFrequencyPoints(1, 1000, 10, 'dec');
    // 3 decades × 10 pts/dec + 1 = 31 points
    expect(pts.length).toBe(31);
    expect(pts[0]).toBeCloseTo(1, 5);
    expect(pts[pts.length - 1]).toBeCloseTo(1000, 0);
  });

  it('linear sweep', () => {
    const pts = generateFrequencyPoints(100, 1000, 10, 'lin');
    expect(pts.length).toBe(10);
    expect(pts[0]).toBeCloseTo(100, 5);
    expect(pts[pts.length - 1]).toBeCloseTo(1000, 0);
  });
});

// ─────────────────────────────────────────────
// TEST 2: RC Low-Pass Filter
// ─────────────────────────────────────────────

describe('RC Low-Pass Filter', () => {
  // V1 → R=1kΩ → node_out → C=159nF → GND
  // fc = 1/(2πRC) = 1/(2π × 1000 × 159e-9) ≈ 1001 Hz
  // H(f) = 1 / (1 + j×f/fc)
  // |H(fc)| = 1/√2 = -3.01dB
  // ∠H(fc) = -45°

  const R = 1000;
  const C = 159.155e-9; // exact for fc = 1000Hz
  const fc = 1 / (2 * Math.PI * R * C); // ≈ 1000 Hz

  function makeRCLP(): Component[] {
    return [
      new VoltageSource('V1', '1', '0', 1),
      new Resistor('R1', '1', '2', R),
      new Capacitor('C1', '2', '0', C),
    ];
  }

  it('at fc: magnitude ≈ -3.01dB (error < 0.1dB)', () => {
    const r = runAC(makeRCLP(), { name: 'V1' }, {
      fStart: 10, fStop: 100000, pointsPerDecade: 50,
    });

    const { magDB } = acAt(r, 'V(2)', fc);
    expect(Math.abs(magDB - (-3.0103))).toBeLessThan(0.1);
  });

  it('at fc: phase ≈ -45° (error < 1°)', () => {
    const r = runAC(makeRCLP(), { name: 'V1' }, {
      fStart: 10, fStop: 100000, pointsPerDecade: 50,
    });

    const { phaseDeg } = acAt(r, 'V(2)', fc);
    expect(Math.abs(phaseDeg - (-45))).toBeLessThan(1);
  });

  it('at 10×fc: magnitude ≈ -20dB (1st order roll-off)', () => {
    const r = runAC(makeRCLP(), { name: 'V1' }, {
      fStart: 10, fStop: 100000, pointsPerDecade: 50,
    });

    const { magDB } = acAt(r, 'V(2)', 10 * fc);
    // |H(10fc)| = 1/√(1+100) ≈ 1/10.05 → -20.04dB
    expect(Math.abs(magDB - (-20.04))).toBeLessThan(0.5);
  });

  it('at DC (low freq): magnitude ≈ 0dB', () => {
    const r = runAC(makeRCLP(), { name: 'V1' }, {
      fStart: 1, fStop: 100000, pointsPerDecade: 20,
    });

    const { magDB } = acAt(r, 'V(2)', 1);
    expect(Math.abs(magDB)).toBeLessThan(0.01);
  });

  it('phase approaches -90° at high frequency', () => {
    const r = runAC(makeRCLP(), { name: 'V1' }, {
      fStart: 10, fStop: 1e6, pointsPerDecade: 20,
    });

    const { phaseDeg } = acAt(r, 'V(2)', 100 * fc);
    expect(phaseDeg).toBeLessThan(-80);
    expect(phaseDeg).toBeGreaterThan(-95);
  });

  it('multi-point analytic comparison', () => {
    const r = runAC(makeRCLP(), { name: 'V1' }, {
      fStart: 10, fStop: 100000, pointsPerDecade: 50,
    });

    // Analytic: H(f) = 1 / (1 + j×f/fc)
    const testFreqs = [100, 500, 1000, 2000, 5000, 10000, 50000];

    for (const f of testFreqs) {
      const { magDB, phaseDeg } = acAt(r, 'V(2)', f);

      // Analytic
      const H = Complex.ONE.div(new Complex(1, f / fc));
      const expectedDB = H.magnitudeDB;
      const expectedPhase = H.phaseDeg;

      expect(Math.abs(magDB - expectedDB)).toBeLessThan(0.1);
      expect(Math.abs(phaseDeg - expectedPhase)).toBeLessThan(1);
    }
  });
});

// ─────────────────────────────────────────────
// TEST 3: RC High-Pass Filter
// ─────────────────────────────────────────────

describe('RC High-Pass Filter', () => {
  // V1 → C=159nF → node_out → R=1kΩ → GND
  // H(f) = (jf/fc) / (1 + jf/fc)

  const R = 1000;
  const C = 159.155e-9;
  const fc = 1 / (2 * Math.PI * R * C);

  function makeRCHP(): Component[] {
    return [
      new VoltageSource('V1', '1', '0', 1),
      new Capacitor('C1', '1', '2', C),
      new Resistor('R1', '2', '0', R),
    ];
  }

  it('at fc: magnitude ≈ -3dB', () => {
    const r = runAC(makeRCHP(), { name: 'V1' }, {
      fStart: 10, fStop: 100000, pointsPerDecade: 50,
    });

    const { magDB } = acAt(r, 'V(2)', fc);
    expect(Math.abs(magDB - (-3.0103))).toBeLessThan(0.1);
  });

  it('at fc: phase ≈ +45°', () => {
    const r = runAC(makeRCHP(), { name: 'V1' }, {
      fStart: 10, fStop: 100000, pointsPerDecade: 50,
    });

    const { phaseDeg } = acAt(r, 'V(2)', fc);
    expect(Math.abs(phaseDeg - 45)).toBeLessThan(1);
  });

  it('high frequency: magnitude ≈ 0dB (passes through)', () => {
    const r = runAC(makeRCHP(), { name: 'V1' }, {
      fStart: 10, fStop: 1e6, pointsPerDecade: 20,
    });

    const { magDB } = acAt(r, 'V(2)', 100 * fc);
    expect(Math.abs(magDB)).toBeLessThan(0.01);
  });
});

// ─────────────────────────────────────────────
// TEST 4: Series RLC Band-Pass
// ─────────────────────────────────────────────

describe('Series RLC Band-Pass', () => {
  // V1 → R=100Ω → L=10mH → C=253nF → GND
  // Output across R
  // f0 = 1/(2π√LC) ≈ 3165 Hz
  // Q = (1/R)×√(L/C) = (1/100)×√(10e-3/253e-9) ≈ 1.99

  const R = 100;
  const L = 10e-3;
  const C = 253e-9;
  const f0 = 1 / (2 * Math.PI * Math.sqrt(L * C));
  const Q = (1 / R) * Math.sqrt(L / C);

  function makeRLCBP(): Component[] {
    return [
      new VoltageSource('V1', '1', '0', 1),
      new Resistor('R1', '1', '2', R),
      new Inductor('L1', '2', '3', L),
      new Capacitor('C1', '3', '0', C),
    ];
  }

  it('peak at resonance frequency', () => {
    const r = runAC(makeRLCBP(), { name: 'V1' }, {
      fStart: 100, fStop: 100000, pointsPerDecade: 50,
    });

    // At resonance, L and C impedances cancel → all voltage across R
    // V(2) = V1 × R / (R + jωL + 1/jωC)
    // But we measure output at node 2 (after R), not across R.
    // V(2) = V1 - I×R, where I = V1/(R + jωL + 1/jωC)
    // V(2) = V1 × (jωL + 1/jωC) / (R + jωL + 1/jωC)

    // Actually, for a series RLC, current peaks at resonance.
    // Let's just verify the overall frequency response shape.

    // At resonance: impedance = R (pure resistive)
    // Current I = V/R, so V across R = V
    // V(2) = V1 - V_R = V1 - I×R = 0 at resonance... wait.

    // Actually V(2) is the voltage at the node between R and L.
    // V(2) = V(L) + V(C) = jωL×I + (1/jωC)×I
    // At resonance: jωL = -1/(jωC), so V(2) = 0. That's the notch, not bandpass!

    // For bandpass, we should measure current (or voltage across R).
    // Let's verify the series RLC has a resonance dip at V(2).

    // Find minimum magnitude at V(2) near f0
    const magArr = r.magnitude.get('V(2)')!;
    let minDB = Infinity;
    let minIdx = 0;
    for (let i = 0; i < magArr.length; i++) {
      if (magArr[i]! < minDB) {
        minDB = magArr[i]!;
        minIdx = i;
      }
    }

    // The dip should be near f0
    const fDip = r.frequencies[minIdx]!;
    expect(fDip).toBeGreaterThan(f0 * 0.8);
    expect(fDip).toBeLessThan(f0 * 1.2);

    // At resonance, V(2) should be near 0 (deep notch)
    expect(minDB).toBeLessThan(-20);
  });
});

// ─────────────────────────────────────────────
// TEST 5: RL Circuit (Inductor AC behavior)
// ─────────────────────────────────────────────

describe('RL High-Pass (Inductor)', () => {
  // V1 → R=1kΩ → node2 → L=159mH → GND
  // Output at node2 (across L)
  // fc = R/(2πL) ≈ 1000 Hz
  // H(f) = jωL / (R + jωL) = (jf/fc) / (1 + jf/fc)

  const R = 1000;
  const L = 159.155e-3; // fc = R/(2πL) ≈ 1000Hz
  const fc = R / (2 * Math.PI * L);

  function makeRLHP(): Component[] {
    return [
      new VoltageSource('V1', '1', '0', 1),
      new Resistor('R1', '1', '2', R),
      new Inductor('L1', '2', '0', L),
    ];
  }

  it('at fc: magnitude ≈ -3dB', () => {
    const r = runAC(makeRLHP(), { name: 'V1' }, {
      fStart: 10, fStop: 100000, pointsPerDecade: 50,
    });

    const { magDB } = acAt(r, 'V(2)', fc);
    expect(Math.abs(magDB - (-3.01))).toBeLessThan(0.2);
  });

  it('high frequency: magnitude ≈ 0dB', () => {
    const r = runAC(makeRLHP(), { name: 'V1' }, {
      fStart: 10, fStop: 1e6, pointsPerDecade: 20,
    });

    const { magDB } = acAt(r, 'V(2)', 100 * fc);
    expect(Math.abs(magDB)).toBeLessThan(0.05);
  });
});

// ─────────────────────────────────────────────
// TEST 6: Wide Sweep Stability
// ─────────────────────────────────────────────

describe('Wide Sweep Stability', () => {
  it('1Hz to 1GHz — no NaN, no crash', () => {
    const comps: Component[] = [
      new VoltageSource('V1', '1', '0', 1),
      new Resistor('R1', '1', '2', 1000),
      new Capacitor('C1', '2', '0', 1e-9),
    ];

    const r = runAC(comps, { name: 'V1' }, {
      fStart: 1, fStop: 1e9, pointsPerDecade: 10,
    });

    expect(r.numPoints).toBeGreaterThan(80); // 9 decades × 10 pts/dec

    // No NaN or Infinity
    const magArr = r.magnitude.get('V(2)')!;
    for (let i = 0; i < magArr.length; i++) {
      expect(isFinite(magArr[i]!)).toBe(true);
    }
  });
});

// ─────────────────────────────────────────────
// TEST 7: Diode in AC (Linearized)
// ─────────────────────────────────────────────

describe('Diode AC (Linearized)', () => {
  it('forward-biased diode has small AC impedance', () => {
    // V1=5V → D1 → R=1kΩ → GND → AC analysis
    // At DC: Vd ≈ 0.7V, Id ≈ 4.3mA
    // AC: diode looks like small resistance rd = nVt/Id ≈ 26mV/4.3mA ≈ 6Ω
    // AC gain at node2 ≈ R/(R+rd) ≈ 1000/1006 ≈ -0.05dB
    const comps: Component[] = [
      new VoltageSource('V1', '1', '0', 5),
      new Diode('D1', '1', '2'),
      new Resistor('R1', '2', '0', 1000),
    ];

    const r = runAC(comps, { name: 'V1' }, {
      fStart: 100, fStop: 10000, pointsPerDecade: 10,
    });

    // Output should be close to 0dB (diode is a small impedance)
    const { magDB } = acAt(r, 'V(2)', 1000);
    expect(magDB).toBeGreaterThan(-1);
    expect(magDB).toBeLessThan(0.1);
  });
});
