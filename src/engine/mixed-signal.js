// ──────── SPRINT 18: MIXED-SIGNAL BRIDGE ────────
// Analog ↔ Dijital senkronizasyon köprüsü
VXA.MixedSignal = (function() {
  'use strict';

  var MS_TYPES = ['adc', 'dac', 'comparator', 'pwmGen'];
  var dacOutputs = {};
  var pwmStates = {};

  return {
    isMixedSignal: function(partType) {
      return MS_TYPES.indexOf(partType) >= 0;
    },

    syncAnalogToDigital: function(simTime, parts, nodeVoltages) {
      for (var i = 0; i < parts.length; i++) {
        var part = parts[i];
        if (part.damaged) continue;
        if (part.type === 'adc') this._processADC(part, simTime, nodeVoltages);
        else if (part.type === 'comparator') this._processComparator(part, simTime, nodeVoltages);
        else if (part.type === 'pwmGen') this._processPWM(part, simTime, nodeVoltages);
      }
    },

    syncDigitalToAnalog: function(simTime, parts, digitalStates) {
      for (var i = 0; i < parts.length; i++) {
        var part = parts[i];
        if (part.damaged || part.type !== 'dac') continue;
        this._processDAC(part, simTime, digitalStates);
      }
    },

    _processADC: function(part, simTime, nodeVoltages) {
      var props = part.props || {};
      var vrefPlus = props.vrefPlus || 5.0;
      var vrefMinus = props.vrefMinus || 0.0;
      var samplingRate = props.samplingRate || 10000;
      var samplingPeriod = 1.0 / samplingRate;

      if (!part._lastSampleTime) part._lastSampleTime = 0;
      if (simTime - part._lastSampleTime < samplingPeriod) return;
      part._lastSampleTime = simTime;

      var ainNode = part._nodes ? part._nodes[0] : -1;
      var vin = ainNode >= 0 ? (nodeVoltages[ainNode] || 0) : 0;

      var range = vrefPlus - vrefMinus;
      if (range <= 0) range = 5;
      var digitalValue = Math.round(((vin - vrefMinus) / range) * 255);
      digitalValue = Math.max(0, Math.min(255, digitalValue));

      if (VXA.Digital) {
        for (var bit = 0; bit < 8; bit++) {
          var bitValue = (digitalValue >> bit) & 1;
          var pinIndex = 3 + bit;
          var nodeId = part._nodes ? part._nodes[pinIndex] : -1;
          if (nodeId >= 0) {
            VXA.Digital.injectEvent(nodeId, simTime + 50e-9, bitValue === 1);
          }
        }
      }

      part._adcValue = digitalValue;
      part._adcVin = vin;
    },

    _processDAC: function(part, simTime, digitalStates) {
      var props = part.props || {};
      var vrefPlus = props.vrefPlus || 5.0;
      var vrefMinus = props.vrefMinus || 0.0;

      var digitalValue = 0;
      for (var bit = 0; bit < 8; bit++) {
        var nodeId = part._nodes ? part._nodes[bit] : -1;
        if (nodeId >= 0) {
          var state = digitalStates ? digitalStates[nodeId] : false;
          if (state) digitalValue |= (1 << bit);
        }
      }

      var vout = vrefMinus + (digitalValue / 255) * (vrefPlus - vrefMinus);
      dacOutputs[part.id] = vout;

      part._dacValue = digitalValue;
      part._dacVout = vout;
    },

    _processComparator: function(part, simTime, nodeVoltages) {
      var props = part.props || {};
      var hysteresis = props.hysteresis || 0.01;
      var responseTime = props.responseTime || 100e-9;

      var vpNode = part._nodes ? part._nodes[0] : -1;
      var vnNode = part._nodes ? part._nodes[1] : -1;
      var vPlus = vpNode >= 0 ? (nodeVoltages[vpNode] || 0) : 0;
      var vMinus = vnNode >= 0 ? (nodeVoltages[vnNode] || 0) : 0;

      var prevOut = part._compOutput || false;
      var newOut = prevOut;

      if (vPlus > vMinus + hysteresis) {
        newOut = true;
      } else if (vPlus < vMinus - hysteresis) {
        newOut = false;
      }

      if (newOut !== prevOut) {
        part._compOutput = newOut;
        var outNode = part._nodes ? part._nodes[2] : -1;
        if (outNode >= 0 && VXA.Digital) {
          VXA.Digital.injectEvent(outNode, simTime + responseTime, newOut);
        }
      }

      part._compVp = vPlus;
      part._compVn = vMinus;
      part._compOutput = newOut;
    },

    _processPWM: function(part, simTime, nodeVoltages) {
      var props = part.props || {};
      var frequency = props.frequency || 1000;
      var amplitude = props.amplitude || 5.0;
      var dutyCycle = props.dutyCycle || 0.5;

      var ctrlNode = part._nodes ? part._nodes[0] : -1;
      if (ctrlNode >= 0 && nodeVoltages && nodeVoltages[ctrlNode] !== undefined) {
        var vcc = props.amplitude || 5.0;
        var ctrlV = nodeVoltages[ctrlNode] || 0;
        if (ctrlV > 0.01) {
          dutyCycle = Math.max(0, Math.min(1, ctrlV / vcc));
        }
      }

      var period = 1.0 / frequency;
      var highTime = period * dutyCycle;

      if (!pwmStates[part.id]) {
        pwmStates[part.id] = { lastToggleTime: 0, currentOutput: false };
      }
      var state = pwmStates[part.id];

      var elapsed = simTime - state.lastToggleTime;
      var currentPhaseTime = state.currentOutput ? highTime : (period - highTime);

      if (elapsed >= currentPhaseTime) {
        state.currentOutput = !state.currentOutput;
        state.lastToggleTime = simTime;

        var outNode = part._nodes ? part._nodes[1] : -1;
        if (outNode >= 0 && VXA.Digital) {
          VXA.Digital.injectEvent(outNode, simTime, state.currentOutput);
        }
      }

      part._pwmDuty = dutyCycle;
      part._pwmOutput = state.currentOutput;
    },

    getDACOutput: function(partId) {
      return dacOutputs[partId] || 0;
    },

    reset: function() {
      dacOutputs = {};
      pwmStates = {};
    }
  };
})();

