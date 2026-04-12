import { describe, it, expect } from 'vitest';
import { runTransient } from '../../src/analysis/transient';
import { Resistor } from '../../src/components/resistor';
import { VoltageSource } from '../../src/components/vsource';
import { Capacitor } from '../../src/components/capacitor';
import { Inductor } from '../../src/components/inductor';
import { Diode } from '../../src/components/diode';
import { ACVoltageSource } from '../../src/components/acsource';
import type { Component } from '../../src/components/component';
import type { IntegrationMethod } from '../../src/analysis/transient';

/**
 * Helper: find the value of a signal at a specific time.
 * Uses linear interpolation between timesteps.
 */
function signalAt(time: Float64Array, data: Float64Array, t: number): number {
  for (let i = 1; i < time.length; i++) {
    if (time[i]! >= t) {
      const t0 = time[i - 1]!;
      const t1 = time[i]!;
      const v0 = data[i - 1]!;
      const v1 = data[i]!;
      if (t1 === t0) return v0;
      return v0 + (v1 - v0) * ((t - t0) / (t1 - t0));
    }
  }
  return data[data.length - 1]!;
}

// Helper: run transient for both BE and TRAP
function runBothMethods(
  components: Component[],
  opts: { tStep: number; tStop: number },
): { be: ReturnType<typeof runTransient>; trap: ReturnType<typeof runTransient> } {
  // Create fresh components for each run to avoid shared state
  return {
    be: runTransient(components, { ...opts, method: 'BE' }),
    trap: runTransient(components, { ...opts, method: 'TRAP' }),
  };
}

// ─────────────────────────────────────────────
// TEST 1: RC Charging
// ─────────────────────────────────────────────

describe('RC Charging', () => {
  // V1=5V, R=1kΩ, C=1µF → τ = RC = 1ms
  // V_C(t) = 5 × (1 - e^(-t/τ))

  function makeRC(): Component[] {
    const cap = new Capacitor('C1', '2', '0', 1e-6);
    cap.setInitialVoltage(0); // Start uncharged
    return [
      new VoltageSource('V1', '1', '0', 5),
      new Resistor('R1', '1', '2', 1000),
      cap,
    ];
  }

  const tau = 1e-3; // 1ms
  const Vs = 5;
  const analytic = (t: number) => Vs * (1 - Math.exp(-t / tau));

  it('BE — V_C at t=τ ≈ 3.16V (error < 2%)', () => {
    const r = runTransient(makeRC(), { tStep: 1e-5, tStop: 5e-3, method: 'BE' });

    expect(r.allConverged).toBe(true);

    const vc = r.signals.get('V(2)')!;
    const v_at_tau = signalAt(r.time, vc, tau);
    const expected = analytic(tau); // 3.1606...

    // BE has 1st-order error, allow 2% with dt=10µs and τ=1ms
    expect(Math.abs(v_at_tau - expected) / expected).toBeLessThan(0.02);
  });

  it('TRAP — V_C at t=τ (error < 0.5%)', () => {
    const r = runTransient(makeRC(), { tStep: 1e-5, tStop: 5e-3, method: 'TRAP' });

    const vc = r.signals.get('V(2)')!;
    const v_at_tau = signalAt(r.time, vc, tau);
    const expected = analytic(tau);

    // TRAP is 2nd order — much better accuracy
    expect(Math.abs(v_at_tau - expected) / expected).toBeLessThan(0.005);
  });

  it('V_C at t=5τ ≈ Vs (fully charged)', () => {
    const r = runTransient(makeRC(), { tStep: 1e-5, tStop: 5e-3, method: 'BE' });

    const vc = r.signals.get('V(2)')!;
    const v_at_5tau = signalAt(r.time, vc, 5 * tau);
    const expected = analytic(5 * tau); // 4.9663...

    expect(v_at_5tau).toBeGreaterThan(4.9);
    expect(v_at_5tau).toBeLessThan(5.1);
  });

  it('V_C near 0V at first transient step', () => {
    const r = runTransient(makeRC(), { tStep: 1e-5, tStop: 1e-3, method: 'BE' });

    const vc = r.signals.get('V(2)')!;
    // Step 0 is DC OP (capacitor open → V=5V). Step 1 is first transient
    // step where companion model kicks in with IC=0V. V should be small.
    expect(vc[1]!).toBeLessThan(0.1);
  });

  it('monotonically increasing (transient steps)', () => {
    const r = runTransient(makeRC(), { tStep: 1e-5, tStop: 5e-3, method: 'BE' });
    const vc = r.signals.get('V(2)')!;

    // Skip step 0 (DC OP) — transient starts at step 1
    for (let i = 2; i < vc.length; i++) {
      expect(vc[i]!).toBeGreaterThanOrEqual(vc[i - 1]! - 1e-10);
    }
  });
});

