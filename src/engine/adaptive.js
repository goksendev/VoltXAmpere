VXA.AdaptiveStep = (function() {
  var DT_MIN = 1e-9, DT_MAX = 1e-4;
  var currentDt = 1e-5;
  function getDt() { return currentDt; }
  function setDt(dt) { currentDt = Math.max(DT_MIN, Math.min(DT_MAX, dt)); }
  function reset() { currentDt = 1e-5; }
  function adjust(converged, nrIter) {
    if (!converged) {
      currentDt = Math.max(DT_MIN, currentDt / 4);
    } else if (nrIter <= 3) {
      currentDt = Math.min(DT_MAX, currentDt * 1.5);
    } else if (nrIter > 10) {
      currentDt = Math.max(DT_MIN, currentDt * 0.7);
    }
    return currentDt;
  }
  return { getDt: getDt, setDt: setDt, reset: reset, adjust: adjust };
})();