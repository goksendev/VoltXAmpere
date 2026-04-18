// ──────── SPRINT 6: DEEP ENGINE UPGRADE ────────

// 6.1: SPARSE MATRIX INFRASTRUCTURE (CSC FORMAT)
VXA.Sparse = (function() {
  function create(size) {
    return { n: size, triplets: [], colPtr: null, rowIdx: null, values: null, compiled: false };
  }
  function stamp(matrix, row, col, value) {
    if (row < 0 || col < 0 || row >= matrix.n || col >= matrix.n) return;
    if (value === 0 || !isFinite(value)) return;
    matrix.triplets.push({ row: row, col: col, value: value });
  }
  function compile(matrix) {
    var n = matrix.n, trips = matrix.triplets;
    var map = new Map();
    for (var ti = 0; ti < trips.length; ti++) {
      var t = trips[ti], key = t.row * n + t.col;
      map.set(key, (map.get(key) || 0) + t.value);
    }
    var entries = [];
    map.forEach(function(val, key) {
      if (Math.abs(val) < 1e-25) return;
      entries.push({ row: Math.floor(key / n), col: key % n, val: val });
    });
    entries.sort(function(a, b) { return a.col - b.col || a.row - b.row; });
    var nnz = entries.length;
    matrix.colPtr = new Int32Array(n + 1);
    matrix.rowIdx = new Int32Array(nnz);
    matrix.values = new Float64Array(nnz);
    var idx = 0;
    for (var c = 0; c < n; c++) {
      matrix.colPtr[c] = idx;
      while (idx < nnz && entries[idx].col === c) {
        matrix.rowIdx[idx] = entries[idx].row;
        matrix.values[idx] = entries[idx].val;
        idx++;
      }
    }
    matrix.colPtr[n] = nnz;
    matrix.compiled = true;
    return matrix;
  }
  function solveLU(matrix, rhs) {
    var n = matrix.n;
    if (n <= 30) return solveLU_dense(matrix, rhs);
    return solveLU_banded(matrix, rhs);
  }
  function solveLU_dense(matrix, rhs) {
    var n = matrix.n;
    var A = [];
    for (var i = 0; i < n; i++) A[i] = new Float64Array(n);
    for (var c = 0; c < n; c++) {
      for (var k = matrix.colPtr[c]; k < matrix.colPtr[c + 1]; k++) {
        A[matrix.rowIdx[k]][c] = matrix.values[k];
      }
    }
    var b = Float64Array.from(rhs);
    for (var col = 0; col < n; col++) {
      var maxVal = Math.abs(A[col][col]), maxRow = col;
      for (var r = col + 1; r < n; r++) {
        var av = Math.abs(A[r][col]);
        if (av > maxVal) { maxVal = av; maxRow = r; }
      }
      if (maxVal < 1e-20) { A[col][col] = 1e-20; continue; }
      if (maxRow !== col) {
        var tmpA = A[col]; A[col] = A[maxRow]; A[maxRow] = tmpA;
        var tmpB = b[col]; b[col] = b[maxRow]; b[maxRow] = tmpB;
      }
      for (var r = col + 1; r < n; r++) {
        var factor = A[r][col] / A[col][col];
        if (factor === 0) continue;
        for (var j = col + 1; j < n; j++) A[r][j] -= factor * A[col][j];
        b[r] -= factor * b[col];
        A[r][col] = 0;
      }
    }
    var x = new Float64Array(n);
    for (var i = n - 1; i >= 0; i--) {
      var sum = b[i];
      for (var j = i + 1; j < n; j++) sum -= A[i][j] * x[j];
      x[i] = Math.abs(A[i][i]) > 1e-20 ? sum / A[i][i] : 0;
    }
    return x;
  }
  function solveLU_banded(matrix, rhs) {
    var n = matrix.n;
    // Cuthill-McKee reordering
    var adj = [];
    for (var i = 0; i < n; i++) adj[i] = [];
    for (var c = 0; c < n; c++) {
      for (var k = matrix.colPtr[c]; k < matrix.colPtr[c+1]; k++) {
        var r = matrix.rowIdx[k];
        if (r !== c) { adj[c].push(r); adj[r].push(c); }
      }
    }
    // Deduplicate adjacency lists
    for (var i = 0; i < n; i++) {
      var seen = {};
      adj[i] = adj[i].filter(function(v) { if (seen[v]) return false; seen[v] = 1; return true; });
    }
    // BFS from min-degree node
    var visited = new Uint8Array(n);
    var order = [];
    var startNode = 0, minDeg = adj[0].length;
    for (var i = 1; i < n; i++) { if (adj[i].length < minDeg) { minDeg = adj[i].length; startNode = i; } }
    var queue = [startNode];
    visited[startNode] = 1;
    while (queue.length > 0) {
      var node = queue.shift();
      order.push(node);
      var neighbors = [];
      for (var ni = 0; ni < adj[node].length; ni++) {
        if (!visited[adj[node][ni]]) neighbors.push(adj[node][ni]);
      }
      neighbors.sort(function(a,b) { return adj[a].length - adj[b].length; });
      for (var ni = 0; ni < neighbors.length; ni++) {
        if (!visited[neighbors[ni]]) { visited[neighbors[ni]] = 1; queue.push(neighbors[ni]); }
      }
    }
    for (var i = 0; i < n; i++) { if (!visited[i]) order.push(i); }
    // Reverse Cuthill-McKee
    order.reverse();
    var invOrder = new Int32Array(n);
    for (var i = 0; i < n; i++) invOrder[order[i]] = i;
    // Build reordered dense matrix
    var A = [];
    for (var i = 0; i < n; i++) A[i] = new Float64Array(n);
    for (var c = 0; c < n; c++) {
      for (var k = matrix.colPtr[c]; k < matrix.colPtr[c+1]; k++) {
        A[invOrder[matrix.rowIdx[k]]][invOrder[c]] = matrix.values[k];
      }
    }
    var b = new Float64Array(n);
    for (var i = 0; i < n; i++) b[invOrder[i]] = rhs[i];
    // Compute bandwidth of the reordered (but not yet factorised) matrix.
    var bw = 0;
    for (var i = 0; i < n; i++) {
      for (var j = 0; j < n; j++) {
        if (A[i][j] !== 0 && Math.abs(i-j) > bw) bw = Math.abs(i-j);
      }
    }
    matrix._bandwidth = bw;

    // Sprint 96 fix: partial pivoting inside a banded LU can push a
    // pivot row's non-zeros into columns outside the original band.
    // LAPACK GBTRF proves the resulting U factor has upper bandwidth
    // kl + ku = 2·bw for a matrix whose input bandwidth is bw. If
    // elimination and back-substitution only look within `bw`, those
    // post-pivot entries are silently ignored — which is exactly the
    // bug the Sprint 95 forced-banded probe flagged for circuits with
    // branch-variable stamps (CCVS, Gummel-Poon q1/qb rows). Use an
    // effective upper bandwidth of 2·bw so the fill from pivoting is
    // accounted for without collapsing to a full O(n²) dense solve.
    var bwEff = Math.min(2 * bw, n - 1);

    // Banded Gaussian elimination
    for (var col = 0; col < n; col++) {
      // Partial pivoting only searches within the original lower band
      // (a row below col+bw still has a zero in column col pre-pivot),
      // so pEnd stays at col+bw+1 regardless of bwEff.
      var pEnd = Math.min(col + bw + 1, n);
      var maxVal = Math.abs(A[col][col]), maxRow = col;
      for (var r = col+1; r < pEnd; r++) {
        if (Math.abs(A[r][col]) > maxVal) { maxVal = Math.abs(A[r][col]); maxRow = r; }
      }
      if (maxVal < 1e-18) continue;
      if (maxRow !== col) {
        var tmp = A[col]; A[col] = A[maxRow]; A[maxRow] = tmp;
        var tb = b[col]; b[col] = b[maxRow]; b[maxRow] = tb;
      }
      for (var r = col+1; r < pEnd; r++) {
        var f = A[r][col] / A[col][col];
        if (f === 0) continue;
        // Inner j loop uses bwEff: the pivot row may now carry entries
        // as far right as col + 2·bw, and fill propagates into the row
        // being eliminated.
        var jEnd = Math.min(col + bwEff + 1, n);
        for (var j = col+1; j < jEnd; j++) A[r][j] -= f * A[col][j];
        b[r] -= f * b[col];
        A[r][col] = 0;
      }
    }
    // Back substitution (banded, widened to bwEff)
    var xr = new Float64Array(n);
    for (var i = n-1; i >= 0; i--) {
      var sum = b[i];
      var jEnd = Math.min(i + bwEff + 1, n);
      for (var j = i+1; j < jEnd; j++) sum -= A[i][j] * xr[j];
      xr[i] = Math.abs(A[i][i]) > 1e-18 ? sum / A[i][i] : 0;
    }
    // Reverse permutation
    var x = new Float64Array(n);
    for (var i = 0; i < n; i++) x[order[i]] = xr[i];
    return x;
  }
  function reset(matrix) { matrix.triplets = []; matrix.compiled = false; }
  return { create: create, stamp: stamp, compile: compile, solveLU: solveLU, solveLU_dense: solveLU_dense, solveLU_banded: solveLU_banded, reset: reset };
})();