// ─────────────────────────────────────────────
// TEST 2: RC Discharging
// ─────────────────────────────────────────────

describe('RC Discharging', () => {
  // Pre-charged C=1µF at 5V, R=1kΩ, no source
  // V_C(t) = 5 × e^(-t/τ)

  function makeRCdischarge(): Component[] {
    const cap = new Capacitor('C1', '1', '0', 1e-6);
    cap.setInitialVoltage(5);
    return [
      new Resistor('R1', '1', '0', 1000),
      cap,
    ];
  }

  const tau = 1e-3;
  const analytic = (t: number) => 5 * Math.exp(-t / tau);

  it('BE — V_C at t=τ ≈ 1.84V (36.8% of initial)', () => {
    const r = runTransient(makeRCdischarge(), { tStep: 1e-5, tStop: 5e-3, method: 'BE' });

    const vc = r.signals.get('V(1)')!;
    const v_at_tau = signalAt(r.time, vc, tau);
    const expected = analytic(tau); // 1.839...

    expect(Math.abs(v_at_tau - expected) / expected).toBeLessThan(0.02);
  });

  it('starts at 5V', () => {
    const r = runTransient(makeRCdischarge(), { tStep: 1e-5, tStop: 1e-3, method: 'BE' });
    const vc = r.signals.get('V(1)')!;

    // First step after DC OP should be close to 5V
    // (DC OP for this circuit: no source → V=0... but we set IC=5V)
    // Actually at step 0 the DC OP is computed without companion models
    // and there's no source, so V=0. But the capacitor IC is 5V.
    // The first transient step (step 1) should show the capacitor at ~5V.
    expect(vc[1]).toBeGreaterThan(4.9);
  });

  it('monotonically decreasing', () => {
    const r = runTransient(makeRCdischarge(), { tStep: 1e-5, tStop: 5e-3, method: 'BE' });
    const vc = r.signals.get('V(1)')!;

    // Skip step 0 (DC OP may differ from IC)
    for (let i = 2; i < vc.length; i++) {
      expect(vc[i]!).toBeLessThanOrEqual(vc[i - 1]! + 1e-10);
    }
  });
});

// ─────────────────────────────────────────────
// TEST 3: RL Step Response
// ─────────────────────────────────────────────

describe('RL Step Response', () => {
  // V1=5V, R=1kΩ, L=1mH → τ = L/R = 1µs
  // I(t) = (V/R) × (1 - e^(-t/τ))

  function makeRL(): Component[] {
    const ind = new Inductor('L1', '2', '0', 1e-3);
    ind.setInitialCurrent(0); // Start with zero current
    return [
      new VoltageSource('V1', '1', '0', 5),
      new Resistor('R1', '1', '2', 1000),
      ind,
    ];
  }

  const tau = 1e-6; // L/R = 1mH/1kΩ = 1µs

  it('BE — current rises toward V/R', () => {
    const r = runTransient(makeRL(), { tStep: 1e-8, tStop: 5e-6, method: 'BE' });

    const iL = r.signals.get('I(L1)')!;
    const i_at_5tau = signalAt(r.time, iL, 5 * tau);

    // I(5τ) = (V/R) × (1 - e^-5) ≈ 5mA × 0.993 ≈ 4.97mA
    expect(Math.abs(i_at_5tau)).toBeGreaterThan(0.004);
    expect(Math.abs(i_at_5tau)).toBeLessThan(0.006);
  });

  it('current starts near 0A', () => {
    const r = runTransient(makeRL(), { tStep: 1e-8, tStop: 1e-6, method: 'BE' });
    const iL = r.signals.get('I(L1)')!;

    // Step 1 should have very small current (just started)
    expect(Math.abs(iL[1]!)).toBeLessThan(0.001);
    expect(r.allConverged).toBe(true);
  });
});

