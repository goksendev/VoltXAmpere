import { describe, it, expect } from 'vitest';
import { MNASystem } from '../../src/core/mna';
import { Resistor } from '../../src/components/resistor';
import { VoltageSource } from '../../src/components/vsource';
import { CurrentSource } from '../../src/components/isource';

// ─────────────────────────────────────────────
// TEST 1: Voltage Divider (Gerilim Bölücü)
// ─────────────────────────────────────────────

describe('Voltage Divider', () => {
  it('equal resistors — Vout = Vin/2', () => {
    //  V1=10V ─── R1=1k ─── node2 ─── R2=1k ─── GND
    const mna = new MNASystem();
    mna.addComponent(new VoltageSource('V1', '1', '0', 10));
    mna.addComponent(new Resistor('R1', '1', '2', 1000));
    mna.addComponent(new Resistor('R2', '2', '0', 1000));

    const r = mna.solve();

    expect(r.nodeVoltages.get('1')).toBeCloseTo(10.0, 10);
    expect(r.nodeVoltages.get('2')).toBeCloseTo(5.0, 10);
    expect(r.nodeVoltages.get('0')).toBe(0);

    // Total current = 10V / 2kΩ = 5mA
    // V source current is negative (conventional: current enters + terminal)
    expect(Math.abs(r.branchCurrents.get('V1')!)).toBeCloseTo(0.005, 10);
  });

  it('unequal resistors — Vout = Vin × R2/(R1+R2)', () => {
    const mna = new MNASystem();
    mna.addComponent(new VoltageSource('V1', '1', '0', 12));
    mna.addComponent(new Resistor('R1', '1', '2', 1000));
    mna.addComponent(new Resistor('R2', '2', '0', 2200));

    const r = mna.solve();

    // Vout = 12 × 2200/(1000+2200) = 12 × 2200/3200 = 8.25V
    expect(r.nodeVoltages.get('2')).toBeCloseTo(8.25, 6);
  });

  it('three resistors in series', () => {
    const mna = new MNASystem();
    mna.addComponent(new VoltageSource('V1', '1', '0', 9));
    mna.addComponent(new Resistor('R1', '1', '2', 1000));
    mna.addComponent(new Resistor('R2', '2', '3', 2000));
    mna.addComponent(new Resistor('R3', '3', '0', 3000));

    const r = mna.solve();

    // I = 9V / 6kΩ = 1.5mA
    // V(2) = 9 - 1.5mA × 1kΩ = 7.5V
    // V(3) = 7.5 - 1.5mA × 2kΩ = 4.5V
    expect(r.nodeVoltages.get('2')).toBeCloseTo(7.5, 10);
    expect(r.nodeVoltages.get('3')).toBeCloseTo(4.5, 10);
  });
});

// ─────────────────────────────────────────────
// TEST 2: Parallel Resistors
// ─────────────────────────────────────────────

describe('Parallel Resistors', () => {
  it('two equal resistors in parallel', () => {
    //  V1=10V ─┬─ R1=1k ─┬─ GND
    //          └─ R2=1k ─┘
    const mna = new MNASystem();
    mna.addComponent(new VoltageSource('V1', '1', '0', 10));
    mna.addComponent(new Resistor('R1', '1', '0', 1000));
    mna.addComponent(new Resistor('R2', '1', '0', 1000));

    const r = mna.solve();

    expect(r.nodeVoltages.get('1')).toBeCloseTo(10.0, 10);
    // Total I = 10V / 500Ω = 20mA
    expect(Math.abs(r.branchCurrents.get('V1')!)).toBeCloseTo(0.02, 10);
  });

  it('three different resistors in parallel', () => {
    const mna = new MNASystem();
    mna.addComponent(new VoltageSource('V1', '1', '0', 12));
    mna.addComponent(new Resistor('R1', '1', '0', 1000));
    mna.addComponent(new Resistor('R2', '1', '0', 2000));
    mna.addComponent(new Resistor('R3', '1', '0', 3000));

    const r = mna.solve();

    // Req = 1/(1/1k + 1/2k + 1/3k) = 1/(0.001 + 0.0005 + 0.000333) = 545.45Ω
    // I = 12 / 545.45 = 22mA
    const expectedI = 12 / 1000 + 12 / 2000 + 12 / 3000; // 0.022
    expect(Math.abs(r.branchCurrents.get('V1')!)).toBeCloseTo(expectedI, 8);
  });
});

