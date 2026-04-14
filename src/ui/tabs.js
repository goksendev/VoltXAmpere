// ──────── TAB SWITCHING ────────
function switchTab(name) {
  document.querySelectorAll('.btab').forEach(function(b){ b.classList.toggle('active', b.dataset.tab === name); });
  document.querySelectorAll('.tab-panel').forEach(function(p){ p.classList.toggle('active', p.id === 'tab-'+name); });
  if (name === 'bode') drawBode();
  if (name === 'dcsweep') drawDCSweep();
  if (name === 'paramsweep') drawParamSweep();
  if (name === 'fft') drawFFT();
  if (name === 'montecarlo') drawMonteCarlo();
  if (name === 'tempsweep') drawTempSweep();
  if (name === 'noise') drawNoise();
  if (name === 'sensitivity') drawSensitivity();
  if (name === 'worstcase') drawWorstCase();
  if (name === 'polezero') drawPoleZero();
  if (name === 'contour2d') drawContour2D();
  if (name === 'transferfunc') drawTransferFunc();
  needsRender = true;
}
