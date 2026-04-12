/**
 * Web Worker entry point for simulation.
 *
 * Receives commands via postMessage, runs simulations off the main thread,
 * and sends results back. Supports progress reporting and abort.
 *
 * This file is loaded as a Worker:
 *   new Worker(new URL('./sim-worker.ts', import.meta.url), { type: 'module' })
 */

import type { WorkerCommand, WorkerResponse } from './protocol';
import { serializeTransientResult, serializeACResult } from './protocol';
import { engineRunDC, engineRunTransient, engineRunAC, AbortFlag } from './sim-engine';

const abortFlag = new AbortFlag();

self.onmessage = (event: MessageEvent<WorkerCommand>) => {
  const msg = event.data;

  if (msg.type === 'ABORT') {
    abortFlag.abort();
    return;
  }

  // Reset abort flag for new simulation
  abortFlag.reset();

  try {
    switch (msg.type) {
      case 'RUN_DC': {
        const result = engineRunDC(msg.payload.circuit);
        post({ type: 'DC_RESULT', payload: result });
        break;
      }

      case 'RUN_TRANSIENT': {
        const result = engineRunTransient(
          msg.payload.circuit,
          msg.payload.options,
          (pct) => post({ type: 'PROGRESS', payload: pct }),
          abortFlag,
        );
        post({ type: 'TRANSIENT_RESULT', payload: serializeTransientResult(result) });
        break;
      }

      case 'RUN_AC': {
        const result = engineRunAC(
          msg.payload.circuit,
          msg.payload.acSource,
          msg.payload.options,
        );
        post({ type: 'AC_RESULT', payload: serializeACResult(result) });
        break;
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    post({ type: 'ERROR', payload: message });
  }
};

function post(msg: WorkerResponse): void {
  self.postMessage(msg);
}
