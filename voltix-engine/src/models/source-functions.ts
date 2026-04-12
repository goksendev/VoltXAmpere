/**
 * Time-dependent source functions for transient analysis.
 * These match SPICE source function definitions.
 */

// ────────────────────────────────────────
// SIN source: V = VO + VA × e^(-θt) × sin(2πf(t-td) + φ)
// ────────────────────────────────────────

export interface SineParams {
  /** DC offset (V) */
  vo: number;
  /** Amplitude (V) */
  va: number;
  /** Frequency (Hz) */
  freq: number;
  /** Delay before oscillation starts (s). Default: 0 */
  td?: number;
  /** Damping factor (1/s). Default: 0 (no damping) */
  theta?: number;
  /** Phase offset (degrees). Default: 0 */
  phase?: number;
}

export function sineValue(params: SineParams, t: number): number {
  const { vo, va, freq, td = 0, theta = 0, phase = 0 } = params;
  if (t < td) return vo;
  const tp = t - td;
  const phaseRad = (phase * Math.PI) / 180;
  return vo + va * Math.exp(-theta * tp) * Math.sin(2 * Math.PI * freq * tp + phaseRad);
}

// ────────────────────────────────────────
// PULSE source: trapezoid waveform
// ────────────────────────────────────────

export interface PulseParams {
  /** Initial value (V) */
  v1: number;
  /** Pulsed value (V) */
  v2: number;
  /** Delay time (s) */
  td: number;
  /** Rise time (s) */
  tr: number;
  /** Fall time (s) */
  tf: number;
  /** Pulse width (s) */
  pw: number;
  /** Period (s) */
  per: number;
}

export function pulseValue(params: PulseParams, t: number): number {
  const { v1, v2, td, tr, tf, pw, per } = params;
  if (t < td) return v1;

  // Position within current period
  const tp = (t - td) % per;

  if (tp < tr) {
    // Rising edge — linear ramp from v1 to v2
    return v1 + (v2 - v1) * (tp / tr);
  }
  if (tp < tr + pw) {
    // Pulse high
    return v2;
  }
  if (tp < tr + pw + tf) {
    // Falling edge — linear ramp from v2 to v1
    return v2 + (v1 - v2) * ((tp - tr - pw) / tf);
  }
  // Low for remainder of period
  return v1;
}

// ────────────────────────────────────────
// PWL source: piecewise linear
// ────────────────────────────────────────

export interface PWLParams {
  /** Array of [time, value] pairs, sorted by time ascending. */
  points: [number, number][];
}

export function pwlValue(params: PWLParams, t: number): number {
  const { points } = params;
  if (points.length === 0) return 0;
  if (t <= points[0]![0]) return points[0]![1];
  if (t >= points[points.length - 1]![0]) return points[points.length - 1]![1];

  // Binary search for the interval containing t
  let lo = 0;
  let hi = points.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (points[mid]![0] <= t) lo = mid;
    else hi = mid;
  }

  // Linear interpolation between points[lo] and points[hi]
  const [t0, v0] = points[lo]!;
  const [t1, v1] = points[hi]!;
  if (t1 === t0) return v0;
  return v0 + (v1 - v0) * ((t - t0) / (t1 - t0));
}
