// ──────── SPRINT 12: SPATIAL AUDIO + HUM ENGINE — VXA.SpatialAudio ────────
VXA.SpatialAudio = (function() {
  'use strict';

  var ctx = null;           // AudioContext (shared with VXA.Sound)
  var masterGain = null;    // Master volume
  var activeHums = {};      // componentId → { oscillators[], gainNode, panner }
  var canvasWidth = 800;
  var canvasHeight = 600;
  var viewCenterX = 400;
  var viewCenterY = 300;
  var viewZoom = 1;

  // Canvas koordinatını -1..+1 stereo pozisyona çevir
  function canvasToStereo(cx) {
    var screenX = (cx - viewCenterX) * viewZoom + canvasWidth / 2;
    var ratio = screenX / canvasWidth;  // 0..1
    return Math.max(-1, Math.min(1, ratio * 2 - 1));  // -1 (sol) .. +1 (sağ)
  }

  // Mesafeye göre ses azalması
  function distanceFactor(cx, cy) {
    var dx = (cx - viewCenterX) * viewZoom;
    var dy = (cy - viewCenterY) * viewZoom;
    var dist = Math.sqrt(dx * dx + dy * dy);
    var maxDist = Math.sqrt(canvasWidth * canvasWidth + canvasHeight * canvasHeight) / 2;
    return Math.max(0.1, 1 - (dist / maxDist) * 0.9);
  }

  function ensureContext() {
    if (!ctx) {
      try {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        masterGain = ctx.createGain();
        masterGain.gain.value = 0.5;
        masterGain.connect(ctx.destination);
      } catch (e) {
        return false;
      }
    }
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    return true;
  }

  function createNoise(duration) {
    var bufLen = Math.floor(ctx.sampleRate * duration);
    var noiseBuf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    var data = noiseBuf.getChannelData(0);
    for (var i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;
    var noise = ctx.createBufferSource();
    noise.buffer = noiseBuf;
    return noise;
  }

  return {
    // Viewport bilgisini güncelle
    updateViewport: function(cw, ch, centerX, centerY, zoom) {
      canvasWidth = cw || 800;
      canvasHeight = ch || 600;
      viewCenterX = centerX || canvasWidth / 2;
      viewCenterY = centerY || canvasHeight / 2;
      viewZoom = zoom || 1;
    },

    // ===== ONE-SHOT SPATIAL SES =====
    playAt: function(soundType, canvasX, canvasY) {
      if (!S.soundOn) return;
      if (!ensureContext()) return;

      var vol = S.soundVolume / 100;
      var stereo = canvasToStereo(canvasX);
      var dist = distanceFactor(canvasX, canvasY);

      // StereoPannerNode
      var panner = ctx.createStereoPanner();
      panner.pan.value = stereo;

      var gain = ctx.createGain();
      gain.connect(ctx.destination);
      panner.connect(gain);

      var now = ctx.currentTime;
      var v = vol * dist;

      switch (soundType) {
        case 'click': {
          var osc = ctx.createOscillator();
          osc.type = 'square';
          osc.frequency.setValueAtTime(800, now);
          osc.frequency.exponentialRampToValueAtTime(200, now + 0.05);
          gain.gain.setValueAtTime(v * 0.3, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
          osc.connect(panner);
          osc.start(now); osc.stop(now + 0.05);
          break;
        }
        case 'pop': {
          var osc = ctx.createOscillator();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(600, now);
          osc.frequency.exponentialRampToValueAtTime(50, now + 0.15);
          gain.gain.setValueAtTime(v * 0.5, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
          osc.connect(panner);
          osc.start(now); osc.stop(now + 0.15);
          break;
        }
        case 'bang': {
          var osc = ctx.createOscillator();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(150, now);
          osc.frequency.exponentialRampToValueAtTime(20, now + 0.3);
          gain.gain.setValueAtTime(v * 0.6, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
          osc.connect(panner);
          // Noise katmanı
          var noise = createNoise(0.15);
          var noiseGain = ctx.createGain();
          noiseGain.gain.setValueAtTime(v * 0.3, now);
          noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
          noise.connect(noiseGain); noiseGain.connect(panner);
          osc.start(now); osc.stop(now + 0.3);
          noise.start(now); noise.stop(now + 0.2);
          break;
        }
        case 'fuse': {
          var noise = createNoise(0.1);
          gain.gain.setValueAtTime(v * 0.4, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
          noise.connect(panner);
          noise.start(now); noise.stop(now + 0.1);
          break;
        }
        case 'burn': {
          var noise = createNoise(0.5);
          var filter = ctx.createBiquadFilter();
          filter.type = 'lowpass'; filter.frequency.value = 500;
          gain.gain.setValueAtTime(v * 0.15, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
          noise.connect(filter); filter.connect(panner);
          noise.start(now); noise.stop(now + 0.5);
          break;
        }
        case 'switch': {
          var osc = ctx.createOscillator();
          osc.type = 'square';
          osc.frequency.setValueAtTime(2000, now);
          osc.frequency.exponentialRampToValueAtTime(500, now + 0.02);
          gain.gain.setValueAtTime(v * 0.2, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
          osc.connect(panner);
          osc.start(now); osc.stop(now + 0.03);
          break;
        }
        case 'sim-start': {
          var osc = ctx.createOscillator();
          osc.type = 'sine'; osc.frequency.value = 60;
          gain.gain.setValueAtTime(0, now);
          gain.gain.linearRampToValueAtTime(v * 0.05, now + 0.1);
          gain.gain.linearRampToValueAtTime(0, now + 0.3);
          osc.connect(panner);
          osc.start(now); osc.stop(now + 0.3);
          break;
        }
      }
    },

    // ===== SÜREKLİ UĞULTU (HUM) =====
    startHum: function(componentId, canvasX, canvasY, currentAmps, maxAmps) {
      if (!S.soundOn) return;
      if (!ensureContext()) return;
      if (activeHums[componentId]) return; // Zaten çalıyor

      var ratio = Math.min(1, Math.abs(currentAmps) / Math.max(0.001, maxAmps));
      if (ratio < 0.2) return; // Çok düşük akım

      var stereo = canvasToStereo(canvasX);
      var dist = distanceFactor(canvasX, canvasY);

      var panner = ctx.createStereoPanner();
      panner.pan.value = stereo;

      var humGain = ctx.createGain();
      humGain.gain.value = 0.08 * dist * ratio;

      panner.connect(humGain);
      humGain.connect(masterGain);

      var oscillators = [];
      var baseFreq = 50;

      // 1. Temel ton (50Hz)
      var osc1 = ctx.createOscillator();
      osc1.type = 'sine'; osc1.frequency.value = baseFreq;
      var g1 = ctx.createGain(); g1.gain.value = 0.5;
      osc1.connect(g1); g1.connect(panner);
      osc1.start(); oscillators.push({ osc: osc1, gain: g1 });

      // 2. 3. harmonik (150Hz) — ratio > 0.3
      if (ratio > 0.3) {
        var osc3 = ctx.createOscillator();
        osc3.type = 'sine'; osc3.frequency.value = baseFreq * 3;
        var g3 = ctx.createGain(); g3.gain.value = ratio * 0.3;
        osc3.connect(g3); g3.connect(panner);
        osc3.start(); oscillators.push({ osc: osc3, gain: g3 });
      }

      // 3. 5. harmonik (250Hz) — ratio > 0.5
      if (ratio > 0.5) {
        var osc5 = ctx.createOscillator();
        osc5.type = 'sine'; osc5.frequency.value = baseFreq * 5;
        var g5 = ctx.createGain(); g5.gain.value = ratio * 0.2;
        osc5.connect(g5); g5.connect(panner);
        osc5.start(); oscillators.push({ osc: osc5, gain: g5 });
      }

      // 4. 7. harmonik (350Hz) — ratio > 0.7
      if (ratio > 0.7) {
        var osc7 = ctx.createOscillator();
        osc7.type = 'sine'; osc7.frequency.value = baseFreq * 7;
        var g7 = ctx.createGain(); g7.gain.value = ratio * 0.15;
        osc7.connect(g7); g7.connect(panner);
        osc7.start(); oscillators.push({ osc: osc7, gain: g7 });
      }

      // 5. Tiz sızlanma (2kHz) — ratio > 0.9 (TEHLİKE!)
      if (ratio > 0.9) {
        var oscHigh = ctx.createOscillator();
        oscHigh.type = 'sine'; oscHigh.frequency.value = 2000;
        var gHigh = ctx.createGain(); gHigh.gain.value = (ratio - 0.9) * 2;
        oscHigh.connect(gHigh); gHigh.connect(panner);
        oscHigh.start(); oscillators.push({ osc: oscHigh, gain: gHigh });
      }

      activeHums[componentId] = {
        oscillators: oscillators,
        gainNode: humGain,
        panner: panner,
        ratio: ratio
      };
    },

    // Hum parametrelerini güncelle
    updateHum: function(componentId, canvasX, canvasY, currentAmps, maxAmps) {
      var hum = activeHums[componentId];
      if (!hum) return;

      var ratio = Math.min(1, Math.abs(currentAmps) / Math.max(0.001, maxAmps));
      var stereo = canvasToStereo(canvasX);
      var dist = distanceFactor(canvasX, canvasY);

      hum.panner.pan.value = stereo;
      hum.gainNode.gain.value = 0.08 * dist * ratio;

      if (ratio < 0.15) {
        this.stopHum(componentId);
      }
    },

    stopHum: function(componentId) {
      var hum = activeHums[componentId];
      if (!hum) return;

      var now = ctx ? ctx.currentTime : 0;
      try { hum.gainNode.gain.linearRampToValueAtTime(0, now + 0.1); } catch(e) {}

      setTimeout(function() {
        hum.oscillators.forEach(function(o) {
          try { o.osc.stop(); } catch (e) {}
        });
      }, 150);

      delete activeHums[componentId];
    },

    stopAll: function() {
      var ids = Object.keys(activeHums);
      for (var i = 0; i < ids.length; i++) {
        this.stopHum(ids[i]);
      }
    },

    setVolume: function(v) {
      if (masterGain) {
        masterGain.gain.value = Math.max(0, Math.min(1, v));
      }
    },

    getVolume: function() {
      return masterGain ? masterGain.gain.value : 0.5;
    },

    getActiveHumCount: function() {
      return Object.keys(activeHums).length;
    },

    dispose: function() {
      this.stopAll();
      if (ctx) {
        try { ctx.close(); } catch(e) {}
        ctx = null;
        masterGain = null;
      }
    }
  };
})();
