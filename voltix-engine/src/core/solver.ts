/**
 * Linear system solver — LU Decomposition with Partial Pivoting.
 *
 * Solves Ax = b where A is a dense square matrix.
 * Phase 1: dense LU is sufficient for circuits up to ~100 nodes (<1ms).
 * Phase 8+: migrate to KLU sparse solver for 1000+ node circuits.
 */

export interface SolverResult {
  x: Float64Array;
  singularColumn: number | null;
}

/**
 * Solve Ax = b using Gaussian elimination with partial pivoting.
 * Returns solution vector x.
 *
 * @throws Error if matrix is singular (floating node, missing ground, etc.)
 */
export function solveLU(A: Float64Array[], b: Float64Array): Float64Array {
  const n = A.length;
  if (n === 0) return new Float64Array(0);

  // Build augmented matrix [A|b] — work on copies to avoid mutation
  const aug: Float64Array[] = new Array(n);
  for (let i = 0; i < n; i++) {
    aug[i] = new Float64Array(n + 1);
    aug[i]!.set(A[i]!);
    aug[i]![n] = b[i]!;
  }

  // Forward elimination with partial pivoting
  for (let col = 0; col < n; col++) {
    // Find pivot — row with largest absolute value in this column
    let maxVal = Math.abs(aug[col]![col]!);
    let maxRow = col;

    for (let row = col + 1; row < n; row++) {
      const absVal = Math.abs(aug[row]![col]!);
      if (absVal > maxVal) {
        maxVal = absVal;
        maxRow = row;
      }
    }

    // Singular matrix check
    if (maxVal < 1e-18) {
      throw new SingularMatrixError(col);
    }

    // Swap rows if needed
    if (maxRow !== col) {
      const temp = aug[col]!;
      aug[col] = aug[maxRow]!;
      aug[maxRow] = temp;
    }

    // Eliminate below pivot
    const pivotVal = aug[col]![col]!;
    for (let row = col + 1; row < n; row++) {
      const factor = aug[row]![col]! / pivotVal;
      if (factor === 0) continue;

      for (let j = col; j <= n; j++) {
        aug[row]![j]! -= factor * aug[col]![j]!;
      }
      // Explicitly zero out to prevent floating point drift
      aug[row]![col] = 0;
    }
  }

  // Back substitution
  const x = new Float64Array(n);
  for (let i = n - 1; i >= 0; i--) {
    let sum = aug[i]![n]!;
    for (let j = i + 1; j < n; j++) {
      sum -= aug[i]![j]! * x[j]!;
    }
    x[i] = sum / aug[i]![i]!;
  }

  return x;
}

/**
 * Error thrown when the MNA matrix is singular.
 * Common causes: floating node, missing ground, voltage source loop.
 */
export class SingularMatrixError extends Error {
  constructor(public readonly column: number) {
    super(
      `Singular matrix at column ${column}. ` +
      `Check for: floating nodes, missing ground connection, or voltage source loops.`
    );
    this.name = 'SingularMatrixError';
  }
}
