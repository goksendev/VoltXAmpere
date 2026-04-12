import { describe, it, expect } from 'vitest';
import { solveDCOperatingPoint } from '../../src/core/newton';
import { Resistor } from '../../src/components/resistor';
import { VoltageSource } from '../../src/components/vsource';
import { Diode } from '../../src/components/diode';
import type { Component } from '../../src/components/component';

// Helper: solve and return result, assert convergence
function solve(components: Component[], maxIter = 50) {
  const r = solveDCOperatingPoint(components, { maxIterations: maxIter });
  expect(r.converged).toBe(true);
  return r;
}

// ─────────────────────────────────────────────
// TEST 1: Simple diode + resistor
// ─────────────────────────────────────────────

describe('Diode + Resistor', () => {
  it('forward biased — Vd ≈ 0.6-0.75V (IS=1e-14, N=1)', () => {
    // V1=5V → D1 (anode=1, cathode=2) → R1=1kΩ → GND
    const components: Component[] = [
      new VoltageSource('V1', '1', '0', 5),
      new Diode('D1', '1', '2'),
      new Resistor('R1', '2', '0', 1000),
    ];

    const r = solve(components);

    const V1 = r.nodeVoltages.get('1')!;
    const V2 = r.nodeVoltages.get('2')!;
    const Vd = V1 - V2;

    // Diode forward voltage should be in realistic range
    expect(Vd).toBeGreaterThan(0.6);
    expect(Vd).toBeLessThan(0.75);

    // Current through R1 = V2 / 1kΩ
    const Ir = V2 / 1000;
    expect(Ir).toBeGreaterThan(0.004); // > 4mA
    expect(Ir).toBeLessThan(0.005);    // < 5mA

    // Should converge in reasonable iterations
    expect(r.iterations).toBeLessThan(15);
  });

  it('different supply voltage — Vd stays in range', () => {
    const components: Component[] = [
      new VoltageSource('V1', '1', '0', 12),
      new Diode('D1', '1', '2'),
      new Resistor('R1', '2', '0', 1000),
    ];

    const r = solve(components);
    const Vd = r.nodeVoltages.get('1')! - r.nodeVoltages.get('2')!;

    // Higher current → slightly higher Vd (logarithmic relationship)
    expect(Vd).toBeGreaterThan(0.6);
    expect(Vd).toBeLessThan(0.8);
  });

  it('high resistance — very low current, lower Vd', () => {
    const components: Component[] = [
      new VoltageSource('V1', '1', '0', 5),
      new Diode('D1', '1', '2'),
      new Resistor('R1', '2', '0', 1_000_000), // 1MΩ
    ];

    const r = solve(components);
    const Vd = r.nodeVoltages.get('1')! - r.nodeVoltages.get('2')!;

    // Very low current → lower Vd (but still forward biased)
    expect(Vd).toBeGreaterThan(0.3);
    expect(Vd).toBeLessThan(0.65);
  });
});

// ─────────────────────────────────────────────
// TEST 2: Two diodes in series
// ─────────────────────────────────────────────

describe('Series Diodes', () => {
  it('two diodes in series — total drop ≈ 1.2-1.5V', () => {
    // V1=5V → D1 → D2 → R1=1kΩ → GND
    const components: Component[] = [
      new VoltageSource('V1', '1', '0', 5),
      new Diode('D1', '1', '2'),
      new Diode('D2', '2', '3'),
      new Resistor('R1', '3', '0', 1000),
    ];

    const r = solve(components);

    const V1 = r.nodeVoltages.get('1')!;
    const V2 = r.nodeVoltages.get('2')!;
    const V3 = r.nodeVoltages.get('3')!;

    const Vd1 = V1 - V2;
    const Vd2 = V2 - V3;
    const totalDrop = V1 - V3;

    // Each diode drops ~0.65V
    expect(Vd1).toBeGreaterThan(0.55);
    expect(Vd1).toBeLessThan(0.75);
    expect(Vd2).toBeGreaterThan(0.55);
    expect(Vd2).toBeLessThan(0.75);

    // Total drop ~1.3V
    expect(totalDrop).toBeGreaterThan(1.1);
    expect(totalDrop).toBeLessThan(1.5);

    // Both diodes carry same current (series)
    // I = V3 / R1
    const I = V3 / 1000;
    expect(I).toBeGreaterThan(0.003);
    expect(I).toBeLessThan(0.004);
  });
});