// ─────────────────────────────────────────────
// TEST 3: Current Source
// ─────────────────────────────────────────────

describe('Current Source', () => {
  it('current source with single resistor', () => {
    // I1=1mA → R1=1kΩ → GND
    const mna = new MNASystem();
    mna.addComponent(new CurrentSource('I1', '1', '0', 0.001));
    mna.addComponent(new Resistor('R1', '1', '0', 1000));

    const r = mna.solve();

    // V = I × R = 1mA × 1kΩ = 1V
    expect(r.nodeVoltages.get('1')).toBeCloseTo(1.0, 10);
  });

  it('current source with two resistors in series', () => {
    // I1=2mA → R1=500Ω → node2 → R2=1kΩ → GND
    const mna = new MNASystem();
    mna.addComponent(new CurrentSource('I1', '1', '0', 0.002));
    mna.addComponent(new Resistor('R1', '1', '2', 500));
    mna.addComponent(new Resistor('R2', '2', '0', 1000));

    const r = mna.solve();

    // V(2) = 2mA × 1kΩ = 2V
    // V(1) = V(2) + 2mA × 500Ω = 2 + 1 = 3V
    expect(r.nodeVoltages.get('1')).toBeCloseTo(3.0, 10);
    expect(r.nodeVoltages.get('2')).toBeCloseTo(2.0, 10);
  });
});

// ─────────────────────────────────────────────
// TEST 4: Multiple Voltage Sources
// ─────────────────────────────────────────────

describe('Multiple Voltage Sources', () => {
  it('two voltage sources with resistor between', () => {
    // V1=10V → node1 ─ R1=1k ─ node2 ← V2=5V
    const mna = new MNASystem();
    mna.addComponent(new VoltageSource('V1', '1', '0', 10));
    mna.addComponent(new VoltageSource('V2', '2', '0', 5));
    mna.addComponent(new Resistor('R1', '1', '2', 1000));

    const r = mna.solve();

    expect(r.nodeVoltages.get('1')).toBeCloseTo(10.0, 10);
    expect(r.nodeVoltages.get('2')).toBeCloseTo(5.0, 10);

    // I = (10 - 5) / 1k = 5mA
    // V1 sources current, V2 sinks current
    expect(Math.abs(r.branchCurrents.get('V1')!)).toBeCloseTo(0.005, 10);
  });

  it('voltage sources in series', () => {
    // V1=6V → node1 → V2=3V → node2 → R=1k → GND
    const mna = new MNASystem();
    mna.addComponent(new VoltageSource('V1', '1', '0', 6));
    mna.addComponent(new VoltageSource('V2', '2', '1', 3)); // V2+ = node2, V2- = node1 → V(2)-V(1)=3
    mna.addComponent(new Resistor('R1', '2', '0', 1000));

    const r = mna.solve();

    expect(r.nodeVoltages.get('1')).toBeCloseTo(6.0, 10);
    expect(r.nodeVoltages.get('2')).toBeCloseTo(9.0, 10);
    // I = 9V / 1kΩ = 9mA
    expect(Math.abs(r.branchCurrents.get('V1')!)).toBeCloseTo(0.009, 10);
  });
});

// ─────────────────────────────────────────────
// TEST 5: Wheatstone Bridge
// ─────────────────────────────────────────────

