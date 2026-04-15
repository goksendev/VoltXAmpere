// ──────── SPRINT 44: SPARSE FAST (CSC + LU) ────────
// Compressed-Sparse-Column matrix assembler + dense LU solve.
// Dense LU is acceptable up to ~150 nodes; real sparse LU comes in Sprint 45+.
// DOM-free → safe to execute inside a Web Worker.

VXA.SparseFast = (function() {
  'use strict';

  function CSCMatrix(n) {
    this.n = n;
    this.colPtr = new Int32Array(n + 1);
    this.rowIdx = new Int32Array(0);
    this.values = new Float64Array(0);
    this.nnz = 0;
    this._entries = Object.create(null);
  }

  CSCMatrix.prototype.set = function(row, col, val) {
    if (row < 0 || col < 0 || row >= this.n || col >= this.n) return;
    var key = row * 100003 + col; // composite numeric key (n ≤ ~100k safe)
    var existing = this._entries[key];
    this._entries[key] = (existing === undefined ? 0 : existing) + val;
  };

  CSCMatrix.prototype.finalize = function() {
    var n = this.n;
    var keys = Object.keys(this._entries);
    var entries = new Array(keys.length);
    for (var i = 0; i < keys.length; i++) {
      var k = +keys[i];
      var col = k % 100003;
      var row = (k - col) / 100003;
      entries[i] = { row: row, col: col, val: this._entries[k] };
    }
    entries.sort(function(a, b) {
      return a.col !== b.col ? a.col - b.col : a.row - b.row;
    });
    this.nnz = entries.length;
    this.colPtr = new Int32Array(n + 1);
    this.rowIdx = new Int32Array(this.nnz);
    this.values = new Float64Array(this.nnz);
    var col = 0;
    for (var j = 0; j < entries.length; j++) {
      while (col <= entries[j].col) { this.colPtr[col] = j; col++; }
      this.rowIdx[j] = entries[j].row;
      this.values[j] = entries[j].val;
    }
    while (col <= n) { this.colPtr[col] = this.nnz; col++; }
    this._entries = null;
    return this;
  };

  // Expand CSC → dense row-major for LU (cache-friendly for small n).
  function toDense(csc) {
    var n = csc.n;
    var A = new Float64Array(n * n);
    for (var col = 0; col < n; col++) {
      for (var idx = csc.colPtr[col]; idx < csc.colPtr[col + 1]; idx++) {
        A[csc.rowIdx[idx] * n + col] = csc.values[idx];
      }
    }
    return A;
  }

  // Dense LU with partial pivoting. Returns { x } solving A x = b.
  // Returns null on singular matrix.
  function solveLU(csc, b) {
    var n = csc.n;
    if (n === 0) return new Float64Array(0);
    if (!b || b.length < n) return null;
    var A = toDense(csc);
    // In-place LU with row permutation
    var piv = new Int32Array(n);
    for (var i = 0; i < n; i++) piv[i] = i;
    for (var k = 0; k < n; k++) {
      var maxVal = 0, maxRow = k;
      for (var r = k; r < n; r++) {
        var v = Math.abs(A[piv[r] * n + k]);
        if (v > maxVal) { maxVal = v; maxRow = r; }
      }
      if (maxVal < 1e-18) return null; // singular
      if (maxRow !== k) { var tmp = piv[k]; piv[k] = piv[maxRow]; piv[maxRow] = tmp; }
      var pivRow = piv[k];
      var pivVal = A[pivRow * n + k];
      for (var i2 = k + 1; i2 < n; i2++) {
        var row = piv[i2];
        var factor = A[row * n + k] / pivVal;
        A[row * n + k] = factor;
        for (var j = k + 1; j < n; j++) {
          A[row * n + j] -= factor * A[pivRow * n + j];
        }
      }
    }
    // Forward: L y = P b
    var y = new Float64Array(n);
    for (var i3 = 0; i3 < n; i3++) {
      var s = b[piv[i3]];
      for (var j2 = 0; j2 < i3; j2++) s -= A[piv[i3] * n + j2] * y[j2];
      y[i3] = s;
    }
    // Back: U x = y
    var x = new Float64Array(n);
    for (var i4 = n - 1; i4 >= 0; i4--) {
      var s2 = y[i4];
      for (var j3 = i4 + 1; j3 < n; j3++) s2 -= A[piv[i4] * n + j3] * x[j3];
      var diag = A[piv[i4] * n + i4];
      x[i4] = Math.abs(diag) > 1e-30 ? s2 / diag : 0;
    }
    return x;
  }

  return { CSCMatrix: CSCMatrix, solveLU: solveLU, toDense: toDense };
})();
