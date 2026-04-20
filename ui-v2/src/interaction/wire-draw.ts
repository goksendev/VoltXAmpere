// VoltXAmpere v2 — tel çekme state machine (Sprint 1.4).
//
// İki durumlu FSM — idle / started.
//   idle:    tel modu kapalı, normal etkileşim (hover/drag/seçim/yerleştir).
//   started: birinci terminal tıklandı; fare gezerken preview tel çizilir;
//            ikinci terminal tıklaması tel'i kurar ya da aynı terminal iptal.

import type {
  Point,
  TerminalRef,
} from './component-terminals.ts';
import { TERMINAL_ORDER } from './component-terminals.ts';

export type WireDrawState =
  | { phase: 'idle' }
  | {
      phase: 'started';
      from: TerminalRef;
      /** Birinci terminal'in canvas koordinatı (layout-relative). Preview
       * tel başlangıç noktası — fare gezerken sabit. */
      fromPoint: Point;
      /** Fare anlık canvas koordinatı (layout-relative). Preview tel bitişi. */
      previewTo: Point;
    };

export const INITIAL_WIRE_DRAW: WireDrawState = { phase: 'idle' };

/** TerminalRef → circuit.components[i].nodes[j] string adı.
 * Sprint 1.4'te tel kurulunca iki node'un merge'ü için gerekli. */
export function terminalToNodeName(
  term: TerminalRef,
  circuit: { components: ReadonlyArray<{ id: string; type: string; nodes: readonly string[] }> },
): string | null {
  const comp = circuit.components.find((c) => c.id === term.componentId);
  if (!comp) return null;
  const order = TERMINAL_ORDER[comp.type];
  if (!order) return null;
  const idx = order.indexOf(term.terminal);
  if (idx < 0) return null;
  return comp.nodes[idx] ?? null;
}
