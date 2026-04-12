import { describe, it, expect } from 'vitest';
import { solveDCOperatingPoint } from '../../src/core/newton';
import { Resistor } from '../../src/components/resistor';
import { VoltageSource } from '../../src/components/vsource';
import { Diode } from '../../src/components/diode';
import type { Component } from '../../src/components/component';

describe('Diode Report — detailed values', () => {
  it('prints key metrics for review', () => {
    const circuits = [
      {
        name: '5V + D + 1kΩ (IS=1e-14, N=1)',
        comps: [
          new VoltageSource('V1', '1', '0', 5),
          new Diode('D1', '1', '2'),
          new Resistor('R1', '2', '0', 1000),
        ] as Component[],
      },
      {
        name: '12V + D + 1kΩ',
        comps: [
          new VoltageSource('V1', '1', '0', 12),
          new Diode('D1', '1', '2'),
          new Resistor('R1', '2', '0', 1000),
        ] as Component[],
      },
      {
        name: '5V + 2×D series + 1kΩ',
        comps: [
          new VoltageSource('V1', '1', '0', 5),
          new Diode('D1', '1', '2'),
          new Diode('D2', '2', '3'),
          new Resistor('R1', '3', '0', 1000),
        ] as Component[],
      },
      {
        name: '5V + D (IS=1e-15, N=2) + 1kΩ',
        comps: [
          new VoltageSource('V1', '1', '0', 5),
          new Diode('D1', '1', '2', { IS: 1e-15, N: 2 }),
          new Resistor('R1', '2', '0', 1000),
        ] as Component[],
      },
      {
        name: '10V + D (half-wave pos)',
        comps: [
          new VoltageSource('V1', '1', '0', 10),
          new Diode('D1', '1', '2'),
          new Resistor('R1', '2', '0', 1000),
        ] as Component[],
      },
    ];

    console.log('\n══════════════════════════════════════════');
    console.log('  DIODE DC ANALYSIS REPORT');
    console.log('══════════════════════════════════════════\n');

    for (const { name, comps } of circuits) {
      const r = solveDCOperatingPoint(comps);
      const nodes = [...r.nodeVoltages.entries()]
        .filter(([n]) => n !== '0')
        .map(([n, v]) => `V(${n})=${v.toFixed(4)}V`)
        .join(', ');

      console.log(`  ${name}`);
      console.log(`    Converged: ${r.converged}, Iterations: ${r.iterations}`);
      console.log(`    ${nodes}`);
      console.log('');

      expect(r.converged).toBe(true);
      expect(r.iterations).toBeLessThanOrEqual(15);
    }

    console.log('══════════════════════════════════════════\n');
  });
});
