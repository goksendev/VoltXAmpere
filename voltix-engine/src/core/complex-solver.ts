/**
 * Complex linear system solver — LU Decomposition with Partial Pivoting.
 *
 * Solves Az = b where A is a complex square matrix.
 * Used for AC frequency-domain analysis where all quantities are phasors.
 *
 * Pivoting uses complex magnitude for numerical stability.
 */

import { Complex } from '../utils/complex';

/**
 * Solve Az = b for complex matrices using Gaussian elimination
 * with partial pivoting (pivot by magnitude).
 *
 * @throws Error if matrix is singular
 */
export function solveComplexLU(A: Complex[][], b: Complex[]): Complex[] {
  const n = A.length;
  if (n === 0) return [];

  // Build augmented matrix [A|b] — deep copy
  const aug: Complex[][] = new Array(n);
  for (let i = 0; i < n; i++) {
    aug[i] = new Array(n + 1);
    for (let j = 0; j < n; j++) {
      aug[i]![j] = A[i]![j]!;
    }
    aug[i]![n] = b[i]!;
  }

  // Forward elimination with partial pivoting
  for (let col = 0; col < n; col++) {
    // Find pivot — row with largest magnitude in this column
    let maxMag = aug[col]![col]!.magnitude;
    let maxRow = col;

    for (let row = col + 1; row < n; row++) {
      const mag = aug[row]![col]!.magnitude;
      if (mag > maxMag) {
        maxMag = mag;
        maxRow = row;
      }
    }

    if (maxMag < 1e-18) {
      throw new Error(
        `Singular complex matrix at column ${col}. ` +
        `Check circuit connectivity for AC analysis.`
      );
    }

    // Swap rows
    if (maxRow !== col) {
      const temp = aug[col]!;
      aug[col] = aug[maxRow]!;
      aug[maxRow] = temp;
    }

    // Eliminate below pivot
    const pivot = aug[col]![col]!;
    for (let row = col + 1; row < n; row++) {
      const factor = aug[row]![col]!.div(pivot);
      if (factor.isZero()) continue;

      for (let j = col; j <= n; j++) {
        aug[row]![j] = aug[row]![j]!.sub(factor.mul(aug[col]![j]!));
      }
      aug[row]![col] = Complex.ZERO;
    }
  }

  // Back substitution
  const x: Complex[] = new Array(n);
  for (let i = n - 1; i >= 0; i--) {
    let sum = aug[i]![n]!;
    for (let j = i + 1; j < n; j++) {
      sum = sum.sub(aug[i]![j]!.mul(x[j]!));
    }
    x[i] = sum.div(aug[i]![i]!);
  }

  return x;
}