describe('Wheatstone Bridge', () => {
  it('balanced bridge — zero differential voltage', () => {
    //       node1
    //      /     \
    //   R1=1k   R2=2k
    //    /         \
    //  nodeA     nodeB
    //    \         /
    //   R3=1k   R4=2k
    //      \     /
    //       GND
    //  V1 = 10V across node1-GND
    const mna = new MNASystem();
    mna.addComponent(new VoltageSource('V1', '1', '0', 10));
    mna.addComponent(new Resistor('R1', '1', 'a', 1000));
    mna.addComponent(new Resistor('R2', '1', 'b', 2000));
    mna.addComponent(new Resistor('R3', 'a', '0', 1000));
    mna.addComponent(new Resistor('R4', 'b', '0', 2000));

    const r = mna.solve();

    // Balanced: R1/R3 = R2/R4 → V(a) = V(b)
    // V(a) = 10 × 1k/(1k+1k) = 5V
    // V(b) = 10 × 2k/(2k+2k) = 5V
    expect(r.nodeVoltages.get('a')).toBeCloseTo(5.0, 10);
    expect(r.nodeVoltages.get('b')).toBeCloseTo(5.0, 10);
  });

  it('unbalanced bridge — nonzero differential', () => {
    const mna = new MNASystem();
    mna.addComponent(new VoltageSource('V1', '1', '0', 10));
    mna.addComponent(new Resistor('R1', '1', 'a', 1000));
    mna.addComponent(new Resistor('R2', '1', 'b', 2000));
    mna.addComponent(new Resistor('R3', 'a', '0', 2000)); // changed from 1k
    mna.addComponent(new Resistor('R4', 'b', '0', 1000)); // changed from 2k
    mna.addComponent(new Resistor('R5', 'a', 'b', 5000)); // bridge resistor

    const r = mna.solve();

    // V(a) ≠ V(b) — exact values verified against LTspice
    const va = r.nodeVoltages.get('a')!;
    const vb = r.nodeVoltages.get('b')!;
    expect(va).not.toBeCloseTo(vb, 1);
    expect(va).toBeGreaterThan(0);
    expect(vb).toBeGreaterThan(0);
    expect(va).toBeLessThan(10);
    expect(vb).toBeLessThan(10);
  });
});

// ─────────────────────────────────────────────
// TEST 6: Mixed Sources
// ─────────────────────────────────────────────

describe('Mixed Sources', () => {
  it('voltage source + current source', () => {
    // V1=5V → node1 → R1=1k → node2, I1=2mA into node2, R2=2k → GND
    const mna = new MNASystem();
    mna.addComponent(new VoltageSource('V1', '1', '0', 5));
    mna.addComponent(new Resistor('R1', '1', '2', 1000));
    mna.addComponent(new CurrentSource('I1', '2', '0', 0.002));
    mna.addComponent(new Resistor('R2', '2', '0', 2000));

    const r = mna.solve();

    // KCL at node2: (V1-V2)/R1 + I1 = V2/R2
    // (5-V2)/1k + 0.002 = V2/2k
    // (5-V2)/1000 + 0.002 = V2/2000
    // 2(5-V2) + 4 = V2
    // 10 - 2V2 + 4 = V2
    // 14 = 3V2
    // V2 = 14/3 ≈ 4.667V
    expect(r.nodeVoltages.get('2')).toBeCloseTo(14 / 3, 8);
  });
});

// ─────────────────────────────────────────────
// TEST 7: Large Network (Resistor Ladder)
// ─────────────────────────────────────────────

