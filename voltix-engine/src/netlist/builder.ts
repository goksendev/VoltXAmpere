/**
 * Circuit definition — serializable format for passing circuits
 * between main thread and Web Worker.
 *
 * Components are described as plain objects, then hydrated into
 * class instances by the worker before simulation.
 */

import type { Component } from '../components/component';
import { Resistor } from '../components/resistor';
import { VoltageSource } from '../components/vsource';
import { CurrentSource } from '../components/isource';
import { Capacitor } from '../components/capacitor';
import { Inductor } from '../components/inductor';
import { Diode } from '../components/diode';
import { ACVoltageSource } from '../components/acsource';
import type { SourceFunction } from '../components/acsource';
import type { DiodeModelParams } from '../components/diode';

// ── Serializable component descriptors ──

export type ComponentDescriptor =
  | { type: 'resistor'; name: string; nodes: [string, string]; resistance: number }
  | { type: 'vsource'; name: string; nodes: [string, string]; voltage: number }
  | { type: 'isource'; name: string; nodes: [string, string]; current: number }
  | { type: 'capacitor'; name: string; nodes: [string, string]; capacitance: number; ic?: number }
  | { type: 'inductor'; name: string; nodes: [string, string]; inductance: number; ic?: number }
  | { type: 'diode'; name: string; nodes: [string, string]; model?: Partial<DiodeModelParams> }
  | { type: 'acsource'; name: string; nodes: [string, string]; func: SourceFunction };

export interface CircuitDefinition {
  components: ComponentDescriptor[];
}

/**
 * Convert component instances to serializable descriptors.
 */
export function serializeCircuit(components: readonly Component[]): CircuitDefinition {
  const descriptors: ComponentDescriptor[] = [];

  for (const comp of components) {
    if (comp instanceof ACVoltageSource) {
      descriptors.push({
        type: 'acsource',
        name: comp.name,
        nodes: [comp.pins[0]!.node, comp.pins[1]!.node],
        func: comp.func,
      });
    } else if (comp instanceof VoltageSource) {
      descriptors.push({
        type: 'vsource',
        name: comp.name,
        nodes: [comp.pins[0]!.node, comp.pins[1]!.node],
        voltage: comp.voltage,
      });
    } else if (comp instanceof CurrentSource) {
      descriptors.push({
        type: 'isource',
        name: comp.name,
        nodes: [comp.pins[0]!.node, comp.pins[1]!.node],
        current: comp.current,
      });
    } else if (comp instanceof Resistor) {
      descriptors.push({
        type: 'resistor',
        name: comp.name,
        nodes: [comp.pins[0]!.node, comp.pins[1]!.node],
        resistance: comp.resistance,
      });
    } else if (comp instanceof Capacitor) {
      descriptors.push({
        type: 'capacitor',
        name: comp.name,
        nodes: [comp.pins[0]!.node, comp.pins[1]!.node],
        capacitance: comp.capacitance,
        ic: comp.hasUserIC ? comp.prevVoltage : undefined,
      });
    } else if (comp instanceof Inductor) {
      descriptors.push({
        type: 'inductor',
        name: comp.name,
        nodes: [comp.pins[0]!.node, comp.pins[1]!.node],
        inductance: comp.inductance,
        ic: comp.hasUserIC ? comp.prevCurrent : undefined,
      });
    } else if (comp instanceof Diode) {
      descriptors.push({
        type: 'diode',
        name: comp.name,
        nodes: [comp.pins[0]!.node, comp.pins[1]!.node],
        model: comp.model,
      });
    }
  }

  return { components: descriptors };
}

/**
 * Hydrate serializable descriptors back into component instances.
 */
export function deserializeCircuit(def: CircuitDefinition): Component[] {
  return def.components.map((desc): Component => {
    switch (desc.type) {
      case 'resistor':
        return new Resistor(desc.name, desc.nodes[0], desc.nodes[1], desc.resistance);
      case 'vsource':
        return new VoltageSource(desc.name, desc.nodes[0], desc.nodes[1], desc.voltage);
      case 'isource':
        return new CurrentSource(desc.name, desc.nodes[0], desc.nodes[1], desc.current);
      case 'capacitor': {
        const cap = new Capacitor(desc.name, desc.nodes[0], desc.nodes[1], desc.capacitance);
        if (desc.ic !== undefined) cap.setInitialVoltage(desc.ic);
        return cap;
      }
      case 'inductor': {
        const ind = new Inductor(desc.name, desc.nodes[0], desc.nodes[1], desc.inductance);
        if (desc.ic !== undefined) ind.setInitialCurrent(desc.ic);
        return ind;
      }
      case 'diode':
        return new Diode(desc.name, desc.nodes[0], desc.nodes[1], desc.model);
      case 'acsource':
        return new ACVoltageSource(desc.name, desc.nodes[0], desc.nodes[1], desc.func);
    }
  });
}
