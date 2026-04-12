# Voltix Engine

SPICE-class circuit simulation engine for the [VoltXAmpere](https://voltxampere.com) platform.

## What it does

Voltix Engine solves electronic circuits using Modified Nodal Analysis (MNA) with Newton-Raphson iteration for nonlinear elements. It supports three analysis types:

- **DC Operating Point** — steady-state node voltages and branch currents
- **Transient Analysis** — time-domain simulation with Backward Euler and Trapezoidal integration
- **AC Analysis** — frequency-domain sweep with complex phasor arithmetic

## Supported Components

| Component | Type | Parameters |
|-----------|------|------------|
| Resistor | Linear | resistance (Ohm) |
| Capacitor | Reactive | capacitance (F), initial voltage |
| Inductor | Reactive | inductance (H), initial current |
| Diode | Nonlinear | IS, N (Shockley model) |
| DC Voltage Source | Source | voltage (V) |
| DC Current Source | Source | current (A) |
| AC Voltage Source | Source | SIN, PULSE, PWL functions |

## Quick Start

```bash
npm install
npm test          # run all tests
npm run build     # compile TypeScript
```

## Usage

```typescript
import {
  SimulationController,
  serializeCircuit,
  Resistor,
  VoltageSource,
  Capacitor,
} from 'voltix-engine';

// Build a circuit
const cap = new Capacitor('C1', '2', '0', 1e-6);
cap.setInitialVoltage(0);

const components = [
  new VoltageSource('V1', '1', '0', 5),
  new Resistor('R1', '1', '2', 1000),
  cap,
];

const circuit = serializeCircuit(components);

// Create controller (uses Web Worker in browser, inline in Node)
const sim = new SimulationController();

// DC Operating Point
const dc = await sim.runDC(circuit);
console.log('V(2) =', dc.nodeVoltages.get('2'));

// Transient Analysis
const tran = await sim.runTransient(
  circuit,
  { tStep: 1e-5, tStop: 5e-3, method: 'BE' },
  (pct) => console.log(`Progress: ${pct}%`),
);
console.log('Steps:', tran.steps);

// AC Analysis
const ac = await sim.runAC(
  circuit,
  { name: 'V1' },
  { fStart: 10, fStop: 100000, pointsPerDecade: 20 },
);
console.log('Frequency points:', ac.numPoints);

// Abort a running simulation
sim.abort();

// Clean up
sim.terminate();
```

## Architecture

```
src/
├── core/           MNA builder, LU solver, Newton-Raphson, complex solver
├── analysis/       Transient (BE/TRAP), AC frequency sweep
├── components/     R, C, L, Diode, voltage/current sources
├── models/         SIN, PULSE, PWL source functions
├── netlist/        Circuit serialization (JSON-safe)
├── worker/         Web Worker integration, SimulationController
├── utils/          Complex arithmetic, unit parser, constants
└── index.ts        Public API
```

## Test Suite

```bash
npm test                    # 96+ unit tests
npx vitest run bench/       # 30 benchmark circuits + performance
```

## Accuracy

- DC: < 0.01% error vs analytic solutions
- Transient (TRAP): < 1% error for RC/RL/RLC circuits
- AC: < 0.1 dB magnitude error, < 1 degree phase error

## License

MIT
