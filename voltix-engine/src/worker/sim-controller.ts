/**
 * SimulationController — main-thread API for running simulations.
 *
 * In a browser, this spawns a Web Worker for off-thread computation.
 * In Node.js / test environments, it falls back to direct (inline) execution.
 *
 * Usage:
 *   const sim = new SimulationController();
 *   const dc = await sim.runDC(circuit);
 *   const tran = await sim.runTransient(circuit, options, onProgress);
 *   sim.abort();  // cancel running simulation
 *   sim.terminate();  // dispose worker
 */

import type { CircuitDefinition } from '../netlist/builder';
import type { TransientOptions, TransientResult } from '../analysis/transient';
import type { ACOptions, ACResult, ACSource } from '../analysis/ac';
import type { DCResult } from '../core/newton';
import type { WorkerCommand, WorkerResponse } from './protocol';
import { deserializeTransientResult, deserializeACResult } from './protocol';
import { engineRunDC, engineRunTransient, engineRunAC, AbortFlag } from './sim-engine';

export class SimulationController {
  private worker: Worker | null = null;
  private abortFlag = new AbortFlag();
  private useWorker: boolean;

  /**
   * @param useWorker - If true, use a real Web Worker. If false (or in Node),
   *                    run simulations inline on the current thread.
   *                    Default: auto-detect (true if Worker is available).
   */
  constructor(useWorker?: boolean) {
    this.useWorker = useWorker ?? (typeof Worker !== 'undefined' && typeof window !== 'undefined');
  }

  /**
   * Run DC operating point analysis.
   */
  async runDC(circuit: CircuitDefinition): Promise<DCResult> {
    if (!this.useWorker) {
      return engineRunDC(circuit);
    }
    return this.sendCommand<DCResult>(
      { type: 'RUN_DC', payload: { circuit } },
      'DC_RESULT',
    );
  }

  /**
   * Run transient analysis with optional progress callback.
   */
  async runTransient(
    circuit: CircuitDefinition,
    options: TransientOptions,
    onProgress?: (percent: number) => void,
  ): Promise<TransientResult> {
    if (!this.useWorker) {
      this.abortFlag.reset();
      return engineRunTransient(circuit, options, onProgress, this.abortFlag);
    }
    return this.sendCommand<TransientResult>(
      { type: 'RUN_TRANSIENT', payload: { circuit, options } },
      'TRANSIENT_RESULT',
      onProgress,
      (data) => deserializeTransientResult(data),
    );
  }

  /**
   * Run AC frequency analysis.
   */
  async runAC(
    circuit: CircuitDefinition,
    acSource: ACSource,
    options: ACOptions,
  ): Promise<ACResult> {
    if (!this.useWorker) {
      return engineRunAC(circuit, acSource, options);
    }
    return this.sendCommand<ACResult>(
      { type: 'RUN_AC', payload: { circuit, acSource, options } },
      'AC_RESULT',
      undefined,
      (data) => deserializeACResult(data),
    );
  }

  /**
   * Abort the currently running simulation.
   */
  abort(): void {
    this.abortFlag.abort();
    if (this.worker) {
      this.worker.postMessage({ type: 'ABORT' } satisfies WorkerCommand);
    }
  }

  /**
   * Terminate the worker. After this, the controller cannot be reused.
   */
  terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }

  // ── Private ──

  private getWorker(): Worker {
    if (!this.worker) {
      this.worker = new Worker(
        new URL('./sim-worker.ts', import.meta.url),
        { type: 'module' },
      );
    }
    return this.worker;
  }

  private sendCommand<T>(
    command: WorkerCommand,
    resultType: string,
    onProgress?: (pct: number) => void,
    deserialize?: (data: any) => T,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const worker = this.getWorker();

      worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
        const msg = e.data;
        switch (msg.type) {
          case 'PROGRESS':
            onProgress?.(msg.payload);
            break;
          case 'ERROR':
            reject(new Error(msg.payload));
            break;
          default:
            if (msg.type === resultType) {
              const result = deserialize ? deserialize(msg.payload) : msg.payload as T;
              resolve(result);
            }
            break;
        }
      };

      worker.onerror = (e) => {
        reject(new Error(`Worker error: ${e.message}`));
      };

      worker.postMessage(command);
    });
  }
}
