// ──────── CHAOS MONKEY (v8.0 Sprint 13) ────────
VXA.ChaosMonkey = (function() {
  'use strict';

  // ===== SCENARIO DEFINITIONS =====
  var SCENARIOS = {
    voltageSurge: {
      id: 'voltageSurge',
      name: { tr: 'Voltaj Dalgalanması', en: 'Voltage Surge' },
      desc: { tr: 'DC kaynaklara rastgele spike enjekte eder', en: 'Injects random spikes into DC sources' },
      icon: '⚡'
    },
    gaussianNoise: {
      id: 'gaussianNoise',
      name: { tr: 'Gaussian Gürültü', en: 'Gaussian Noise' },
      desc: { tr: 'Bileşen değerlerine rastgele sapma ekler', en: 'Adds random deviation to component values' },
      icon: '📊'
    },
    harmonicDistortion: {
      id: 'harmonicDistortion',
      name: { tr: 'Harmonik Bozulma', en: 'Harmonic Distortion' },
      desc: { tr: 'AC kaynaklara harmonikler ekler', en: 'Adds harmonics to AC sources' },
      icon: '〰️'
    },
    temperatureRamp: {
      id: 'temperatureRamp',
      name: { tr: 'Sıcaklık Değişimi', en: 'Temperature Ramp' },
      desc: { tr: 'Ortam sıcaklığını kademeli artırır', en: 'Gradually increases ambient temperature' },
      icon: '🌡️'
    },
    componentAging: {
      id: 'componentAging',
      name: { tr: 'Bileşen Yaşlanma', en: 'Component Aging' },
      desc: { tr: 'Bileşenlerde yaşlanma etkisi simüle eder', en: 'Simulates aging effects on components' },
      icon: '⏳'
    }
  };

  // ===== STATE =====
  var _isRunning = false;
  var _testResults = null;
  var _originalValues = {};
  var _testConfig = null;
  var _testStartTime = 0;
  var _testLog = [];

  // ===== HELPERS =====

  // Box-Muller transform — Gaussian random
  function gaussianRandom(mean, stddev) {
    var u1 = Math.random();
    var u2 = Math.random();
    var z = Math.sqrt(-2 * Math.log(Math.max(1e-15, u1))) * Math.cos(2 * Math.PI * u2);
    return mean + z * stddev;
  }

  function saveOriginalValues(parts) {
    _originalValues = {};
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      _originalValues[p.id] = {
        value: p.value !== undefined ? p.value : p.val,
        val: p.val,
        voltage: p.voltage,
        frequency: p.frequency,
        amplitude: p.amplitude,
        offset: p.offset,
        damaged: p.damaged
      };
      if (p.acAmplitude !== undefined) _originalValues[p.id].acAmplitude = p.acAmplitude;
      if (p.acFrequency !== undefined) _originalValues[p.id].acFrequency = p.acFrequency;
    }
    // Save ambient temp
    _originalValues._ambientTemp = S.ambientTemp || 25;
  }

  function restoreOriginalValues(parts) {
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      var orig = _originalValues[p.id];
      if (!orig) continue;
      if (orig.val !== undefined) p.val = orig.val;
      if (orig.value !== undefined && p.value !== undefined) p.value = orig.value;
      if (orig.acAmplitude !== undefined) p.acAmplitude = orig.acAmplitude;
      if (orig.acFrequency !== undefined) p.acFrequency = orig.acFrequency;
    }
    // Restore ambient temp
    if (_originalValues._ambientTemp !== undefined) {
      S.ambientTemp = _originalValues._ambientTemp;
    }
  }

  // ===== SCENARIO FUNCTIONS =====

  function applyVoltageSurge(parts, severity) {
    var spikePercent = severity * 5 / 100;
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      if (p.type === 'dcSource' || p.type === 'vdc' || p.type === 'battery') {
        var orig = _originalValues[p.id];
        if (!orig) continue;
        var baseV = orig.val || orig.value || orig.voltage || 5;
        var spike = gaussianRandom(0, baseV * spikePercent);
        if (p.val !== undefined) p.val = baseV + spike;
        if (p.value !== undefined) p.value = baseV + spike;
      }
    }
  }

  function applyGaussianNoise(parts, severity) {
    var noisePercent = severity * 0.5 / 100;
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      var orig = _originalValues[p.id];
      if (!orig) continue;
      if (p.type === 'resistor' || p.type === 'capacitor' || p.type === 'inductor') {
        var baseVal = orig.val !== undefined ? orig.val : orig.value;
        if (baseVal === undefined || baseVal === 0) continue;
        var noise = gaussianRandom(0, Math.abs(baseVal) * noisePercent);
        var newVal = Math.max(1e-15, baseVal + noise);
        if (p.val !== undefined) p.val = newVal;
        if (p.value !== undefined) p.value = newVal;
      }
    }
  }

  function applyHarmonicDistortion(parts, severity) {
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      if (p.type === 'acSource' || p.type === 'vac') {
        p._chaosHarmonics = {
          thd: severity * 2,
          h3: severity / 10 * 0.15,
          h5: severity / 10 * 0.08,
          h7: severity / 10 * 0.04
        };
      }
    }
  }

  function applyTemperatureRamp(severity, testDuration) {
    var targetTemp = 25 + severity * 8;
    var rampDuration = testDuration * 0.8;
    var elapsed = (Date.now() - _testStartTime) / 1000;
    var rampProgress = Math.min(1, elapsed / Math.max(0.1, rampDuration));
    var currentTemp = 25 + (targetTemp - 25) * rampProgress;
    S.ambientTemp = currentTemp;
  }

  function applyComponentAging(parts, severity) {
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      var orig = _originalValues[p.id];
      if (!orig) continue;
      var baseVal = orig.val !== undefined ? orig.val : orig.value;
      if (baseVal === undefined) continue;

      if (p.type === 'resistor') {
        var newR = baseVal * (1 + severity * 0.005);
        if (p.val !== undefined) p.val = newR;
        if (p.value !== undefined) p.value = newR;
      } else if (p.type === 'capacitor') {
        var newC = baseVal * (1 - severity * 0.003);
        if (p.val !== undefined) p.val = Math.max(1e-15, newC);
        if (p.value !== undefined) p.value = Math.max(1e-15, newC);
      } else if (p.type === 'led' || p.type === 'diode') {
        p._chaosVfIncrease = severity * 0.002;
      } else if (p.type === 'npn' || p.type === 'pnp') {
        p._chaosHfeReduction = severity * 0.03;
      }
    }
  }

  // ===== MONITOR =====
  function monitorCircuit(parts, simTime) {
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];

      // Damage
      if (p.damaged && !p._chaosReported) {
        _testLog.push({
          time: simTime,
          type: 'damage',
          partId: p.id,
          partType: p.type
        });
        p._chaosReported = true;
      }

      // Thermal
      if (p._thermal) {
        if (p._thermal.status === 'critical' || p._thermal.status === 'damaged') {
          _testLog.push({
            time: simTime,
            type: 'thermal',
            partId: p.id,
            partType: p.type,
            temp: p._thermal.T,
            status: p._thermal.status
          });
        }
      }

      // Power overload
      var power = Math.abs((p._v || 0) * (p._i || 0));
      var pMax = (p._thermal && p._thermal.Pmax) ? p._thermal.Pmax : 0.25;
      if (power > pMax) {
        _testLog.push({
          time: simTime,
          type: 'power',
          partId: p.id,
          partType: p.type,
          power: power,
          maxPower: pMax,
          ratio: power / pMax
        });
      }
    }
  }

  // ===== SCORING =====
  function calculateScore() {
    if (!_testConfig || _testLog.length === 0) {
      return { score: 100, stars: 5, damageCount: 0, thermalViolations: 0, powerViolations: 0,
               firstDamageTime: null, worstPowerRatio: 0, weakPoints: [], totalEvents: 0,
               duration: (_testConfig ? _testConfig.durationMs / 1000 : 0),
               severity: (_testConfig ? _testConfig.severity : 5),
               scenarios: (_testConfig ? _testConfig.scenarios : []) };
    }

    var score = 100;
    var damageCount = 0;
    var thermalCount = 0;
    var powerViolations = 0;
    var firstDamageTime = Infinity;
    var worstPowerRatio = 0;
    var affectedParts = {};

    for (var i = 0; i < _testLog.length; i++) {
      var ev = _testLog[i];
      if (ev.type === 'damage') {
        damageCount++;
        score -= 15;
        if (ev.time < firstDamageTime) firstDamageTime = ev.time;
        affectedParts[ev.partId] = (affectedParts[ev.partId] || 0) + 10;
      }
      if (ev.type === 'thermal') {
        thermalCount++;
        score -= 3;
        affectedParts[ev.partId] = (affectedParts[ev.partId] || 0) + 3;
      }
      if (ev.type === 'power') {
        powerViolations++;
        score -= 2;
        if (ev.ratio > worstPowerRatio) worstPowerRatio = ev.ratio;
        affectedParts[ev.partId] = (affectedParts[ev.partId] || 0) + ev.ratio;
      }
    }

    var severity = _testConfig.severity || 5;
    score = Math.round(score * (1 + (severity - 5) * 0.05));
    score = Math.max(0, Math.min(100, score));
    var stars = score >= 90 ? 5 : score >= 70 ? 4 : score >= 50 ? 3 : score >= 30 ? 2 : 1;

    var weakPoints = Object.keys(affectedParts).map(function(pid) {
      return { partId: pid, severity: affectedParts[pid] };
    }).sort(function(a, b) { return b.severity - a.severity; });

    return {
      score: score,
      stars: stars,
      damageCount: damageCount,
      thermalViolations: thermalCount,
      powerViolations: powerViolations,
      firstDamageTime: firstDamageTime === Infinity ? null : firstDamageTime,
      worstPowerRatio: worstPowerRatio,
      weakPoints: weakPoints.slice(0, 5),
      totalEvents: _testLog.length,
      duration: _testConfig.durationMs / 1000,
      severity: severity,
      scenarios: _testConfig.scenarios
    };
  }

  function generateRecommendation(results, parts) {
    var recs = [];
    var lang = currentLang || 'en';
    for (var i = 0; i < Math.min(3, results.weakPoints.length); i++) {
      var wp = results.weakPoints[i];
      var part = null;
      for (var j = 0; j < parts.length; j++) {
        if (parts[j].id == wp.partId) { part = parts[j]; break; }
      }
      if (!part) continue;
      if (part.type === 'resistor') {
        recs.push(lang === 'tr' ?
          part.id + ': Güç kapasitesini artırın (1/2W veya 1W).' :
          part.id + ': Increase power rating (1/2W or 1W).');
      } else if (part.type === 'npn' || part.type === 'pnp' || part.type === 'nmos' || part.type === 'pmos') {
        recs.push(lang === 'tr' ?
          part.id + ': Heatsink ekleyin veya termal marjini artırın.' :
          part.id + ': Add heatsink or increase thermal margin.');
      } else if (part.type === 'led') {
        recs.push(lang === 'tr' ?
          part.id + ': Akım sınırlama direncini artırın.' :
          part.id + ': Increase current limiting resistor.');
      } else if (part.type === 'capacitor') {
        recs.push(lang === 'tr' ?
          part.id + ': Voltaj ratingi daha yüksek kapasitör kullanın.' :
          part.id + ': Use a capacitor with higher voltage rating.');
      } else {
        recs.push(lang === 'tr' ?
          part.id + ': Bu bileşen zayıf nokta, tasarımı gözden geçirin.' :
          part.id + ': This component is a weak point, review the design.');
      }
    }
    return recs.join('\n');
  }

  // ===== PUBLIC API =====
  return {
    getScenarios: function() { return SCENARIOS; },
    isRunning: function() { return _isRunning; },

    start: function(parts, options) {
      if (_isRunning) return;
      options = options || {};
      _testConfig = {
        scenarios: options.scenarios || ['voltageSurge', 'gaussianNoise'],
        severity: Math.max(1, Math.min(10, options.severity || 5)),
        durationMs: options.durationMs || 3000
      };
      _isRunning = true;
      _testLog = [];
      _testResults = null;
      _testStartTime = Date.now();

      saveOriginalValues(parts);

      // Aging applies once at start
      if (_testConfig.scenarios.indexOf('componentAging') >= 0) {
        applyComponentAging(parts, _testConfig.severity);
      }

      // Clear report flags
      for (var i = 0; i < parts.length; i++) {
        parts[i]._chaosReported = false;
      }
    },

    update: function(parts, simTime) {
      if (!_isRunning) return;
      var elapsed = Date.now() - _testStartTime;
      var severity = _testConfig.severity;
      var scenarios = _testConfig.scenarios;

      if (elapsed >= _testConfig.durationMs) {
        this.stop(parts);
        return;
      }

      if (scenarios.indexOf('voltageSurge') >= 0) {
        applyVoltageSurge(parts, severity);
      }
      if (scenarios.indexOf('gaussianNoise') >= 0) {
        applyGaussianNoise(parts, severity);
      }
      if (scenarios.indexOf('harmonicDistortion') >= 0) {
        applyHarmonicDistortion(parts, severity);
      }
      if (scenarios.indexOf('temperatureRamp') >= 0) {
        applyTemperatureRamp(severity, _testConfig.durationMs / 1000);
      }

      monitorCircuit(parts, simTime);
    },

    stop: function(parts) {
      if (!_isRunning) return;
      _isRunning = false;
      _testResults = calculateScore();
      _testResults.recommendation = generateRecommendation(_testResults, parts);

      restoreOriginalValues(parts);

      for (var i = 0; i < parts.length; i++) {
        delete parts[i]._chaosHarmonics;
        delete parts[i]._chaosVfIncrease;
        delete parts[i]._chaosHfeReduction;
        delete parts[i]._chaosReported;
      }

      if (VXA.Damage && VXA.Damage.repairAll) {
        VXA.Damage.repairAll();
      }

      VXA.EventBus.emit('chaos:complete', _testResults);
    },

    getResults: function() { return _testResults; },
    getLog: function() { return _testLog.slice(); },

    reset: function() {
      _isRunning = false;
      _testResults = null;
      _testLog = [];
      _testConfig = null;
      _originalValues = {};
    }
  };
})();