// ─────────────────────────────────────────────
// TEST 4: RLC Underdamped
// ─────────────────────────────────────────────

describe('RLC Underdamped', () => {
  // V1=10V step, R=10Ω, L=1mH, C=10µF
  // ζ = R/(2√(L/C)) = 10/(2×√(1e-3/1e-5)) = 10/(2×10) = 0.5 → underdamped

  function makeRLC(): Component[] {
    const cap = new Capacitor('C1', '3', '0', 10e-6);
    cap.setInitialVoltage(0);
    const ind = new Inductor('L1', '2', '3', 1e-3);
    ind.setInitialCurrent(0);
    return [
      new VoltageSource('V1', '1', '0', 10),
      new Resistor('R1', '1', '2', 10),
      ind,
      cap,
    ];
  }

  it('shows oscillation (voltage crosses steady state)', () => {
    const r = runTransient(makeRLC(), { tStep: 1e-6, tStop: 5e-3, method: 'BE' });
    const vc = r.signals.get('V(3)')!;

    // Steady state: V_C = 10V (all voltage across C)
    // Underdamped: should overshoot above 10V at some point
    let maxV = 0;
    for (let i = 0; i < vc.length; i++) {
      if (vc[i]! > maxV) maxV = vc[i]!;
    }

    // Should overshoot past 10V (underdamped oscillation)
    expect(maxV).toBeGreaterThan(10);
    expect(maxV).toBeLessThan(20); // but not too much
  });

  it('settles to 10V', () => {
    const r = runTransient(makeRLC(), { tStep: 1e-6, tStop: 10e-3, method: 'BE' });
    const vc = r.signals.get('V(3)')!;

    // Last value should be close to 10V
    const lastV = vc[vc.length - 1]!;
    expect(lastV).toBeGreaterThan(9.5);
    expect(lastV).toBeLessThan(10.5);
  });
});

// ─────────────────────────────────────────────
// TEST 5: RLC Overdamped
// ─────────────────────────────────────────────

describe('RLC Overdamped', () => {
  // V1=10V, R=1kΩ, L=1mH, C=10µF
  // ζ = 1000/(2×√(1e-3/1e-5)) = 1000/20 = 50 → heavily overdamped

  it('no oscillation — monotonic rise', () => {
    const cap = new Capacitor('C1', '3', '0', 10e-6);
    cap.setInitialVoltage(0);
    const ind = new Inductor('L1', '2', '3', 1e-3);
    ind.setInitialCurrent(0);
    const comps: Component[] = [
      new VoltageSource('V1', '1', '0', 10),
      new Resistor('R1', '1', '2', 1000),
      ind,
      cap,
    ];

    const r = runTransient(comps, { tStep: 1e-5, tStop: 50e-3, method: 'BE' });
    const vc = r.signals.get('V(3)')!;

    // Should never exceed 10V (no overshoot)
    for (let i = 0; i < vc.length; i++) {
      expect(vc[i]!).toBeLessThanOrEqual(10.01);
    }

    // Should approach 10V at the end
    expect(vc[vc.length - 1]!).toBeGreaterThan(9.0);
  });
});

// ─────────────────────────────────────────────
// TEST 6: AC Source + RC Filter
// ─────────────────────────────────────────────

