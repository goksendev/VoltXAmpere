/**
 * Performance benchmarks — measure execution time for various circuit sizes.
 * Results are informational (not pass/fail) but warn if targets are exceeded.
 */

import { describe, it, expect } from 'vitest';
import { solveDCOperatingPoint } from '../src/core/newton';
import { runTransient } from '../src/analysis/transient';
import { runAC } from '../src/analysis/ac';
import { Resistor } from '../src/components/resistor';
import { VoltageSource } from '../src/components/vsource';
import { Capacitor } from '../src/components/capacitor';
import type { Component } from '../src/components/component';

function buildLadder(n: number): Component[] {
  const comps: Component[] = [new VoltageSource('V1', '1', '0', 10)];
  for (let i = 1; i <= n; i++) {
    comps.push(new Resistor(`Rs${i}`, String(i), i < n ? String(i + 1) : '0', 100));
    if (i > 1) comps.push(new Resistor(`Rp${i}`, String(i), '0', 1000));
  }
  return comps;
}

function buildRCLadder(n: number): Component[] {
  const comps: Component[] = [new VoltageSource('V1', '1', '0', 5)];
  for (let i = 1; i <= n; i++) {
    comps.push(new Resistor(`R${i}`, String(i), i < n ? String(i + 1) : '0', 1000));
    const cap = new Capacitor(`C${i}`, String(i + 1 <= n ? i + 1 : i), '0', 1e-9);
    cap.setInitialVoltage(0);
    if (i < n) comps.push(cap);
  }
  return comps;
}

function measure(fn: () => void, runs: number = 10): number {
  // Warmup
  fn();
  // Measure
  const times: number[] = [];
  for (let i = 0; i < runs; i++) {
    const start = performance.now();
    fn();
    times.push(performance.now() - start);
  }
  return times.reduce((a, b) => a + b, 0) / times.length;
}

describe('Performance Benchmarks', () => {
  it('prints performance table', () => {
    const results: { name: string; avgMs: number; target: string }[] = [];

    // DC benchmarks
    results.push({
      name: '10-node DC',
      avgMs: measure(() => solveDCOperatingPoint(buildLadder(10))),
      target: '< 1ms',
    });
    results.push({
      name: '50-node DC',
      avgMs: measure(() => solveDCOperatingPoint(buildLadder(50))),
      target: '< 5ms',
    });
    results.push({
      name: '100-node DC',
      avgMs: measure(() => solveDCOperatingPoint(buildLadder(100))),
      target: '< 20ms',
    });

    // Transient benchmarks
    results.push({
      name: '10-node tran/1K',
      avgMs: measure(() => {
        const comps = buildRCLadder(10);
        runTransient(comps, { tStep: 1e-6, tStop: 1e-3, method: 'BE' });
      }, 5),
      target: '< 50ms',
    });
    results.push({
      name: '50-node tran/1K',
      avgMs: measure(() => {
        const comps = buildRCLadder(50);
        runTransient(comps, { tStep: 1e-6, tStop: 1e-3, method: 'BE' });
      }, 3),
      target: '< 200ms',
    });
    results.push({
      name: '10-node tran/10K',
      avgMs: measure(() => {
        const comps = buildRCLadder(10);
        runTransient(comps, { tStep: 1e-7, tStop: 1e-3, method: 'BE' });
      }, 3),
      target: '< 500ms',
    });

    // AC benchmarks
    results.push({
      name: '10-node AC/100pts',
      avgMs: measure(() => {
        const comps: Component[] = [
          new VoltageSource('V1', '1', '0', 1),
          ...Array.from({ length: 10 }, (_, i) =>
            new Resistor(`R${i}`, String(i + 1), i < 9 ? String(i + 2) : '0', 1000)),
          new Capacitor('C1', '5', '0', 100e-9),
        ];
        runAC(comps, { name: 'V1' }, { fStart: 10, fStop: 1e6, pointsPerDecade: 10 });
      }),
      target: '< 50ms',
    });
    results.push({
      name: '50-node AC/100pts',
      avgMs: measure(() => {
        const comps = buildLadder(50);
        comps.push(new Capacitor('C1', '25', '0', 100e-9));
        runAC(comps, { name: 'V1' }, { fStart: 10, fStop: 1e6, pointsPerDecade: 10 });
      }, 5),
      target: '< 200ms',
    });

    // Print table
    console.log('\n══════════════════════════════════════════════════');
    console.log('  PERFORMANCE BENCHMARK RESULTS');
    console.log('══════════════════════════════════════════════════\n');
    console.log('  Benchmark           │ Avg (ms) │ Target   │ Status');
    console.log('  ────────────────────┼──────────┼──────────┼───────');

    for (const { name, avgMs, target } of results) {
      const targetMs = parseFloat(target.replace(/[^0-9.]/g, ''));
      const status = avgMs < targetMs ? '✅ PASS' : '⚠️ SLOW';
      console.log(`  ${name.padEnd(20)} │ ${avgMs.toFixed(2).padStart(8)} │ ${target.padEnd(8)} │ ${status}`);
    }

    console.log('\n══════════════════════════════════════════════════\n');

    // All benchmarks should complete (no crashes/timeouts)
    expect(results.length).toBe(8);
    for (const { avgMs } of results) {
      expect(isFinite(avgMs)).toBe(true);
    }
  });
});
