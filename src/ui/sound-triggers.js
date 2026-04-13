// ──────── 4.5 SOUND TRIGGERS: Patch damage, switch, sim, place ────────
// Wrap VXA.Damage.apply to add sound
(function() {
  var _origDamageApply = VXA.Damage.apply || (function() {});
  // VXA.Damage is an IIFE — we need to patch after it's defined
  // The apply function is internal, so we'll patch the check function's calls via event
  VXA.EventBus.on('damage:occurred', function(data) {
    var type = data.part.type;
    if (type === 'led') VXA.Sound.play('pop');
    else if (type === 'capacitor') VXA.Sound.play('bang');
    else if (type === 'fuse') VXA.Sound.play('fuse');
    else if (type === 'resistor') VXA.Sound.play('burn');
    else if (type === 'npn' || type === 'pnp' || type === 'nmos' || type === 'pmos') VXA.Sound.play('burn');
    else if (type === 'diode' || type === 'zener') VXA.Sound.play('burn');
    else VXA.Sound.play('burn');
  });
})();

// Patch toggleSim for sim-start sound
var _origToggleSim = toggleSim;
toggleSim = function() {
  var wasRunning = S.sim.running;
  _origToggleSim();
  if (!wasRunning && S.sim.running) VXA.Sound.play('sim-start');
};

// ──────── 4.6: PATCH drawPart for source waveform preview ────────
var _origDrawPart = drawPart;
drawPart = function(part) {
  _origDrawPart(part);
  drawSourcePreview(part);
};

// ══════════════════════════════════════════════════════════════
// ██  SPRINT 5: EĞİTİM + ANSİKLOPEDİ + GALERİ + CİLALAMA    ██
// ══════════════════════════════════════════════════════════════