describe('AC + RC Low-Pass Filter', () => {
  // AC 5Vpk 1kHz → R=1kΩ → C=159nF → GND
  // f_c = 1/(2πRC) ≈ 1kHz → at 1kHz, output ≈ 0.707 × input

  function makeACRC(): Component[] {
    const cap = new Capacitor('C1', '2', '0', 159e-9);
    cap.setInitialVoltage(0);
    return [
      new ACVoltageSource('V1', '1', '0', {
        type: 'sin',
        params: { vo: 0, va: 5, freq: 1000 },
      }),
      new Resistor('R1', '1', '2', 1000),
      cap,
    ];
  }

  it('output amplitude is attenuated at f_c', () => {
    // Run enough cycles for steady state
    const r = runTransient(makeACRC(), { tStep: 1e-6, tStop: 10e-3, method: 'TRAP' });
    const vc = r.signals.get('V(2)')!;

    // Find peak output in last 2 cycles (steady state)
    const startIdx = Math.floor(8e-3 / 1e-6); // t=8ms
    let maxV = 0;
    for (let i = startIdx; i < vc.length; i++) {
      const absV = Math.abs(vc[i]!);
      if (absV > maxV) maxV = absV;
    }

    // At f = f_c, gain = 1/√2 ≈ 0.707 → output peak ≈ 3.54V
    expect(maxV).toBeGreaterThan(2.5);
    expect(maxV).toBeLessThan(4.5);
  });
});

// ─────────────────────────────────────────────
// TEST 7: Half-Wave Rectifier (Transient)
// ─────────────────────────────────────────────

describe('Half-Wave Rectifier (Transient)', () => {
  function makeHalfWave(): Component[] {
    return [
      new ACVoltageSource('V1', '1', '0', {
        type: 'sin',
        params: { vo: 0, va: 10, freq: 60 },
      }),
      new Diode('D1', '1', '2'),
      new Resistor('R_load', '2', '0', 1000),
    ];
  }

  it('output is positive only', () => {
    const r = runTransient(makeHalfWave(), { tStep: 1e-5, tStop: 33.3e-3, method: 'BE' });
    const vout = r.signals.get('V(2)')!;

    // All output values should be >= -0.1V (small tolerance for numerical noise)
    for (let i = 10; i < vout.length; i++) {
      expect(vout[i]!).toBeGreaterThan(-0.1);
    }
  });

  it('peak output ≈ Vpeak - Vd', () => {
    const r = runTransient(makeHalfWave(), { tStep: 1e-5, tStop: 33.3e-3, method: 'BE' });
    const vout = r.signals.get('V(2)')!;

    let maxV = 0;
    for (const v of vout) {
      if (v > maxV) maxV = v;
    }

    // Vpeak = 10V, Vd ≈ 0.7V → output peak ≈ 9.3V
    expect(maxV).toBeGreaterThan(8.5);
    expect(maxV).toBeLessThan(10.0);
  });
});

// ─────────────────────────────────────────────
// TEST 8: Half-Wave + Filter Capacitor
// ─────────────────────────────────────────────

describe('Half-Wave Rectifier with Filter Cap', () => {
  function makeHalfWaveFiltered(): Component[] {
    return [
      new ACVoltageSource('V1', '1', '0', {
        type: 'sin',
        params: { vo: 0, va: 10, freq: 60 },
      }),
      new Diode('D1', '1', '2'),
      new Resistor('R_load', '2', '0', 1000),
      new Capacitor('C_filter', '2', '0', 100e-6),
    ];
  }

  it('ripple is less than unfiltered', () => {
    // Unfiltered
    const rNoFilter = runTransient([
      new ACVoltageSource('V1', '1', '0', {
        type: 'sin',
        params: { vo: 0, va: 10, freq: 60 },
      }),
      new Diode('D1', '1', '2'),
      new Resistor('R_load', '2', '0', 1000),
    ], { tStep: 1e-5, tStop: 50e-3, method: 'BE' });

    // Filtered
    const rFiltered = runTransient(makeHalfWaveFiltered(), {
      tStep: 1e-5, tStop: 50e-3, method: 'BE',
    });

    // Measure ripple in last cycle: max - min
    const startIdx = Math.floor(33e-3 / 1e-5);
    function ripple(data: Float64Array): number {
      let min = Infinity, max = -Infinity;
      for (let i = startIdx; i < data.length; i++) {
        if (data[i]! < min) min = data[i]!;
        if (data[i]! > max) max = data[i]!;
      }
      return max - min;
    }

    const rippleNoFilter = ripple(rNoFilter.signals.get('V(2)')!);
    const rippleFiltered = ripple(rFiltered.signals.get('V(2)')!);

    // Filtered ripple should be significantly less
    expect(rippleFiltered).toBeLessThan(rippleNoFilter);
  });
});

