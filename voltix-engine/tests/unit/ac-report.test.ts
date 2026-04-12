import { describe, it, expect } from 'vitest';
import { runAC } from '../../src/analysis/ac';
import { Complex } from '../../src/utils/complex';
import { Resistor } from '../../src/components/resistor';
import { Capacitor } from '../../src/components/capacitor';
import { VoltageSource } from '../../src/components/vsource';
import type { Component } from '../../src/components/component';

describe('AC Precision Report', () => {
  it('RC Low-Pass: analytic vs simulated at key frequencies', () => {
    const R = 1000;
    const C = 159.155e-9;
    const fc = 1 / (2 * Math.PI * R * C);

    const comps: Component[] = [
      new VoltageSource('V1', '1', '0', 1),
      new Resistor('R1', '1', '2', R),
      new Capacitor('C1', '2', '0', C),
    ];

    const r = runAC(comps, { name: 'V1' }, {
      fStart: 10, fStop: 100000, pointsPerDecade: 100,
    });

    const testFreqs = [10, 100, 500, 1000, 2000, 5000, 10000, 50000, 100000];

    console.log('\n══════════════════════════════════════════════════════');
    console.log('  AC PRECISION REPORT — RC Low-Pass (fc ≈ 1000Hz)');
    console.log('══════════════════════════════════════════════════════\n');
    console.log('  Freq(Hz) │ Sim(dB) │ Ref(dB) │ Err(dB)│ Sim(°)  │ Ref(°)  │ Err(°)');
    console.log('  ─────────┼─────────┼─────────┼────────┼─────────┼─────────┼───────');

    const magArr = r.magnitude.get('V(2)')!;
    const phaseArr = r.phase.get('V(2)')!;

    for (const f of testFreqs) {
      // Find closest frequency
      let bestIdx = 0;
      let bestDist = Infinity;
      for (let i = 0; i < r.frequencies.length; i++) {
        const dist = Math.abs(r.frequencies[i]! - f);
        if (dist < bestDist) { bestDist = dist; bestIdx = i; }
      }

      const simDB = magArr[bestIdx]!;
      const simPhase = phaseArr[bestIdx]!;

      // Analytic: H(f) = 1 / (1 + jf/fc)
      const H = Complex.ONE.div(new Complex(1, f / fc));
      const refDB = H.magnitudeDB;
      const refPhase = H.phaseDeg;

      const errDB = Math.abs(simDB - refDB);
      const errPhase = Math.abs(simPhase - refPhase);

      console.log(
        `  ${String(f).padStart(7)} │ ${simDB.toFixed(2).padStart(7)} │ ${refDB.toFixed(2).padStart(7)} │ ${errDB.toFixed(3).padStart(6)} │ ${simPhase.toFixed(2).padStart(7)} │ ${refPhase.toFixed(2).padStart(7)} │ ${errPhase.toFixed(3).padStart(5)}`
      );

      expect(errDB).toBeLessThan(0.1);
      expect(errPhase).toBeLessThan(1);
    }

    console.log('\n══════════════════════════════════════════════════════\n');
  });
});
