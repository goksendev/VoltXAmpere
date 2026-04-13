// ──────── THERMAL ENGINE (v6 Sprint 2) ────────
VXA.Thermal = (function() {
  // Default thermal params per component type
  var THERMAL_DEFAULTS = {
    resistor:    { Rth: 200, Cth: 0.05, Tmax: 155, Pmax: 0.25, source: 'Typical 1/4W carbon film, axial lead' },
    capacitor:   { Rth: 100, Cth: 0.5,  Tmax: 85,  Pmax: 1.0, source: 'Electrolytic, radial lead, 25V' },
    inductor:    { Rth: 100, Cth: 0.3,  Tmax: 130, Pmax: 1.0, source: 'Axial RF choke, typical' },
    diode:       { Rth: 150, Cth: 0.05, Tmax: 150, Pmax: 0.5, source: 'DO-41 package (1N4007 class)' },
    led:         { Rth: 200, Cth: 0.02, Tmax: 120, Pmax: 0.1, source: 'Standard 5mm T-1¾ through-hole' },
    zener:       { Rth: 120, Cth: 0.05, Tmax: 150, Pmax: 0.5, source: 'DO-41 package, 1W rated' },
    npn:         { Rth: 200, Cth: 0.05, Tmax: 150, Pmax: 0.5, source: 'TO-92 package, RθJA=200°C/W' },
    pnp:         { Rth: 200, Cth: 0.05, Tmax: 150, Pmax: 0.5, source: 'TO-92 package, RθJA=200°C/W' },
    nmos:        { Rth: 62.5,Cth: 0.5,  Tmax: 175, Pmax: 2.0, source: 'TO-220 package, RθJA=62.5°C/W' },
    pmos:        { Rth: 62.5,Cth: 0.5,  Tmax: 175, Pmax: 2.0, source: 'TO-220 package, RθJA=62.5°C/W' },
    opamp:       { Rth: 100, Cth: 0.1,  Tmax: 125, Pmax: 0.5, source: 'DIP-8 package, LM741 class' },
    fuse:        { Rth: 50,  Cth: 0.02, Tmax: 300, Pmax: 5.0, source: 'Glass tube, 5x20mm' },
    vreg:        { Rth: 62.5,Cth: 0.3,  Tmax: 150, Pmax: 2.0, source: 'TO-220 package (7805 class)' },
    jfet_n:      { Rth: 150, Cth: 0.05, Tmax: 150, Pmax: 0.5, source: 'TO-92 package' },
    jfet_p:      { Rth: 150, Cth: 0.05, Tmax: 150, Pmax: 0.5, source: 'TO-92 package' }
  };

  function ensureThermal(part) {
    if (!part._thermal) {
      var def = THERMAL_DEFAULTS[part.type] || { Rth: 200, Cth: 0.1, Tmax: 150, Pmax: 1.0 };
      part._thermal = {
        T: S.ambientTemp,
        P: 0,
        Rth: def.Rth,
        Cth: def.Cth,
        Tmax: def.Tmax,
        Pmax: def.Pmax,
        status: 'normal'
      };
    }
    return part._thermal;
  }

  function update(dt) {
    var Tamb = S.ambientTemp;
    for (var i = 0; i < S.parts.length; i++) {
      var part = S.parts[i];
      if (part.damaged) continue;
      var th = ensureThermal(part);
      th.P = part._p || 0;
      // Thermal differential equation: C_th * dT/dt = P - (T - T_amb) / R_th
      // Forward Euler: T_new = T + dt * (P - (T - Tamb)/Rth) / Cth
      var dT = (th.P - (th.T - Tamb) / th.Rth) / th.Cth;
      th.T += dT * dt;
      // Clamp to ambient minimum
      if (th.T < Tamb) th.T = Tamb;

      // Update status
      if (th.T < 40)                     th.status = 'normal';
      else if (th.T < 70)                th.status = 'warm';
      else if (th.T < th.Tmax * 0.8)     th.status = 'hot';
      else if (th.T < th.Tmax)           th.status = 'critical';
      else                                th.status = 'damaged';
    }
  }

  function getStatus(part) {
    var th = ensureThermal(part);
    return th.status;
  }

  function getTemperature(part) {
    var th = ensureThermal(part);
    return th.T;
  }

  function reset() {
    for (var i = 0; i < S.parts.length; i++) {
      if (S.parts[i]._thermal) {
        S.parts[i]._thermal.T = S.ambientTemp;
        S.parts[i]._thermal.P = 0;
        S.parts[i]._thermal.status = 'normal';
      }
    }
  }

  return { update: update, getStatus: getStatus, getTemperature: getTemperature, reset: reset, ensureThermal: ensureThermal, THERMAL_DEFAULTS: THERMAL_DEFAULTS };
})();