// ===== EXPLOSION INTENSITY SCALING =====
function calculateExplosionIntensity(actualPower, maxPower) {
  var overloadRatio = actualPower / Math.max(0.001, maxPower);
  return {
    particleCount: Math.round(15 * Math.pow(Math.max(1, overloadRatio), 1.5)),
    glowRadius: Math.round(8 * Math.pow(Math.max(1, overloadRatio), 1.2)),
    soundVolume: Math.min(1, 0.5 * Math.pow(Math.max(1, overloadRatio), 0.8)),
    screenShake: overloadRatio > 50
  };
}

// ===== SCREEN SHAKE EFFECT =====
function triggerScreenShake(durationMs, magnitudePx) {
  var canvas = typeof cvs !== 'undefined' ? cvs : document.getElementById('C');
  if (!canvas) return;
  var frames = Math.round((durationMs || 300) / 30);
  var mag = magnitudePx || 8;
  var count = 0;
  var shakeInterval = setInterval(function() {
    if (count >= frames) {
      clearInterval(shakeInterval);
      canvas.style.transform = '';
      return;
    }
    var dx = (Math.random() - 0.5) * mag;
    var dy = (Math.random() - 0.5) * mag;
    canvas.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
    count++;
  }, 30);
}

// ===== CHAOS PANEL UI =====
(function setupChaosPanel() {
  if (typeof document === 'undefined') return;

  function lang() { return (typeof currentLang !== 'undefined' ? currentLang : 'en'); }
  function tr(trStr, enStr) { return lang() === 'tr' ? trStr : enStr; }

  function createPanel() {
    // Backdrop
    var backdrop = document.createElement('div');
    backdrop.id = 'chaos-backdrop';
    backdrop.style.cssText = 'display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:9999';
    backdrop.onclick = function(e) { if (e.target === backdrop) closePanel(); };

    // Panel
    var panel = document.createElement('div');
    panel.id = 'chaos-panel';
    panel.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:10000;background:var(--bg,#1a1a2e);border:1px solid #444;border-radius:12px;padding:20px;min-width:340px;max-width:420px;color:#ddd;box-shadow:0 8px 32px rgba(0,0,0,0.5);font:13px var(--font-ui,sans-serif)';

    panel.innerHTML = '<h3 id="chaos-title" style="margin:0 0 12px;font-size:16px;color:#ff8800"></h3>'
      + '<div id="chaos-config">'
      + '  <div id="chaos-scenarios"></div>'
      + '  <div style="display:flex;align-items:center;gap:8px;margin:10px 0"><label id="chaos-severity-label" style="font-size:12px;color:#aaa;min-width:70px"></label><input type="range" id="chaos-severity" min="1" max="10" value="5" style="flex:1"><span id="chaos-severity-val" style="font-size:12px;font-weight:bold;min-width:30px;text-align:right">5</span></div>'
      + '  <div style="display:flex;align-items:center;gap:8px;margin:10px 0"><label id="chaos-duration-label" style="font-size:12px;color:#aaa;min-width:70px"></label><input type="range" id="chaos-duration" min="1" max="10" value="3" style="flex:1"><span id="chaos-duration-val" style="font-size:12px;font-weight:bold;min-width:30px;text-align:right">3s</span></div>'
      + '  <button id="chaos-start-btn" style="width:100%;padding:10px;margin-top:12px;background:#ff4400;color:white;border:none;border-radius:6px;font-size:14px;font-weight:bold;cursor:pointer"></button>'
      + '</div>'
      + '<div id="chaos-running" style="display:none">'
      + '  <div style="height:6px;background:#333;border-radius:3px;overflow:hidden;margin:8px 0"><div id="chaos-progress-fill" style="height:100%;background:#ff4400;width:0%;transition:width 0.3s"></div></div>'
      + '  <span id="chaos-running-text" style="font-size:12px;color:#aaa"></span>'
      + '  <button id="chaos-stop-btn" style="margin-top:8px;padding:6px 16px;background:none;border:1px solid #555;color:#ccc;border-radius:6px;cursor:pointer;font-size:12px"></button>'
      + '</div>'
      + '<div id="chaos-results" style="display:none">'
      + '  <div id="chaos-score-display" style="text-align:center;margin:12px 0"><span id="chaos-stars" style="font-size:24px"></span><span id="chaos-score-num" style="display:block;font-size:36px;font-weight:bold"></span></div>'
      + '  <div id="chaos-survival" style="font-size:12px;text-align:center;color:#aaa;margin:4px 0"></div>'
      + '  <div id="chaos-weak-points" style="margin:8px 0;font-size:12px;line-height:1.6"></div>'
      + '  <div id="chaos-recommendation" style="margin:8px 0;padding:8px;background:rgba(255,255,255,0.05);border-radius:6px;font-size:11px;line-height:1.5;color:#aaa;white-space:pre-line"></div>'
      + '  <div style="display:flex;gap:8px;margin-top:12px"><button id="chaos-download-btn" style="flex:1;padding:8px;border:1px solid #555;border-radius:6px;background:none;color:#ccc;cursor:pointer;font-size:12px"></button><button id="chaos-close-btn" style="flex:1;padding:8px;border:1px solid #555;border-radius:6px;background:none;color:#ccc;cursor:pointer;font-size:12px"></button></div>'
      + '</div>';

    backdrop.appendChild(panel);
    document.body.appendChild(backdrop);
    return backdrop;
  }

  var _backdrop = null;
  var _progressInterval = null;

  function getBackdrop() {
    if (!_backdrop) _backdrop = createPanel();
    return _backdrop;
  }

  function openPanel() {
    var bd = getBackdrop();
    bd.style.display = 'block';
    renderConfig();
  }

  function closePanel() {
    var bd = getBackdrop();
    bd.style.display = 'none';
    if (_progressInterval) { clearInterval(_progressInterval); _progressInterval = null; }
  }

  function renderConfig() {
    var l = lang();
    document.getElementById('chaos-title').textContent = l === 'tr' ? '⚡ Kaos Testi' : '⚡ Chaos Test';

    var scenDiv = document.getElementById('chaos-scenarios');
    var scenarios = VXA.ChaosMonkey.getScenarios();
    scenDiv.innerHTML = '';

    var keys = Object.keys(scenarios);
    for (var k = 0; k < keys.length; k++) {
      var key = keys[k];
      var s = scenarios[key];
      var label = document.createElement('label');
      label.style.cssText = 'display:flex;align-items:center;gap:6px;margin:4px 0;font-size:12px;cursor:pointer';
      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.value = key;
      cb.checked = (key === 'voltageSurge' || key === 'gaussianNoise');
      cb.style.cursor = 'pointer';
      label.appendChild(cb);
      label.appendChild(document.createTextNode(s.icon + ' ' + s.name[l]));
      scenDiv.appendChild(label);
    }

    document.getElementById('chaos-severity-label').textContent = l === 'tr' ? 'Şiddet:' : 'Severity:';
    document.getElementById('chaos-duration-label').textContent = l === 'tr' ? 'Süre:' : 'Duration:';
    document.getElementById('chaos-start-btn').textContent = l === 'tr' ? '⚡ TESTİ BAŞLAT' : '⚡ START TEST';
    document.getElementById('chaos-severity-val').textContent = document.getElementById('chaos-severity').value;
    document.getElementById('chaos-duration-val').textContent = document.getElementById('chaos-duration').value + 's';

    document.getElementById('chaos-config').style.display = 'block';
    document.getElementById('chaos-results').style.display = 'none';
    document.getElementById('chaos-running').style.display = 'none';
  }

  // Deferred event binding — wait for DOM
  function bindEvents() {
    var sevSlider = document.getElementById('chaos-severity');
    var durSlider = document.getElementById('chaos-duration');
    if (!sevSlider) return; // Panel not yet created

    sevSlider.addEventListener('input', function() {
      document.getElementById('chaos-severity-val').textContent = this.value;
    });
    durSlider.addEventListener('input', function() {
      document.getElementById('chaos-duration-val').textContent = this.value + 's';
    });

    document.getElementById('chaos-start-btn').addEventListener('click', function() {
      var checks = document.querySelectorAll('#chaos-scenarios input:checked');
      var scenarios = [];
      for (var c = 0; c < checks.length; c++) scenarios.push(checks[c].value);
      if (scenarios.length === 0) return;

      var severity = parseInt(document.getElementById('chaos-severity').value);
      var duration = parseInt(document.getElementById('chaos-duration').value) * 1000;

      // Start sim if not running
      if (!S.sim.running && typeof toggleSim === 'function') toggleSim();

      VXA.ChaosMonkey.start(S.parts, {
        scenarios: scenarios,
        severity: severity,
        durationMs: duration
      });

      document.getElementById('chaos-config').style.display = 'none';
      document.getElementById('chaos-running').style.display = 'block';
      var l = lang();
      document.getElementById('chaos-running-text').textContent = l === 'tr' ? 'Test çalışıyor...' : 'Test running...';
      document.getElementById('chaos-stop-btn').textContent = l === 'tr' ? 'Durdur' : 'Stop';

      var startMs = Date.now();
      _progressInterval = setInterval(function() {
        if (!VXA.ChaosMonkey.isRunning()) {
          clearInterval(_progressInterval);
          _progressInterval = null;
          showResults();
          return;
        }
        var pct = Math.min(100, (Date.now() - startMs) / duration * 100);
        document.getElementById('chaos-progress-fill').style.width = pct + '%';
      }, 100);
    });

    document.getElementById('chaos-stop-btn').addEventListener('click', function() {
      VXA.ChaosMonkey.stop(S.parts);
    });

    document.getElementById('chaos-download-btn').addEventListener('click', function() {
      var results = VXA.ChaosMonkey.getResults();
      if (!results) return;
      var text = '=== VoltXAmpere Chaos Test Report ===\n\n';
      text += 'Score: ' + results.score + '/100 (' + results.stars + '/5 stars)\n';
      text += 'Severity: ' + results.severity + '/10\n';
      text += 'Duration: ' + results.duration + 's\n';
      text += 'Scenarios: ' + results.scenarios.join(', ') + '\n';
      text += 'Damages: ' + results.damageCount + '\n';
      text += 'Thermal violations: ' + results.thermalViolations + '\n';
      text += 'Power violations: ' + results.powerViolations + '\n\n';
      text += 'Weak Points:\n';
      for (var w = 0; w < results.weakPoints.length; w++) {
        var wp = results.weakPoints[w];
        text += '  - ' + wp.partId + ' (severity: ' + wp.severity.toFixed(1) + ')\n';
      }
      text += '\nRecommendation:\n' + (results.recommendation || '') + '\n';
      var blob = new Blob([text], { type: 'text/plain' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = 'chaos_test_report.txt'; a.click();
      URL.revokeObjectURL(url);
    });

    document.getElementById('chaos-close-btn').addEventListener('click', function() {
      closePanel();
      renderConfig();
    });
  }

  function showResults() {
    var results = VXA.ChaosMonkey.getResults();
    if (!results) return;
    var l = lang();

    document.getElementById('chaos-running').style.display = 'none';
    document.getElementById('chaos-results').style.display = 'block';

    var starsStr = '';
    for (var i = 0; i < 5; i++) starsStr += i < results.stars ? '⭐' : '☆';
    document.getElementById('chaos-stars').textContent = starsStr;

    var scoreEl = document.getElementById('chaos-score-num');
    scoreEl.textContent = results.score + '/100';
    scoreEl.style.color = results.score >= 70 ? '#00ff41' : results.score >= 40 ? '#ffaa00' : '#ff4444';

    var survivalEl = document.getElementById('chaos-survival');
    if (results.firstDamageTime !== null) {
      survivalEl.textContent = (l === 'tr' ? 'İlk hasar: ' : 'First damage: ') +
        (results.firstDamageTime * 1000).toFixed(0) + 'ms';
    } else {
      survivalEl.textContent = l === 'tr' ? 'Hiçbir bileşen hasar görmedi!' : 'No components damaged!';
    }

    var wpEl = document.getElementById('chaos-weak-points');
    wpEl.innerHTML = '';
    if (results.weakPoints.length > 0) {
      var wpTitle = document.createElement('div');
      wpTitle.style.cssText = 'font-weight:bold;margin-bottom:4px';
      wpTitle.textContent = l === 'tr' ? 'Zayıf Noktalar:' : 'Weak Points:';
      wpEl.appendChild(wpTitle);
      for (var w = 0; w < results.weakPoints.length; w++) {
        var wp = results.weakPoints[w];
        var div = document.createElement('div');
        var icon = wp.severity > 5 ? '🔴' : wp.severity > 2 ? '🟡' : '🟢';
        div.textContent = icon + ' ' + wp.partId + ' (' + (l === 'tr' ? 'şiddet' : 'severity') + ': ' + wp.severity.toFixed(1) + ')';
        wpEl.appendChild(div);
      }
    }

    document.getElementById('chaos-recommendation').textContent = results.recommendation || '';
    document.getElementById('chaos-download-btn').textContent = l === 'tr' ? 'Raporu İndir' : 'Download Report';
    document.getElementById('chaos-close-btn').textContent = l === 'tr' ? 'Kapat' : 'Close';
  }

  // Global toggle function for toolbar button
  window.toggleChaosPanel = function() {
    var bd = getBackdrop();
    if (bd.style.display === 'none' || bd.style.display === '') {
      openPanel();
      bindEvents();
    } else {
      closePanel();
    }
  };
})();