// ===== 7-SEGMENT DISPLAY DRAWING =====
var SEVEN_SEG_TABLE = [
  { a:1, b:1, c:1, d:1, e:1, f:1, g:0 }, // 0
  { a:0, b:1, c:1, d:0, e:0, f:0, g:0 }, // 1
  { a:1, b:1, c:0, d:1, e:1, f:0, g:1 }, // 2
  { a:1, b:1, c:1, d:1, e:0, f:0, g:1 }, // 3
  { a:0, b:1, c:1, d:0, e:0, f:1, g:1 }, // 4
  { a:1, b:0, c:1, d:1, e:0, f:1, g:1 }, // 5
  { a:1, b:0, c:1, d:1, e:1, f:1, g:1 }, // 6
  { a:1, b:1, c:1, d:0, e:0, f:0, g:0 }, // 7
  { a:1, b:1, c:1, d:1, e:1, f:1, g:1 }, // 8
  { a:1, b:1, c:1, d:1, e:0, f:1, g:1 }, // 9
  { a:1, b:1, c:1, d:0, e:1, f:1, g:1 }, // A (10)
  { a:0, b:0, c:1, d:1, e:1, f:1, g:1 }, // b (11)
  { a:1, b:0, c:0, d:1, e:1, f:1, g:0 }, // C (12)
  { a:0, b:1, c:1, d:1, e:1, f:0, g:1 }, // d (13)
  { a:1, b:0, c:0, d:1, e:1, f:1, g:1 }, // E (14)
  { a:1, b:0, c:0, d:0, e:1, f:1, g:1 }, // F (15)
];

