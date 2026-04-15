// ──────── SPRINT 39: Commands Tab UI Handler ────────
// Parses .PARAM / .STEP / .MEAS lines from textarea and runs them.

(function() {
  function getNodeIndexByName(name) {
    // Match "out", "node3", or "1" — fall back to S._pinToNode lookup if available.
    if (!name) return null;
    var n = parseInt(name, 10);
    if (!isNaN(n)) return n;
    if (typeof S !== 'undefined' && S && S._netNameMap && S._netNameMap[name.toUpperCase()] != null) {
      return S._netNameMap[name.toUpperCase()];
    }
    return null;
  }

  function captureWaveform(nodeName) {
    // Return latest scope buffer for the chosen node, if SimV2 / scope captured anything.
    // Falls back to S._scopeHistory or similar arrays. Best-effort — produces { times, values }.
    var times = [], values = [];
    if (typeof S !== 'undefined' && S && Array.isArray(S._scopeBuf)) {
      for (var i = 0; i < S._scopeBuf.length; i++) {
        var p = S._scopeBuf[i];
        if (p && typeof p.t === 'number' && typeof p.v === 'number') {
          times.push(p.t); values.push(p.v);
        }
      }
    }
    return { times: times, values: values };
  }

  window.runCommands = function() {
    var ta = document.getElementById('cmd-input');
    var out = document.getElementById('cmd-output');
    var statusEl = document.getElementById('cmd-status');
    if (!ta || !out) return;
    var lines = ta.value.split('\n');
    var measLines = [];
    var stepConfig = null;
    var paramsApplied = 0;
    var log = [];

    try { VXA.Params.clear(); } catch (e) {}

    lines.forEach(function(raw) {
      var line = raw.trim();
      if (!line || line.charAt(0) === '*' || line.charAt(0) === ';') return;
      var upper = line.toUpperCase();
      if (upper.indexOf('.PARAM') === 0) {
        var c = VXA.Params.parseParamLine(line);
        paramsApplied += c;
        log.push('PARAM (' + c + '): ' + line);
      } else if (upper.indexOf('.STEP') === 0) {
        stepConfig = VXA.StepAnalysis.parseStepLine(line);
        log.push('STEP ' + stepConfig.paramName + ' (' + stepConfig.values.length + ' pts)');
      } else if (upper.indexOf('.MEAS') === 0) {
        var m = VXA.Measure.parseMeasLine(line);
        measLines.push(m);
        log.push('MEAS ' + m.measName + ' = ' + m.measType + ' ' + m.expression);
      } else {
        log.push('SKIP: ' + line);
      }
    });

    // Apply parameters to circuit (no-op if no paramExpr present)
    try { VXA.StepAnalysis.applyParamsToCircuit(); } catch (e) {}

    // Execute STEP if present
    var stepResults = [];
    if (stepConfig && stepConfig.values.length > 0) {
      stepResults = VXA.StepAnalysis.runStep(stepConfig, function(val, idx) {
        // Best-effort: run one simulation step if available — UI runner left to operator otherwise
        if (typeof simulationStep === 'function') {
          try { simulationStep(); } catch (e) {}
        }
        return { val: val };
      });
      log.push('STEP ran ' + stepResults.length + ' iterations');
    }

    // Execute MEAS lines against the most recent scope buffer
    var measOutputs = [];
    if (measLines.length > 0) {
      var wf = captureWaveform();
      measLines.forEach(function(m) {
        var r = VXA.Measure.execute(m, wf);
        measOutputs.push(r);
      });
    }

    // Render output
    var text = '── PARAM ──\n' + Object.keys(VXA.Params.getAll()).map(function(k) {
      var v = VXA.Params.get(k);
      return '  ' + k + ' = ' + (typeof v === 'number' ? v.toPrecision(4) : v);
    }).join('\n');

    if (stepConfig) {
      text += '\n\n── STEP ──\n  ' + stepConfig.paramName + ' (' + stepConfig.type +
              ', ' + stepConfig.values.length + ' pts' +
              (stepConfig.truncated ? ' — truncated' : '') + ')\n';
      if (stepConfig.values.length > 0) {
        var prev = stepConfig.values.slice(0, 5).map(function(v) { return v.toPrecision(3); }).join(', ');
        text += '  first: [' + prev + (stepConfig.values.length > 5 ? ', …' : '') + ']';
      }
    }

    if (measOutputs.length > 0) {
      text += '\n\n── MEAS ──\n';
      measOutputs.forEach(function(r) {
        text += '  ' + r.name + ' = ' +
                (isNaN(r.value) ? '(' + (r.error || 'no data') + ')' :
                  (typeof r.value === 'number' ? r.value.toPrecision(5) : r.value)) + '\n';
      });
    }

    text += '\n\n── LOG ──\n  ' + log.join('\n  ');
    out.textContent = text;
    if (statusEl) {
      statusEl.textContent = paramsApplied + ' param · ' +
        (stepConfig ? stepConfig.values.length + ' step · ' : '') +
        measLines.length + ' meas';
    }
  };
})();
