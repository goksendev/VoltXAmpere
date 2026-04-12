import { describe, it, expect } from 'vitest';
import { SimulationController } from '../../src/worker/sim-controller';
import { serializeCircuit } from '../../src/netlist/builder';
import { solveDCOperatingPoint } from '../../src/core/newton';
import { runTransient } from '../../src/analysis/transient';
import { runAC } from '../../src/analysis/ac';
import { Resistor } from '../../src/components/resistor';
import { VoltageSource } from '../../src/components/vsource';
import { CurrentSource } from '../../src/components/isource';
import { Capacitor } from '../../src/components/capacitor';
import { Inductor } from '../../src/components/inductor';
import { Diode } from '../../src/components/diode';
import { ACVoltageSource } from '../../src/components/acsource';
import type { Component } from '../../src/components/component';

// All tests use inline mode (useWorker=false) since Vitest doesn't
// have a browser Worker environment. The controller logic and
// serialization are fully exercised. Browser Worker integration
// will be validated in Phase 2.

// ─────────────────────────────────────────────
// TEST 1: Controller lifecycle
// ─────────────────────────────────────────────

describe('SimulationController lifecycle', () => {
  it('creates and terminates without error', () => {
    const sim = new SimulationController(false);
    sim.terminate();
  });

  it('abort does not throw when no simulation running', () => {
    const sim = new SimulationController(false);
    expect(() => sim.abort()).not.toThrow();
    sim.terminate();
  });
});

// ─────────────────────────────────────────────
// TEST 2: DC via controller matches direct
// ─────────────────────────────────────────────

describe('Controller DC — cross-check with direct solver', () => {
  it('voltage divider', async () => {
    const components: Component[] = [
      new VoltageSource('V1', '1', '0', 10),
      new Resistor('R1', '1', '2', 1000),
      new Resistor('R2', '2', '0', 2200),
    ];

    // Direct
    const directResult = solveDCOperatingPoint(components);

    // Via controller
    const sim = new SimulationController(false);
    const circuit = serializeCircuit(components);
    const ctrlResult = await sim.runDC(circuit);
    sim.terminate();

    expect(ctrlResult.converged).toBe(directResult.converged);
    expect(ctrlResult.nodeVoltages.get('2')).toBeCloseTo(
      directResult.nodeVoltages.get('2')!, 10
    );
  });

  it('diode circuit', async () => {
    const components: Component[] = [
      new VoltageSource('V1', '1', '0', 5),
      new Diode('D1', '1', '2'),
      new Resistor('R1', '2', '0', 1000),
    ];

    const direct = solveDCOperatingPoint(components);
    const sim = new SimulationController(false);
    const ctrl = await sim.runDC(serializeCircuit(components));
    sim.terminate();

    expect(ctrl.converged).toBe(true);
    // Diode Vf should match
    const directVd = direct.nodeVoltages.get('1')! - direct.nodeVoltages.get('2')!;
    const ctrlVd = ctrl.nodeVoltages.get('1')! - ctrl.nodeVoltages.get('2')!;
    expect(ctrlVd).toBeCloseTo(directVd, 5);
  });
});

// ─────────────────────────────────────────────
// TEST 3: Transient via controller matches direct
// ─────────────────────────────────────────────

describe('Controller Transient — cross-check', () => {
  it('RC charging matches direct', async () => {
    const opts = { tStep: 1e-5, tStop: 1e-3, method: 'BE' as const };

    // Build fresh components for direct run
    function makeRC(): Component[] {
      const cap = new Capacitor('C1', '2', '0', 1e-6);
      cap.setInitialVoltage(0);
      return [new VoltageSource('V1', '1', '0', 5), new Resistor('R1', '1', '2', 1000), cap];
    }

    // Direct run (with its own instances)
    const directResult = runTransient(makeRC(), opts);

    // Controller run (serialize from fresh instances)
    const sim = new SimulationController(false);
    const circuit = serializeCircuit(makeRC());
    const ctrlResult = await sim.runTransient(circuit, opts);
    sim.terminate();

    expect(ctrlResult.allConverged).toBe(true);
    expect(ctrlResult.steps).toBe(directResult.steps);

    // Compare V(2) at last step
    const directV = directResult.signals.get('V(2)')!;
    const ctrlV = ctrlResult.signals.get('V(2)')!;
    expect(ctrlV[ctrlV.length - 1]).toBeCloseTo(directV[directV.length - 1]!, 5);
  });
});

// ─────────────────────────────────────────────
// TEST 4: AC via controller matches direct
// ─────────────────────────────────────────────

describe('Controller AC — cross-check', () => {
  it('RC low-pass matches direct', async () => {
    const components: Component[] = [
      new VoltageSource('V1', '1', '0', 1),
      new Resistor('R1', '1', '2', 1000),
      new Capacitor('C1', '2', '0', 159.155e-9),
    ];

    const acSource = { name: 'V1' };
    const acOpts = { fStart: 100, fStop: 10000, pointsPerDecade: 10 };

    // Direct
    const directResult = runAC(components, acSource, acOpts);

    // Via controller
    const sim = new SimulationController(false);
    const circuit = serializeCircuit(components);
    const ctrlResult = await sim.runAC(circuit, acSource, acOpts);
    sim.terminate();

    expect(ctrlResult.numPoints).toBe(directResult.numPoints);

    // Compare magnitudes at first frequency point
    const directMag = directResult.magnitude.get('V(2)')!;
    const ctrlMag = ctrlResult.magnitude.get('V(2)')!;
    expect(ctrlMag[0]).toBeCloseTo(directMag[0]!, 5);
  });
});

