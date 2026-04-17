// ──────── DAMAGE SYSTEM (v6 Sprint 2) ────────
VXA.Damage = (function() {
  var _smokeTimers = {}; // track smoke emission per part

  // Energy threshold for damage (Joules) — components absorb energy before failing
  function getDamageEnergyThreshold(type) {
    switch(type) {
      case 'led': return 0.05;       // small package, low threshold
      case 'resistor': return 0.5;   // depends on wattage
      case 'capacitor': return 0.3;
      case 'diode': case 'zener': return 0.2;
      case 'npn': case 'pnp': return 0.4;
      case 'nmos': case 'pmos': return 0.3;
      default: return 0.5;
    }
  }

  function check(part) {
    if (part.damaged) return;
    if (!S.realisticMode) return;
    var th = VXA.Thermal.ensureThermal(part);
    var type = part.type;

    // Temperature-based damage (all component types)
    if (th.T >= th.Tmax) {
      apply(part, 'overheat');
      return;
    }

    // Energy accumulation helper
    if (!part._damageEnergy) part._damageEnergy = 0;
    var dt = S._simDt || 1e-5;
    var energyThreshold = getDamageEnergyThreshold(type);

    // Component-specific electrical damage with energy accumulation
    if (type === 'led') {
      var Imax = 0.02; // 20mA standard
      var I = Math.abs(part._i || 0);
      if (I > Imax) {
        part._damageEnergy += (I - Imax) * (part._v || 0) * dt;
      } else {
        part._damageEnergy = Math.max(0, part._damageEnergy - 0.001 * dt);
      }
      if (I > Imax * 2 && part._damageEnergy > energyThreshold) { apply(part, 'overcurrent'); return; }
    }
    else if (type === 'resistor') {
      var P = Math.abs(part._p || 0);
      if (P > th.Pmax) {
        part._damageEnergy += (P - th.Pmax) * dt;
      } else {
        part._damageEnergy = Math.max(0, part._damageEnergy - 0.01 * dt);
      }
      if (P > th.Pmax * 2 && part._damageEnergy > energyThreshold) { apply(part, 'overpower'); return; }
    }
    else if (type === 'capacitor') {
      var Vmax = part.val > 1e-4 ? 25 : (part.val > 1e-6 ? 50 : 100); // rough V rating
      var V = Math.abs(part._v || 0);
      if (V > Vmax) {
        part._damageEnergy += (V - Vmax) * (part._i || 0) * dt;
      }
      if (V > Vmax && part._damageEnergy > energyThreshold) { apply(part, 'overvoltage'); return; }
    }
    else if (type === 'diode' || type === 'zener') {
      var P = Math.abs(part._p || 0);
      if (P > th.Pmax) {
        part._damageEnergy += (P - th.Pmax) * dt;
      } else {
        part._damageEnergy = Math.max(0, part._damageEnergy - 0.01 * dt);
      }
      if (P > th.Pmax * 2 && part._damageEnergy > energyThreshold) { apply(part, 'overpower'); return; }
    }
    else if (type === 'npn' || type === 'pnp') {
      if (th.T >= th.Tmax) { apply(part, 'thermal_runaway'); return; }
    }
    else if (type === 'nmos' || type === 'pmos') {
      // Sprint 70f: gate-oxide breakdown is polarity-symmetric — the
      // old `type.startsWith('n')` gate silently exempted every pmos.
      // Also accumulate energy before triggering so a single noisy
      // Vgs sample can't condemn the device on its own.
      var vgsAbs = Math.abs(part._vgs || part._v || 0);
      if (!part._damageEnergy) part._damageEnergy = 0;
      if (vgsAbs > 20) {
        var dtM = S._simDt || 1e-5;
        part._damageEnergy += (vgsAbs - 20) * Math.abs(part._i || 0) * dtM;
        if (part._damageEnergy > 0.1) { apply(part, 'gate_oxide'); return; }
      } else {
        part._damageEnergy = Math.max(0, (part._damageEnergy || 0) - 1e-4);
      }
    }
    else if (type === 'fuse') {
      var Imax = part.val || 1;
      if (!part._fuseEnergy) part._fuseEnergy = 0;
      var I = part._i || 0;
      if (I > Imax * 0.8) {
        part._fuseEnergy += I * I * 0.01; // approx dt
      } else {
        part._fuseEnergy = Math.max(0, part._fuseEnergy - 0.001);
      }
      var I2t_rated = Imax * Imax * 0.01;
      if (part._fuseEnergy > I2t_rated) { apply(part, 'overcurrent'); return; }
    }
  }

  function apply(part, cause) {
    if (part.damaged) return;
    part.damaged = true;
    part.damageCause = cause;

    // Determine damage result and explosion type
    var type = part.type;

    // Sprint 13: Calculate explosion intensity based on overload ratio
    var _actualP = Math.abs((part._v || 0) * (part._i || 0));
    var _maxP = (part._thermal && part._thermal.Pmax) ? part._thermal.Pmax : 0.25;
    var _intensity = (typeof calculateExplosionIntensity === 'function') ?
      calculateExplosionIntensity(_actualP, _maxP) : { particleCount: 15, glowRadius: 8, soundVolume: 0.5, screenShake: false };

    if (type === 'led') {
      part.damageResult = 'open';
      part.damageType = 'explode';
      part._explodeAnim = { active: true, startTime: performance.now(), phase: 0, duration: 500, particlesSpawned: false, intensity: _intensity };
    }
    else if (type === 'capacitor') {
      part.damageResult = Math.random() > 0.5 ? 'open' : 'short';
      part.damageType = 'explode';
      part._explodeAnim = { active: true, startTime: performance.now(), phase: 0, duration: 600, particlesSpawned: false, intensity: _intensity };
    }
    else if (type === 'resistor') {
      part.damageResult = 'open';
      part.damageType = 'burn';
      part._burnAnim = { active: true, startTime: performance.now(), duration: 1200, particlesSpawned: false, intensity: _intensity };
    }
    else if (type === 'fuse') {
      part.damageResult = 'open';
      part.damageType = 'blow';
      VXA.Particles.spawn(part.x, part.y, 'spark', '#ffcc00', _intensity.particleCount);
      VXA.Particles.spawn(part.x, part.y, 'flash', '#ffffcc', 1);
      VXA.Particles.spawn(part.x, part.y, 'smoke', 'rgba(70,70,70,0.3)', Math.round(_intensity.particleCount / 3));
    }
    else if (type === 'npn' || type === 'pnp') {
      part.damageResult = 'short';
      part.damageType = 'burn';
      VXA.Particles.spawn(part.x, part.y, 'smoke', 'rgba(60,60,60,0.5)', Math.round(_intensity.particleCount * 0.8));
      VXA.Particles.spawn(part.x, part.y, 'ember', '#ff4400', _intensity.particleCount);
      VXA.Particles.spawn(part.x, part.y, 'flash', '#ffeecc', 1);
    }
    else if (type === 'nmos' || type === 'pmos') {
      part.damageResult = 'short';
      part.damageType = 'burn';
      VXA.Particles.spawn(part.x, part.y, 'smoke', 'rgba(60,60,60,0.5)', Math.round(_intensity.particleCount * 0.8));
      VXA.Particles.spawn(part.x, part.y, 'ember', '#ff4400', _intensity.particleCount);
      VXA.Particles.spawn(part.x, part.y, 'flash', '#ffeecc', 1);
    }
    else if (type === 'diode' || type === 'zener') {
      part.damageResult = 'short';
      part.damageType = 'burn';
      VXA.Particles.spawn(part.x, part.y, 'smoke', 'rgba(60,60,60,0.5)', Math.round(_intensity.particleCount * 0.8));
      VXA.Particles.spawn(part.x, part.y, 'ember', '#ff2200', _intensity.particleCount);
      VXA.Particles.spawn(part.x, part.y, 'flash', '#ffeecc', 1);
    }
    else {
      part.damageResult = 'open';
      part.damageType = 'burn';
      VXA.Particles.spawn(part.x, part.y, 'ember', '#ff6600', _intensity.particleCount);
      VXA.Particles.spawn(part.x, part.y, 'smoke', 'rgba(60,60,60,0.4)', Math.round(_intensity.particleCount * 0.6));
    }

    // Sprint 13: Screen shake for extreme overloads
    if (_intensity.screenShake && typeof triggerScreenShake === 'function') {
      triggerScreenShake(300, 8);
    }

    // Log damage
    S.damageList.push({ id: part.id, name: part.name, type: part.type, cause: cause, result: part.damageResult, time: S.sim.t });

    // Emit event
    VXA.EventBus.emit('damage:occurred', { part: part, cause: cause });

    // Rebuild circuit to apply damage result
    if (S.sim.running) buildCircuitFromCanvas();

    needsRender = true;
    updateInspector();
  }

  function repair(part) {
    part.damaged = false;
    part.damageType = null;
    part.damageResult = null;
    part.damageCause = null;
    part._explodeAnim = null;
    part._burnAnim = null;
    part._fuseEnergy = 0;
    part._damageEnergy = 0;
    if (part._thermal) {
      part._thermal.T = S.ambientTemp;
      part._thermal.status = 'normal';
    }
    if (S.sim.running) buildCircuitFromCanvas();
    needsRender = true;
    updateInspector();
  }

  function repairAll() {
    S.parts.forEach(function(p) {
      if (p.damaged) repair(p);
    });
  }

  function getLog() { return S.damageList; }

  return { check: check, apply: apply, repair: repair, repairAll: repairAll, getLog: getLog, getDamageEnergyThreshold: getDamageEnergyThreshold };
})();