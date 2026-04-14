// ══════════════════════════════════════════════════════════════
// VXA.PoleZero — Sprint 21: Pole-Zero Analysis Engine
// ══════════════════════════════════════════════════════════════
VXA.PoleZero = (function() {
  'use strict';

  // ── Quadratic Solver ──
  function solveQuadratic(c) {
    var a = c[2], b = c[1], c0 = c[0];
    var disc = b * b - 4 * a * c0;
    if (disc >= 0) {
      var sq = Math.sqrt(disc);
      return [{ re: (-b + sq) / (2 * a), im: 0 }, { re: (-b - sq) / (2 * a), im: 0 }];
    }
    var sq = Math.sqrt(-disc);
    return [{ re: -b / (2 * a), im: sq / (2 * a) }, { re: -b / (2 * a), im: -sq / (2 * a) }];
  }

  // ── Polynomial Root Finding (Companion Matrix + QR) ──
  function findRoots(coefficients) {
    if (!coefficients || coefficients.length <= 1) return [];
    // Remove trailing zeros
    while (coefficients.length > 1 && Math.abs(coefficients[coefficients.length - 1]) < 1e-30) coefficients.pop();
    var n = coefficients.length - 1;
    if (n <= 0) return [];
    if (n === 1) return [{ re: -coefficients[0] / coefficients[1], im: 0 }];
    if (n === 2) return solveQuadratic(coefficients);

    // Build companion matrix
    var an = coefficients[n];
    // C is n×n
    var C = [];
    for (var i = 0; i < n; i++) {
      C[i] = new Float64Array(n);
      if (i < n - 1) C[i][i + 1] = 1;
    }
    // Last row: -c_i / a_n
    for (var i = 0; i < n; i++) {
      C[n - 1][i] = -coefficients[i] / an;
    }

    // QR iteration (Francis double-shift simplified)
    var maxIter = 100 * n;
    var sz = n;

    // Hessenberg reduction (companion matrix is already upper Hessenberg)
    // QR iterations with Wilkinson shift
    for (var iter = 0; iter < maxIter && sz > 2; iter++) {
      // Wilkinson shift from bottom 2x2 block
      var a11 = C[sz - 2][sz - 2], a12 = C[sz - 2][sz - 1];
      var a21 = C[sz - 1][sz - 2], a22 = C[sz - 1][sz - 1];
      var tr = a11 + a22, det = a11 * a22 - a12 * a21;
      var disc2 = tr * tr - 4 * det;

      var shift;
      if (disc2 >= 0) {
        var sq2 = Math.sqrt(disc2);
        var e1 = (tr + sq2) / 2, e2 = (tr - sq2) / 2;
        shift = Math.abs(e1 - a22) < Math.abs(e2 - a22) ? e1 : e2;
      } else {
        shift = a22; // Use a22 as shift for complex eigenvalues
      }

      // Apply shift
      for (var i = 0; i < sz; i++) C[i][i] -= shift;

      // QR step via Givens rotations
      for (var i = 0; i < sz - 1; i++) {
        var x = C[i][i], y = C[i + 1][i];
        var r = Math.sqrt(x * x + y * y);
        if (r < 1e-30) continue;
        var cs = x / r, sn = y / r;
        // Apply rotation to rows i and i+1
        for (var j = 0; j < sz; j++) {
          var t1 = C[i][j], t2 = C[i + 1][j];
          C[i][j] = cs * t1 + sn * t2;
          C[i + 1][j] = -sn * t1 + cs * t2;
        }
        // Apply rotation to columns i and i+1 (R*Q)
        for (var j = 0; j < sz; j++) {
          var t1 = C[j][i], t2 = C[j][i + 1];
          C[j][i] = cs * t1 + sn * t2;
          C[j][i + 1] = -sn * t1 + cs * t2;
        }
      }

      // Remove shift
      for (var i = 0; i < sz; i++) C[i][i] += shift;

      // Check for deflation (subdiagonal near zero)
      if (Math.abs(C[sz - 1][sz - 2]) < 1e-12 * (Math.abs(C[sz - 1][sz - 1]) + Math.abs(C[sz - 2][sz - 2]) + 1e-30)) {
        sz--;
      }
    }

    // Extract eigenvalues
    var roots = [];
    var i = 0;
    while (i < n) {
      if (i === n - 1 || Math.abs(C[i + 1][i]) < 1e-12 * (Math.abs(C[i][i]) + (i + 1 < n ? Math.abs(C[i + 1][i + 1]) : 0) + 1e-30)) {
        // Real eigenvalue
        roots.push({ re: C[i][i], im: 0 });
        i++;
      } else {
        // Complex conjugate pair from 2x2 block
        var aa = C[i][i], ab = C[i][i + 1], ba = C[i + 1][i], bb = C[i + 1][i + 1];
        var tr2 = aa + bb, det2 = aa * bb - ab * ba;
        var disc3 = tr2 * tr2 - 4 * det2;
        if (disc3 < 0) {
          var realPart = tr2 / 2;
          var imagPart = Math.sqrt(-disc3) / 2;
          roots.push({ re: realPart, im: imagPart });
          roots.push({ re: realPart, im: -imagPart });
        } else {
          var sq3 = Math.sqrt(disc3);
          roots.push({ re: (tr2 + sq3) / 2, im: 0 });
          roots.push({ re: (tr2 - sq3) / 2, im: 0 });
        }
        i += 2;
      }
    }
    return roots;
  }

  // ── Levy Method (Rational Function Fitting) ──
  function levyFit(frequencies, H_complex, numerOrder, denomOrder) {
    var K = frequencies.length;
    var numP = numerOrder + 1; // b_0 ... b_m
    var denP = denomOrder;     // a_1 ... a_n (a_0=1 normalized)
    var totalParams = numP + denP;

    // Build normal equations: A^T A x = A^T b
    var ATA = [];
    var ATb = [];
    for (var i = 0; i < totalParams; i++) {
      ATA[i] = new Float64Array(totalParams);
      ATb[i] = 0;
    }

    for (var k = 0; k < K; k++) {
      var w = frequencies[k];
      var Hr = H_complex[k].re, Hi = H_complex[k].im;

      // Powers of jw: (jw)^p has re = w^p * cos(p*pi/2), im = w^p * sin(p*pi/2)
      var jwPow = []; // [{re, im}] for p = 0, 1, 2, ...
      var maxP = Math.max(numerOrder, denomOrder) + 1;
      for (var p = 0; p <= maxP; p++) {
        var wp = Math.pow(w, p);
        var angle = p * Math.PI / 2;
        jwPow.push({ re: wp * Math.cos(angle), im: wp * Math.sin(angle) });
      }

      // Row contributions: H(jw)*D(jw) = N(jw)
      // Real equation: sum_p b_p * Re{(jw)^p} - sum_q a_q * (Hr*Re{(jw)^q} - Hi*Im{(jw)^q}) = Hr
      // Imag equation: sum_p b_p * Im{(jw)^p} - sum_q a_q * (Hr*Im{(jw)^q} + Hi*Re{(jw)^q}) = Hi

      var rowR = new Float64Array(totalParams);
      var rowI = new Float64Array(totalParams);
      // Numerator columns (b_0 ... b_m)
      for (var p = 0; p <= numerOrder; p++) {
        rowR[p] = jwPow[p].re;
        rowI[p] = jwPow[p].im;
      }
      // Denominator columns (a_1 ... a_n): multiply by -H
      for (var q = 1; q <= denomOrder; q++) {
        var colIdx = numP + q - 1;
        rowR[colIdx] = -(Hr * jwPow[q].re - Hi * jwPow[q].im);
        rowI[colIdx] = -(Hr * jwPow[q].im + Hi * jwPow[q].re);
      }

      // Accumulate A^T A and A^T b
      for (var i = 0; i < totalParams; i++) {
        for (var j = 0; j < totalParams; j++) {
          ATA[i][j] += rowR[i] * rowR[j] + rowI[i] * rowI[j];
        }
        ATb[i] += rowR[i] * Hr + rowI[i] * Hi;
      }
    }

    // Solve ATA * x = ATb via Gaussian elimination
    var x = solveLinearSystem(ATA, ATb, totalParams);

    var numerCoeffs = [];
    for (var i = 0; i <= numerOrder; i++) numerCoeffs.push(x[i]);
    var denomCoeffs = [1]; // a_0 = 1
    for (var i = 0; i < denomOrder; i++) denomCoeffs.push(x[numP + i]);

    return { numerCoeffs: numerCoeffs, denomCoeffs: denomCoeffs };
  }

  function solveLinearSystem(A, b, n) {
    // Gaussian elimination with partial pivoting
    var Ab = [];
    for (var i = 0; i < n; i++) {
      Ab[i] = new Float64Array(n + 1);
      for (var j = 0; j < n; j++) Ab[i][j] = A[i][j];
      Ab[i][n] = b[i];
    }
    for (var k = 0; k < n; k++) {
      var maxVal = Math.abs(Ab[k][k]), maxRow = k;
      for (var i = k + 1; i < n; i++) {
        if (Math.abs(Ab[i][k]) > maxVal) { maxVal = Math.abs(Ab[i][k]); maxRow = i; }
      }
      if (maxRow !== k) { var tmp = Ab[k]; Ab[k] = Ab[maxRow]; Ab[maxRow] = tmp; }
      if (Math.abs(Ab[k][k]) < 1e-30) continue;
      for (var i = k + 1; i < n; i++) {
        var f = Ab[i][k] / Ab[k][k];
        for (var j = k + 1; j <= n; j++) Ab[i][j] -= f * Ab[k][j];
        Ab[i][k] = 0;
      }
    }
    var x = new Float64Array(n);
    for (var i = n - 1; i >= 0; i--) {
      var s = Ab[i][n];
      for (var j = i + 1; j < n; j++) s -= Ab[i][j] * x[j];
      x[i] = Math.abs(Ab[i][i]) > 1e-30 ? s / Ab[i][i] : 0;
    }
    return x;
  }

  // ── Order Estimation ──
  function estimateOrder(frequencies, H_complex) {
    var last = frequencies.length - 1;
    var mid = Math.floor(last * 0.7);
    if (mid === last || mid < 1) return { numerOrder: 1, denomOrder: 2 };

    var magMid = Math.sqrt(H_complex[mid].re * H_complex[mid].re + H_complex[mid].im * H_complex[mid].im);
    var magLast = Math.sqrt(H_complex[last].re * H_complex[last].re + H_complex[last].im * H_complex[last].im);
    var gMid = 20 * Math.log10(Math.max(magMid, 1e-15));
    var gLast = 20 * Math.log10(Math.max(magLast, 1e-15));
    var fRatio = Math.log10(frequencies[last] / frequencies[mid]);
    if (fRatio < 0.1) return { numerOrder: 1, denomOrder: 2 };

    var slope = (gLast - gMid) / fRatio;
    var estDenom = Math.max(1, Math.min(6, Math.round(Math.abs(slope) / 20)));
    var estNumer = Math.max(0, estDenom - 1);
    return { numerOrder: estNumer, denomOrder: estDenom };
  }

  // ── Fitting Error ──
  function calcFittingError(frequencies, H_meas, numC, denC) {
    var sumSqErr = 0, count = 0;
    for (var k = 0; k < frequencies.length; k++) {
      var w = frequencies[k];
      // Evaluate N(jw) and D(jw)
      var Nr = 0, Ni = 0, Dr = 0, Di = 0;
      for (var p = 0; p < numC.length; p++) {
        var wp = Math.pow(w, p);
        var a = p * Math.PI / 2;
        Nr += numC[p] * wp * Math.cos(a);
        Ni += numC[p] * wp * Math.sin(a);
      }
      for (var p = 0; p < denC.length; p++) {
        var wp = Math.pow(w, p);
        var a = p * Math.PI / 2;
        Dr += denC[p] * wp * Math.cos(a);
        Di += denC[p] * wp * Math.sin(a);
      }
      var dMag2 = Dr * Dr + Di * Di;
      if (dMag2 < 1e-30) continue;
      // H_fitted = N/D
      var fittedR = (Nr * Dr + Ni * Di) / dMag2;
      var fittedI = (Ni * Dr - Nr * Di) / dMag2;
      var fittedMag = Math.sqrt(fittedR * fittedR + fittedI * fittedI);
      var measMag = Math.sqrt(H_meas[k].re * H_meas[k].re + H_meas[k].im * H_meas[k].im);

      var fDB = 20 * Math.log10(Math.max(fittedMag, 1e-15));
      var mDB = 20 * Math.log10(Math.max(measMag, 1e-15));
      sumSqErr += (fDB - mDB) * (fDB - mDB);
      count++;
    }
    return count > 0 ? Math.sqrt(sumSqErr / count) : 999;
  }

  // ── Main Analysis ──
  function analyze(inputNode, outputNode) {
    var acResult = VXA.ACAnalysis ? VXA.ACAnalysis.run(10, 1e6, 20, outputNode || 2) : null;
    if (!acResult || acResult.length < 10) {
      return { error: 'AC analysis returned insufficient data (need >= 10 points).' };
    }

    var frequencies = acResult.map(function(r) { return r.freq * 2 * Math.PI; }); // Hz→rad/s
    var H_complex = acResult.map(function(r) {
      var magNorm = r.magnitude;
      var phRad = r.phase * Math.PI / 180;
      return { re: magNorm * Math.cos(phRad), im: magNorm * Math.sin(phRad) };
    });

    var order = estimateOrder(frequencies, H_complex);
    var fit = levyFit(frequencies, H_complex, order.numerOrder, order.denomOrder);
    var zeros = findRoots(fit.numerCoeffs.slice());
    var poles = findRoots(fit.denomCoeffs.slice());
    var isStable = poles.every(function(p) { return p.re < 0; });
    var dcGain = fit.denomCoeffs[0] !== 0 ? fit.numerCoeffs[0] / fit.denomCoeffs[0] : Infinity;

    var resonances = [];
    for (var i = 0; i < poles.length; i++) {
      if (poles[i].im > 0.01) {
        var wn = Math.sqrt(poles[i].re * poles[i].re + poles[i].im * poles[i].im);
        var zeta = -poles[i].re / wn;
        resonances.push({ frequency: wn / (2 * Math.PI), damping: zeta, quality: zeta > 0 ? 1 / (2 * zeta) : Infinity });
      }
    }

    var fittingError = calcFittingError(frequencies, H_complex, fit.numerCoeffs, fit.denomCoeffs);

    return {
      poles: poles, zeros: zeros,
      numerCoeffs: fit.numerCoeffs, denomCoeffs: fit.denomCoeffs,
      numerOrder: order.numerOrder, denomOrder: order.denomOrder,
      isStable: isStable, dcGain: dcGain,
      dcGainDB: 20 * Math.log10(Math.max(Math.abs(dcGain), 1e-15)),
      resonances: resonances, fittingError: fittingError,
      acData: acResult // Keep raw AC data for overlay
    };
  }

  return {
    analyze: analyze,
    findRoots: findRoots,
    levyFit: levyFit,
    estimateOrder: estimateOrder
  };
})();
