VXA.VoltageLimit = (function() {
  function junction(Vnew, Vold, Vt, Vcrit) {
    if (Vnew > Vcrit) {
      if (Vold > 0) {
        var arg = 1 + (Vnew - Vold) / Vt;
        if (arg > 0) {
          Vnew = Vold + Vt * Math.log(arg);
        } else {
          Vnew = Vcrit;
        }
      } else {
        Vnew = Vcrit;
      }
    } else if (Vnew < -5 * Vt) {
      if (Vold >= 0) {
        Vnew = -Vt * (1 + Math.log(Math.abs(Vnew / Vt)));
      } else {
        var arg = 1 - (Vnew - Vold) / Vt;
        if (arg > 0) {
          Vnew = Vold - Vt * Math.log(arg);
        } else {
          Vnew = -5 * Vt;
        }
      }
    }
    return Vnew;
  }
  function mos(Vnew, Vold, maxStep) {
    var diff = Vnew - Vold;
    if (Math.abs(diff) > maxStep) return Vold + (diff > 0 ? maxStep : -maxStep);
    return Vnew;
  }
  function computeVcrit(Is, Vt) {
    return Vt * Math.log(Vt / (Math.SQRT2 * Math.max(Is, 1e-30)));
  }
  return { junction: junction, mos: mos, computeVcrit: computeVcrit };
})();