// ─────────────────────────────────────────────
// TEST 3: Reverse biased diode
// ─────────────────────────────────────────────

describe('Reverse Biased Diode', () => {
  it('reverse bias — essentially zero current', () => {
    // V1=5V → R1=1kΩ → node2 → D1 (cathode=2, anode=0) → GND
    // Diode is reverse biased: cathode at higher potential
    const components: Component[] = [
      new VoltageSource('V1', '1', '0', 5),
      new Resistor('R1', '1', '2', 1000),
      new Diode('D1', '0', '2'), // anode=GND, cathode=node2 → reverse!
    ];

    const r = solve(components);

    // Node 2 should be very close to 5V (no current flows through R1)
    const V2 = r.nodeVoltages.get('2')!;
    expect(V2).toBeGreaterThan(4.99);
    expect(V2).toBeLessThanOrEqual(5.0);
  });

  it('negative supply — diode blocks', () => {
    // V1=-5V → D1 (anode=1, cathode=0) → R1=1kΩ → GND
    // V1 is negative, so anode is at -5V → reverse biased
    const components: Component[] = [
      new VoltageSource('V1', '1', '0', -5),
      new Diode('D1', '1', '2'),
      new Resistor('R1', '2', '0', 1000),
    ];

    const r = solve(components);

    // Almost no current → V2 ≈ 0V
    const V2 = r.nodeVoltages.get('2')!;
    expect(Math.abs(V2)).toBeLessThan(0.001);
  });
});

// ─────────────────────────────────────────────
// TEST 4: Half-wave rectifier (DC analysis)
// ─────────────────────────────────────────────

describe('Half-Wave Rectifier (DC)', () => {
  it('positive input — diode conducts', () => {
    // Simulating one instant of positive half cycle
    const components: Component[] = [
      new VoltageSource('V1', '1', '0', 10),
      new Diode('D1', '1', '2'),
      new Resistor('R_load', '2', '0', 1000),
    ];

    const r = solve(components);

    // Output ≈ 10V - Vd ≈ 9.3V
    const Vout = r.nodeVoltages.get('2')!;
    expect(Vout).toBeGreaterThan(9.0);
    expect(Vout).toBeLessThan(9.5);
  });

  it('negative input — diode blocks', () => {
    const components: Component[] = [
      new VoltageSource('V1', '1', '0', -10),
      new Diode('D1', '1', '2'),
      new Resistor('R_load', '2', '0', 1000),
    ];

    const r = solve(components);

    // Output ≈ 0V (diode blocks)
    const Vout = r.nodeVoltages.get('2')!;
    expect(Math.abs(Vout)).toBeLessThan(0.001);
  });
});

// ─────────────────────────────────────────────
// TEST 5: Parallel diodes (current sharing)
// ─────────────────────────────────────────────

describe('Parallel Diodes', () => {
  it('two identical diodes — share current equally', () => {
    // V1=5V → two parallel diodes → R1=500Ω → GND
    // Total current splits equally between D1 and D2
    const components: Component[] = [
      new VoltageSource('V1', '1', '0', 5),
      new Diode('D1', '1', '2'),
      new Diode('D2', '1', '2'),
      new Resistor('R1', '2', '0', 500),
    ];

    const r = solve(components);

    const Vd = r.nodeVoltages.get('1')! - r.nodeVoltages.get('2')!;
    const Vout = r.nodeVoltages.get('2')!;

    // Two parallel diodes → effective IS doubles → slightly lower Vd
    // than single diode at same total current
    expect(Vd).toBeGreaterThan(0.55);
    expect(Vd).toBeLessThan(0.75);

    // Current through R1
    const Itotal = Vout / 500;
    expect(Itotal).toBeGreaterThan(0.008);
    expect(Itotal).toBeLessThan(0.010);
  });
});