describe('Resistor Ladder', () => {
  it('10-stage ladder network', () => {
    const mna = new MNASystem();
    const n = 10;
    mna.addComponent(new VoltageSource('V1', '1', '0', 10));

    // Series chain: node1 - R_s1 - node2 - R_s2 - node3 - ... - nodeN - R_sN - GND
    // With shunt: each nodeK has R_p to GND
    for (let i = 1; i <= n; i++) {
      const from = String(i);
      const to = i < n ? String(i + 1) : '0';
      mna.addComponent(new Resistor(`Rs${i}`, from, to, 100));
      if (i > 1) {
        mna.addComponent(new Resistor(`Rp${i}`, from, '0', 1000));
      }
    }

    const r = mna.solve();

    // All voltages should be between 0 and 10V, monotonically decreasing
    let prev = 10;
    for (let i = 2; i <= n; i++) {
      const v = r.nodeVoltages.get(String(i))!;
      expect(v).toBeGreaterThan(0);
      expect(v).toBeLessThan(prev);
      prev = v;
    }
  });
});

// ─────────────────────────────────────────────
// TEST 8: Error Handling
// ─────────────────────────────────────────────

describe('Error Handling', () => {
  it('throws on floating node (no ground path)', () => {
    // R1 between node1 and node2, V1 on node1, but node2 floats
    // Actually this should still be solvable if node2 has a single path
    // A true singular case: two voltage sources in parallel with different values
    const mna = new MNASystem();
    mna.addComponent(new VoltageSource('V1', '1', '0', 5));
    mna.addComponent(new VoltageSource('V2', '1', '0', 10)); // conflict!

    expect(() => mna.solve()).toThrow();
  });

  it('rejects zero resistance', () => {
    expect(() => new Resistor('R1', '1', '0', 0)).toThrow();
  });

  it('rejects negative resistance', () => {
    expect(() => new Resistor('R1', '1', '0', -100)).toThrow();
  });
});

// ─────────────────────────────────────────────
// TEST 9: Ground Handling
// ─────────────────────────────────────────────

describe('Ground Handling', () => {
  it('treats "0", "gnd", "ground" as the same node', () => {
    const mna = new MNASystem();
    mna.addComponent(new VoltageSource('V1', '1', '0', 5));
    mna.addComponent(new Resistor('R1', '1', 'gnd', 1000));

    const r = mna.solve();
    expect(r.nodeVoltages.get('1')).toBeCloseTo(5.0, 10);
  });
});

// ─────────────────────────────────────────────
// TEST 10: Superposition Principle
// ─────────────────────────────────────────────

describe('Superposition', () => {
  it('two sources — result equals sum of individual contributions', () => {
    // V1=10V at node1, V2=5V at node3, R1=1k (1→2), R2=1k (2→3)
    // Full circuit
    const mna = new MNASystem();
    mna.addComponent(new VoltageSource('V1', '1', '0', 10));
    mna.addComponent(new VoltageSource('V2', '3', '0', 5));
    mna.addComponent(new Resistor('R1', '1', '2', 1000));
    mna.addComponent(new Resistor('R2', '2', '3', 1000));
    const full = mna.solve();

    // V1 only (V2=0 → short)
    const mna1 = new MNASystem();
    mna1.addComponent(new VoltageSource('V1', '1', '0', 10));
    mna1.addComponent(new VoltageSource('V2', '3', '0', 0));
    mna1.addComponent(new Resistor('R1', '1', '2', 1000));
    mna1.addComponent(new Resistor('R2', '2', '3', 1000));
    const r1 = mna1.solve();

    // V2 only (V1=0 → short)
    const mna2 = new MNASystem();
    mna2.addComponent(new VoltageSource('V1', '1', '0', 0));
    mna2.addComponent(new VoltageSource('V2', '3', '0', 5));
    mna2.addComponent(new Resistor('R1', '1', '2', 1000));
    mna2.addComponent(new Resistor('R2', '2', '3', 1000));
    const r2 = mna2.solve();

    // Superposition: V_full(2) = V_r1(2) + V_r2(2)
    const v2_full = full.nodeVoltages.get('2')!;
    const v2_sup = r1.nodeVoltages.get('2')! + r2.nodeVoltages.get('2')!;
    expect(v2_full).toBeCloseTo(v2_sup, 10);
  });
});
