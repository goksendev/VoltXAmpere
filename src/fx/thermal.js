// ──────── THERMAL ENGINE (v6 Sprint 2) ────────
VXA.Thermal = (function() {
  // Default thermal params per component type. Sprint 70f: values
  // realigned to datasheet averages rather than round-number guesses.
  // Rth in °C/W (junction-to-ambient, no heatsink unless noted).
  var THERMAL_DEFAULTS = {
    resistor:    { Rth: 300, Cth: 0.05, Tmax: 155, Pmax: 0.25, source: '1/4W carbon film axial, RθJA≈300 typ' },
    capacitor:   { Rth: 80,  Cth: 0.5,  Tmax: 85,  Pmax: 0.3, source: '100µF 25V E-cap 10×13mm — ESR-limited dissipation' },
    inductor:    { Rth: 100, Cth: 0.3,  Tmax: 130, Pmax: 1.0, source: 'Axial RF choke, typical' },
    diode:       { Rth: 80,  Cth: 0.05, Tmax: 150, Pmax: 0.5, source: 'DO-41 (1N4007) PCB-mounted' },
    led:         { Rth: 400, Cth: 0.02, Tmax: 120, Pmax: 0.1, source: 'Standard 5mm T-1¾ through-hole, air' },
    zener:       { Rth: 120, Cth: 0.05, Tmax: 150, Pmax: 0.5, source: 'DO-41 package, 1W rated' },
    npn:         { Rth: 200, Cth: 0.05, Tmax: 150, Pmax: 0.5, source: 'TO-92 package, RθJA=200°C/W' },
    pnp:         { Rth: 200, Cth: 0.05, Tmax: 150, Pmax: 0.5, source: 'TO-92 package, RθJA=200°C/W' },
    nmos:        { Rth: 62.5,Cth: 0.5,  Tmax: 175, Pmax: 2.0, source: 'TO-220 package, RθJA=62.5°C/W' },
    pmos:        { Rth: 62.5,Cth: 0.5,  Tmax: 175, Pmax: 2.0, source: 'TO-220 package, RθJA=62.5°C/W' },
    opamp:       { Rth: 125, Cth: 0.1,  Tmax: 125, Pmax: 0.5, source: 'DIP-8 (LM741 class), no heatsink' },
    fuse:        { Rth: 50,  Cth: 0.02, Tmax: 300, Pmax: 5.0, source: 'Glass tube, 5x20mm' },
    vreg:        { Rth: 62.5,Cth: 0.3,  Tmax: 150, Pmax: 2.0, source: 'TO-220 package (7805 class)' },
    jfet_n:      { Rth: 150, Cth: 0.05, Tmax: 150, Pmax: 0.5, source: 'TO-92 package' },
    jfet_p:      { Rth: 150, Cth: 0.05, Tmax: 150, Pmax: 0.5, source: 'TO-92 package' }
  };
  // Sprint 70f: capacitor self-heating comes from I²·ESR (a real cap
  // isn't lossless under AC/ripple); V·I would be zero at DC and
  // misleading at AC. 0.3Ω is typical E-cap ESR at 100 Hz.
  var CAP_ESR = 0.3;

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
      // Sprint 70f: electrolytics dissipate via ESR (I²R), not V·I —
      // at DC the real cap passes zero current anyway, but any AC
      // ripple heats the can. Override P just for the thermal update;
      // part._p (used by Inspector) stays at the electrical solver's
      // V·I value to avoid confusing the user.
      if (part.type === 'capacitor') {
        var iC = Math.abs(part._i || 0);
        th.P = iC * iC * CAP_ESR;
      } else {
        th.P = part._p || 0;
      }
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