// ──────── 4.5: SOUND EFFECTS SYSTEM — VXA.Sound ────────
VXA.Sound = (function() {
  var audioCtx = null;

  function getCtx() {
    if (!audioCtx) {
      try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) { return null; }
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }

  function createNoise(ctx, duration) {
    var bufferSize = Math.floor(ctx.sampleRate * duration);
    var buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    var data = buffer.getChannelData(0);
    for (var i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    var source = ctx.createBufferSource();
    source.buffer = buffer;
    source.start();
    source.stop(ctx.currentTime + duration);
    return source;
  }

  function play(type) {
    if (!S.soundOn) return;
    var ctx = getCtx();
    if (!ctx) return;
    var vol = S.soundVolume / 100;
    var gain = ctx.createGain();
    gain.connect(ctx.destination);

    if (type === 'click') {
      var osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.05);
      gain.gain.setValueAtTime(vol * 0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
      osc.connect(gain); osc.start(); osc.stop(ctx.currentTime + 0.05);
    }
    else if (type === 'pop') {
      var osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(vol * 0.5, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.connect(gain); osc.start(); osc.stop(ctx.currentTime + 0.15);
    }
    else if (type === 'bang') {
      var osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(150, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(20, ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(vol * 0.6, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      var noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(vol * 0.3, ctx.currentTime);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      var noise = createNoise(ctx, 0.15);
      noise.connect(noiseGain); noiseGain.connect(ctx.destination);
      osc.connect(gain); osc.start(); osc.stop(ctx.currentTime + 0.3);
    }
    else if (type === 'fuse') {
      var noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(vol * 0.4, ctx.currentTime);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      var noise = createNoise(ctx, 0.1);
      noise.connect(noiseGain); noiseGain.connect(ctx.destination);
    }
    else if (type === 'burn') {
      var noiseGain = ctx.createGain();
      var filter = ctx.createBiquadFilter();
      filter.type = 'lowpass'; filter.frequency.value = 500;
      noiseGain.gain.setValueAtTime(vol * 0.15, ctx.currentTime);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      var noise = createNoise(ctx, 0.5);
      noise.connect(filter); filter.connect(noiseGain); noiseGain.connect(ctx.destination);
    }
    else if (type === 'sim-start') {
      var osc = ctx.createOscillator();
      osc.type = 'sine'; osc.frequency.value = 60;
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(vol * 0.05, ctx.currentTime + 0.1);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3);
      osc.connect(gain); osc.start(); osc.stop(ctx.currentTime + 0.3);
    }
    else if (type === 'switch') {
      var osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.setValueAtTime(2000, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(500, ctx.currentTime + 0.02);
      gain.gain.setValueAtTime(vol * 0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.03);
      osc.connect(gain); osc.start(); osc.stop(ctx.currentTime + 0.03);
    }
  }

  return { play: play };
})();