// ─────────────────────────────────────────────
// TEST 6: Convergence stress test
// ─────────────────────────────────────────────

describe('Convergence Stress', () => {
  it('IS=1e-15, N=2 — harder convergence', () => {
    const components: Component[] = [
      new VoltageSource('V1', '1', '0', 5),
      new Diode('D1', '1', '2', { IS: 1e-15, N: 2 }),
      new Resistor('R1', '2', '0', 1000),
    ];

    const r = solve(components);

    // N=2 doubles thermal voltage → Vf roughly doubles to ~1.3-1.6V
    const Vd = r.nodeVoltages.get('1')! - r.nodeVoltages.get('2')!;
    expect(Vd).toBeGreaterThan(1.0);
    expect(Vd).toBeLessThan(1.7);

    expect(r.iterations).toBeLessThan(15);
  });

  it('IS=1e-12, N=1 — high leakage diode', () => {
    const components: Component[] = [
      new VoltageSource('V1', '1', '0', 3),
      new Diode('D1', '1', '2', { IS: 1e-12, N: 1 }),
      new Resistor('R1', '2', '0', 1000),
    ];

    const r = solve(components);

    // Higher IS → lower Vf
    const Vd = r.nodeVoltages.get('1')! - r.nodeVoltages.get('2')!;
    expect(Vd).toBeGreaterThan(0.3);
    expect(Vd).toBeLessThan(0.6);

    expect(r.iterations).toBeLessThan(15);
  });

  it('multiple diodes + resistors — complex circuit', () => {
    // V1=12V → D1 → R1=470Ω → D2 → R2=1kΩ → GND
    const components: Component[] = [
      new VoltageSource('V1', '1', '0', 12),
      new Diode('D1', '1', '2'),
      new Resistor('R1', '2', '3', 470),
      new Diode('D2', '3', '4'),
      new Resistor('R2', '4', '0', 1000),
    ];

    const r = solve(components);

    // Two diode drops ≈ 1.3V, remaining 10.7V across 1470Ω → I ≈ 7.3mA
    const V4 = r.nodeVoltages.get('4')!;
    const Itotal = V4 / 1000;
    expect(Itotal).toBeGreaterThan(0.006);
    expect(Itotal).toBeLessThan(0.008);

    expect(r.iterations).toBeLessThan(15);
  });
});

// ─────────────────────────────────────────────
// TEST 7: Diode model unit tests
// ─────────────────────────────────────────────

describe('Diode Model Functions', () => {
  it('current at V=0 should be ~0', () => {
    const d = new Diode('D', '1', '0');
    expect(Math.abs(d.current(0))).toBeLessThan(1e-12);
  });

  it('current is exponential in forward bias', () => {
    const d = new Diode('D', '1', '0');
    const I1 = d.current(0.6);
    const I2 = d.current(0.7);
    // 0.1V increase → roughly 50× current increase (for N=1, Vt≈26mV)
    expect(I2 / I1).toBeGreaterThan(20);
    expect(I2 / I1).toBeLessThan(100);
  });

  it('current in reverse bias ≈ -IS', () => {
    const d = new Diode('D', '1', '0', { IS: 1e-14 });
    const I = d.current(-5);
    expect(Math.abs(I + 1e-14)).toBeLessThan(1e-16);
  });

  it('conductance is positive everywhere', () => {
    const d = new Diode('D', '1', '0');
    expect(d.conductance(-5)).toBeGreaterThan(0);
    expect(d.conductance(0)).toBeGreaterThan(0);
    expect(d.conductance(0.7)).toBeGreaterThan(0);
  });

  it('overflow protection — no NaN/Infinity at extreme voltages', () => {
    const d = new Diode('D', '1', '0');
    expect(isFinite(d.current(100))).toBe(true);
    expect(isFinite(d.current(-100))).toBe(true);
    expect(isFinite(d.conductance(100))).toBe(true);
    expect(isFinite(d.conductance(-100))).toBe(true);
  });
});