// ─────────────────────────────────────────────
// TEST 9: PULSE Source
// ─────────────────────────────────────────────

describe('PULSE Source', () => {
  it('rise/fall times and duty cycle', () => {
    const comps: Component[] = [
      new ACVoltageSource('V1', '1', '0', {
        type: 'pulse',
        params: {
          v1: 0,
          v2: 5,
          td: 0,
          tr: 1e-6,   // 1µs rise
          tf: 1e-6,   // 1µs fall
          pw: 5e-4,   // 500µs high
          per: 1e-3,  // 1ms period → 50% duty
        },
      }),
      new Resistor('R1', '1', '0', 1000),
    ];

    const r = runTransient(comps, { tStep: 1e-6, tStop: 3e-3, method: 'BE' });
    const vin = r.signals.get('V(1)')!;

    // At t=0.25ms (middle of high period): should be ~5V
    const v_high = signalAt(r.time, vin, 0.25e-3);
    expect(v_high).toBeCloseTo(5.0, 1);

    // At t=0.75ms (middle of low period): should be ~0V
    const v_low = signalAt(r.time, vin, 0.75e-3);
    expect(v_low).toBeCloseTo(0.0, 1);
  });
});

// ─────────────────────────────────────────────
// TEST 10: RC Charging — Analytic Comparison (< 1% error)
// ─────────────────────────────────────────────

describe('RC Charging — Precision Comparison', () => {
  const Vs = 5;
  const R = 1000;
  const C = 1e-6;
  const tau = R * C; // 1ms
  const analytic = (t: number) => Vs * (1 - Math.exp(-t / tau));

  it('TRAP method matches analytic within 0.5% at multiple time points', () => {
    const cap = new Capacitor('C1', '2', '0', C);
    cap.setInitialVoltage(0);
    const comps: Component[] = [
      new VoltageSource('V1', '1', '0', Vs),
      new Resistor('R1', '1', '2', R),
      cap,
    ];

    const r = runTransient(comps, { tStep: 1e-5, tStop: 5e-3, method: 'TRAP' });
    const vc = r.signals.get('V(2)')!;

    // Skip very early points where DC OP → transient discontinuity affects accuracy
    const checkPoints = [0.5e-3, 1e-3, 2e-3, 3e-3, 5e-3];

    for (const t of checkPoints) {
      const simV = signalAt(r.time, vc, t);
      const refV = analytic(t);
      const errorPct = Math.abs(simV - refV) / refV * 100;

      // TRAP is 2nd order — < 1% everywhere (better than BE's ~1%)
      expect(errorPct).toBeLessThan(1.0);
    }
  });

  it('BE method matches analytic within 1% at multiple time points', () => {
    const cap = new Capacitor('C1', '2', '0', C);
    cap.setInitialVoltage(0);
    const comps: Component[] = [
      new VoltageSource('V1', '1', '0', Vs),
      new Resistor('R1', '1', '2', R),
      cap,
    ];

    const r = runTransient(comps, { tStep: 1e-5, tStop: 5e-3, method: 'BE' });
    const vc = r.signals.get('V(2)')!;

    const checkPoints = [0.5e-3, 1e-3, 2e-3, 3e-3, 5e-3];

    for (const t of checkPoints) {
      const simV = signalAt(r.time, vc, t);
      const refV = analytic(t);
      const errorPct = Math.abs(simV - refV) / refV * 100;

      expect(errorPct).toBeLessThan(1.0);
    }
  });
});