// ─────────────────────────────────────────────
// TEST 5: Progress callback
// ─────────────────────────────────────────────

describe('Progress callback', () => {
  it('reports progress 0-100 during transient', async () => {
    const cap = new Capacitor('C1', '2', '0', 1e-6);
    cap.setInitialVoltage(0);
    const components: Component[] = [
      new VoltageSource('V1', '1', '0', 5),
      new Resistor('R1', '1', '2', 1000),
      cap,
    ];

    const progressValues: number[] = [];
    const sim = new SimulationController(false);
    const circuit = serializeCircuit(components);

    await sim.runTransient(
      circuit,
      { tStep: 1e-4, tStop: 1e-2, method: 'BE' },
      (pct) => progressValues.push(pct),
    );
    sim.terminate();

    // Should have progress reports
    expect(progressValues.length).toBeGreaterThan(5);

    // First should be 1% (step 1 of 101)
    expect(progressValues[0]).toBeGreaterThanOrEqual(1);

    // Last should be 100%
    expect(progressValues[progressValues.length - 1]).toBe(100);

    // Monotonically increasing
    for (let i = 1; i < progressValues.length; i++) {
      expect(progressValues[i]!).toBeGreaterThanOrEqual(progressValues[i - 1]!);
    }
  });
});

// ─────────────────────────────────────────────
// TEST 6: Abort
// ─────────────────────────────────────────────

describe('Abort', () => {
  it('aborts a long transient simulation early', async () => {
    const cap = new Capacitor('C1', '2', '0', 1e-6);
    cap.setInitialVoltage(0);
    const components: Component[] = [
      new VoltageSource('V1', '1', '0', 5),
      new Resistor('R1', '1', '2', 1000),
      cap,
    ];

    const sim = new SimulationController(false);
    const circuit = serializeCircuit(components);

    // Start a long simulation, abort after first progress report
    let aborted = false;
    const result = await sim.runTransient(
      circuit,
      { tStep: 1e-5, tStop: 1, method: 'BE' }, // Very long: 100001 steps
      (pct) => {
        if (pct >= 1 && !aborted) {
          sim.abort();
          aborted = true;
        }
      },
    );
    sim.terminate();

    // Should have stopped early (way before 100001 steps)
    expect(result.steps).toBeLessThan(10000);
    expect(aborted).toBe(true);
  });
});

// ─────────────────────────────────────────────
// TEST 7: Error handling
// ─────────────────────────────────────────────

describe('Error handling', () => {
  it('rejects on singular matrix (conflicting voltage sources)', async () => {
    const components: Component[] = [
      new VoltageSource('V1', '1', '0', 5),
      new VoltageSource('V2', '1', '0', 10), // conflict!
    ];

    const sim = new SimulationController(false);
    const circuit = serializeCircuit(components);

    await expect(sim.runDC(circuit)).rejects.toThrow();
    sim.terminate();
  });
});

// ─────────────────────────────────────────────
// TEST 8: Serialization round-trip
// ─────────────────────────────────────────────

describe('Circuit serialization', () => {
  it('round-trips all component types', () => {
    const cap = new Capacitor('C1', '2', '0', 1e-6);
    cap.setInitialVoltage(3.3);
    const ind = new Inductor('L1', '3', '0', 10e-3);
    ind.setInitialCurrent(0.005);

    const components: Component[] = [
      new VoltageSource('V1', '1', '0', 12),
      new CurrentSource('I1', '1', '0', 0.001),
      new Resistor('R1', '1', '2', 1000),
      cap,
      ind,
      new Diode('D1', '2', '3', { IS: 1e-14, N: 1.5 }),
      new ACVoltageSource('Vac', '4', '0', {
        type: 'sin', params: { vo: 0, va: 5, freq: 1000 },
      }),
    ];

    const circuit = serializeCircuit(components);
    expect(circuit.components).toHaveLength(7);

    // Check serialized types
    expect(circuit.components[0]!.type).toBe('vsource');
    expect(circuit.components[1]!.type).toBe('isource');
    expect(circuit.components[2]!.type).toBe('resistor');
    expect(circuit.components[3]!.type).toBe('capacitor');
    expect(circuit.components[4]!.type).toBe('inductor');
    expect(circuit.components[5]!.type).toBe('diode');
    expect(circuit.components[6]!.type).toBe('acsource');

    // Check IC values preserved
    const capDesc = circuit.components[3]!;
    if (capDesc.type === 'capacitor') {
      expect(capDesc.ic).toBe(3.3);
    }
    const indDesc = circuit.components[4]!;
    if (indDesc.type === 'inductor') {
      expect(indDesc.ic).toBe(0.005);
    }
  });
});
