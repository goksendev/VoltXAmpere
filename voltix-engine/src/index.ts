// ── Public API ──

// High-level controller (preferred entry point)
export { SimulationController } from './worker/sim-controller';

// Circuit definition (serializable format for controller)
export { serializeCircuit, deserializeCircuit } from './netlist/builder';
export type { CircuitDefinition, ComponentDescriptor } from './netlist/builder';

// Core solvers (direct use, no worker)
export { MNASystem } from './core/mna';
export { solveLU, SingularMatrixError } from './core/solver';
export { solveComplexLU } from './core/complex-solver';
export { solveDCOperatingPoint } from './core/newton';
export type { NROptions, DCResult } from './core/newton';

// Analysis (direct use, no worker)
export { runTransient } from './analysis/transient';
export type { TransientOptions, TransientResult, IntegrationMethod, TransientCallbacks } from './analysis/transient';
export { runAC, generateFrequencyPoints } from './analysis/ac';
export type { ACOptions, ACResult, ACSource, SweepType } from './analysis/ac';

// Components
export type { Component, Pin, StampContext } from './components/component';
export { Resistor } from './components/resistor';
export { VoltageSource } from './components/vsource';
export { CurrentSource } from './components/isource';
export { Diode } from './components/diode';
export type { DiodeModelParams } from './components/diode';
export { Capacitor } from './components/capacitor';
export { Inductor } from './components/inductor';
export { ACVoltageSource } from './components/acsource';
export type { SourceFunction } from './components/acsource';

// Source functions
export { sineValue, pulseValue, pwlValue } from './models/source-functions';
export type { SineParams, PulseParams, PWLParams } from './models/source-functions';

// Utils
export { Complex } from './utils/complex';
export { parseValue, formatValue } from './utils/units';
export * as constants from './utils/constants';
