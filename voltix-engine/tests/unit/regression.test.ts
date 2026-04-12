/**
 * Regression tests — ensure the Newton-Raphson DC solver
 * produces identical results to the direct MNA solver
 * for purely linear circuits (no diodes).
 *
 * If any of these fail, the N-R wrapper has introduced a bug.
 */

import { describe, it, expect } from 'vitest';
import { MNASystem } from '../../src/core/mna';
import { solveDCOperatingPoint } from '../../src/core/newton';
import { Resistor } from '../../src/components/resistor';
import { VoltageSource } from '../../src/components/vsource';
import { CurrentSource } from '../../src/components/isource';
import type { Component } from '../../src/components/component';

/**
 * Solve a circuit with both the direct MNA solver and the N-R solver,
 * then compare results. They should be identical for linear circuits.
 */
function compareSolvers(components: Component[]) {
  // Direct MNA
  const mna = new MNASystem();
  for (const c of components) mna.addComponent(c);
  const direct = mna.solve();

  // N-R wrapper
  const nr = solveDCOperatingPoint(components);

  // N-R should converge in 1 iteration for linear circuits
  expect(nr.converged).toBe(true);
  expect(nr.iterations).toBe(1);

  // Compare all node voltages
  for (const [node, vDirect] of direct.nodeVoltages) {
    const vNR = nr.nodeVoltages.get(node);
    expect(vNR).toBeDefined();
    expect(vNR).toBeCloseTo(vDirect, 10);
  }

  // Compare branch currents
  for (const [name, iDirect] of direct.branchCurrents) {
    const iNR = nr.branchCurrents.get(name);
    expect(iNR).toBeDefined();
    expect(iNR).toBeCloseTo(iDirect, 10);
  }
}

describe('Regression: N-R matches direct MNA for linear circuits', () => {
  it('voltage divider (equal)', () => {
    compareSolvers([
      new VoltageSource('V1', '1', '0', 10),
      new Resistor('R1', '1', '2', 1000),
      new Resistor('R2', '2', '0', 1000),
    ]);
  });

  it('voltage divider (unequal)', () => {
    compareSolvers([
      new VoltageSource('V1', '1', '0', 12),
      new Resistor('R1', '1', '2', 1000),
      new Resistor('R2', '2', '0', 2200),
    ]);
  });

  it('three resistors in series', () => {
    compareSolvers([
      new VoltageSource('V1', '1', '0', 9),
      new Resistor('R1', '1', '2', 1000),
      new Resistor('R2', '2', '3', 2000),
      new Resistor('R3', '3', '0', 3000),
    ]);
  });

  it('parallel resistors', () => {
    compareSolvers([
      new VoltageSource('V1', '1', '0', 10),
      new Resistor('R1', '1', '0', 1000),
      new Resistor('R2', '1', '0', 1000),
    ]);
  });

  it('current source + resistor', () => {
    compareSolvers([
      new CurrentSource('I1', '1', '0', 0.001),
      new Resistor('R1', '1', '0', 1000),
    ]);
  });

  it('mixed sources', () => {
    compareSolvers([
      new VoltageSource('V1', '1', '0', 5),
      new Resistor('R1', '1', '2', 1000),
      new CurrentSource('I1', '2', '0', 0.002),
      new Resistor('R2', '2', '0', 2000),
    ]);
  });

  it('Wheatstone bridge (balanced)', () => {
    compareSolvers([
      new VoltageSource('V1', '1', '0', 10),
      new Resistor('R1', '1', 'a', 1000),
      new Resistor('R2', '1', 'b', 2000),
      new Resistor('R3', 'a', '0', 1000),
      new Resistor('R4', 'b', '0', 2000),
    ]);
  });

  it('two voltage sources', () => {
    compareSolvers([
      new VoltageSource('V1', '1', '0', 10),
      new VoltageSource('V2', '2', '0', 5),
      new Resistor('R1', '1', '2', 1000),
    ]);
  });

  it('10-stage ladder', () => {
    const comps: Component[] = [
      new VoltageSource('V1', '1', '0', 10),
    ];
    for (let i = 1; i <= 10; i++) {
      comps.push(new Resistor(`Rs${i}`, String(i), i < 10 ? String(i + 1) : '0', 100));
      if (i > 1) comps.push(new Resistor(`Rp${i}`, String(i), '0', 1000));
    }
    compareSolvers(comps);
  });

  it('voltage sources in series', () => {
    compareSolvers([
      new VoltageSource('V1', '1', '0', 6),
      new VoltageSource('V2', '2', '1', 3),
      new Resistor('R1', '2', '0', 1000),
    ]);
  });
});