function drawSevenSegment(ctx, x, y, segments, dpOn, zoom) {
  var scale = Math.max(0.5, zoom * 0.8);
  var segW = 16 * scale;
  var segH = 3 * scale;
  var segL = 14 * scale;
  var gap = 1 * scale;
  var pad = 4 * scale;

  var bodyW = segW + segH * 2 + pad * 2;
  var bodyH = segL * 2 + segH * 3 + pad * 2 + gap * 2;
  ctx.fillStyle = '#111111';
  ctx.strokeStyle = '#333333';
  ctx.lineWidth = 1;
  ctx.fillRect(x - bodyW/2, y - bodyH/2, bodyW, bodyH);
  ctx.strokeRect(x - bodyW/2, y - bodyH/2, bodyW, bodyH);

  var onColor = '#ff2222';
  var onGlow = 'rgba(255, 50, 50, 0.4)';
  var offColor = '#2a1111';

  var cx = x;
  var topY = y - bodyH/2 + pad + segH/2;

  function drawHSeg(sx, sy, on) {
    ctx.fillStyle = on ? onColor : offColor;
    ctx.beginPath();
    ctx.moveTo(sx - segW/2, sy);
    ctx.lineTo(sx - segW/2 + segH/2, sy - segH/2);
    ctx.lineTo(sx + segW/2 - segH/2, sy - segH/2);
    ctx.lineTo(sx + segW/2, sy);
    ctx.lineTo(sx + segW/2 - segH/2, sy + segH/2);
    ctx.lineTo(sx - segW/2 + segH/2, sy + segH/2);
    ctx.closePath();
    ctx.fill();
    if (on) {
      ctx.save();
      ctx.shadowColor = onGlow;
      ctx.shadowBlur = 4 * scale;
      ctx.fill();
      ctx.restore();
    }
  }

  function drawVSeg(sx, sy, on) {
    ctx.fillStyle = on ? onColor : offColor;
    ctx.beginPath();
    ctx.moveTo(sx, sy - segL/2);
    ctx.lineTo(sx + segH/2, sy - segL/2 + segH/2);
    ctx.lineTo(sx + segH/2, sy + segL/2 - segH/2);
    ctx.lineTo(sx, sy + segL/2);
    ctx.lineTo(sx - segH/2, sy + segL/2 - segH/2);
    ctx.lineTo(sx - segH/2, sy - segL/2 + segH/2);
    ctx.closePath();
    ctx.fill();
    if (on) {
      ctx.save();
      ctx.shadowColor = onGlow;
      ctx.shadowBlur = 4 * scale;
      ctx.fill();
      ctx.restore();
    }
  }

  var aY = topY;
  var gY = topY + segL + gap + segH;
  var dY = topY + segL * 2 + gap * 2 + segH * 2;
  var leftX = cx - segW/2 - segH/2;
  var rightX = cx + segW/2 + segH/2;
  var topSegCY = topY + segH/2 + gap + segL/2;
  var botSegCY = gY + segH/2 + gap + segL/2;

  drawHSeg(cx, aY, segments.a);
  drawVSeg(rightX, topSegCY, segments.b);
  drawVSeg(rightX, botSegCY, segments.c);
  drawHSeg(cx, dY, segments.d);
  drawVSeg(leftX, botSegCY, segments.e);
  drawVSeg(leftX, topSegCY, segments.f);
  drawHSeg(cx, gY, segments.g);

  if (dpOn !== undefined) {
    ctx.fillStyle = dpOn ? onColor : offColor;
    ctx.beginPath();
    ctx.arc(cx + segW/2 + segH + 4 * scale, dY, 2 * scale, 0, Math.PI * 2);
    ctx.fill();
    if (dpOn) {
      ctx.save();
      ctx.shadowColor = onGlow;
      ctx.shadowBlur = 3 * scale;
      ctx.fill();
      ctx.restore();
    }
  }
}
