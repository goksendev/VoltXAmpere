// ──────── PARTICLE ENGINE (v6 Sprint 2) ────────
VXA.Particles = (function() {
  var pool = [];
  var MAX_PARTICLES = 500;

  var PRESETS = {
    spark:  { gravity: 100, life: [0.3, 0.6], speed: [50, 150], size: [1, 3], shrink: true, glow: true },
    smoke:  { gravity: -40, life: [0.8, 1.8], speed: [10, 30], size: [3, 6], grow: true, glow: false },
    flash:  { gravity: 0, life: [0.1, 0.2], speed: [0, 0], size: [25, 40], grow: true, glow: true },
    debris: { gravity: 200, life: [0.5, 1.2], speed: [30, 80], size: [2, 5], shrink: false, glow: false, rotate: true },
    ember:  { gravity: -15, life: [0.6, 1.5], speed: [5, 15], size: [1, 2.5], shrink: false, glow: true, flicker: true }
  };

  function rand(min, max) { return min + Math.random() * (max - min); }

  function spawn(wx, wy, type, color, count, opts) {
    var pre = PRESETS[type] || PRESETS.spark;
    opts = opts || {};
    for (var i = 0; i < count && pool.length < MAX_PARTICLES; i++) {
      var angle = Math.random() * Math.PI * 2;
      var sp = rand(pre.speed[0], pre.speed[1]);
      pool.push({
        x: wx, y: wy,
        vx: Math.cos(angle) * sp * (opts.dirX || 1),
        vy: Math.sin(angle) * sp * (opts.dirY || 1) - (type === 'smoke' ? 20 : 0),
        life: rand(pre.life[0], pre.life[1]),
        maxLife: 0,
        size: rand(pre.size[0], pre.size[1]),
        baseSize: 0,
        color: color || '#ffaa00',
        gravity: pre.gravity,
        type: type,
        grow: pre.grow || false,
        shrink: pre.shrink || false,
        glow: pre.glow || false,
        flicker: pre.flicker || false,
        rotate: pre.rotate || false,
        rot: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 10
      });
      pool[pool.length - 1].maxLife = pool[pool.length - 1].life;
      pool[pool.length - 1].baseSize = pool[pool.length - 1].size;
    }
  }

  function explode(wx, wy, explosionType, color) {
    switch (explosionType) {
      case 'led':
        spawn(wx, wy, 'flash', '#ffffff', 1);
        spawn(wx, wy, 'spark', color || '#eab308', 25);
        spawn(wx, wy, 'smoke', 'rgba(80,80,80,0.4)', 8);
        break;
      case 'capacitor':
        spawn(wx, wy, 'flash', '#ffffff', 1, { dirY: -1 });
        spawn(wx, wy, 'debris', color || '#888888', 8);
        spawn(wx, wy, 'smoke', 'rgba(80,80,80,0.5)', 15);
        spawn(wx, wy, 'spark', '#ffcc00', 12);
        break;
      case 'resistor':
        spawn(wx, wy, 'ember', '#ff6600', 12);
        spawn(wx, wy, 'smoke', 'rgba(60,60,60,0.4)', 10);
        break;
      case 'wire':
        spawn(wx, wy, 'spark', '#ffdd00', 15);
        spawn(wx, wy, 'flash', '#ffffff', 1);
        break;
      case 'fuse':
        spawn(wx, wy, 'spark', '#ffcc00', 10);
        spawn(wx, wy, 'flash', '#ffffcc', 1);
        spawn(wx, wy, 'smoke', 'rgba(70,70,70,0.3)', 5);
        break;
      case 'transistor':
        spawn(wx, wy, 'smoke', 'rgba(60,60,60,0.5)', 12);
        spawn(wx, wy, 'ember', '#ff4400', 8);
        spawn(wx, wy, 'flash', '#ffeecc', 1);
        break;
      default:
        spawn(wx, wy, 'spark', color || '#ff6600', 15);
        spawn(wx, wy, 'flash', '#ffffff', 1);
    }
  }

  function update(dt) {
    for (var i = pool.length - 1; i >= 0; i--) {
      var p = pool[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.gravity * dt;
      p.vx *= 0.99;
      p.vy *= 0.99;
      p.life -= dt;
      if (p.rotate) p.rot += p.rotSpeed * dt;
      if (p.life <= 0) { pool.splice(i, 1); }
    }
  }

  function draw(ctx) {
    if (pool.length === 0) return;
    var z = S.view.zoom;
    ctx.save();
    for (var i = 0; i < pool.length; i++) {
      var p = pool[i];
      var lifeRatio = Math.max(0, p.life / p.maxLife);
      var alpha = lifeRatio;
      if (p.flicker) alpha *= 0.5 + Math.random() * 0.5;

      var sz = p.baseSize;
      if (p.grow) sz = p.baseSize * (1 + (1 - lifeRatio) * 2);
      if (p.shrink) sz = p.baseSize * lifeRatio;
      sz = Math.max(0.5, sz);

      ctx.globalAlpha = alpha;

      if (p.type === 'flash') {
        var grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, sz);
        grad.addColorStop(0, 'rgba(255,255,255,' + (alpha * 0.9) + ')');
        grad.addColorStop(0.4, p.color);
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(p.x, p.y, sz, 0, Math.PI * 2); ctx.fill();
      } else if (p.type === 'smoke') {
        var grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, sz);
        grad.addColorStop(0, p.color);
        grad.addColorStop(1, 'rgba(80,80,80,0)');
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(p.x, p.y, sz, 0, Math.PI * 2); ctx.fill();
      } else if (p.type === 'debris') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-sz / 2, -sz / 4, sz, sz / 2);
        ctx.restore();
      } else {
        // spark, ember
        if (p.glow) { ctx.shadowColor = p.color; ctx.shadowBlur = 6 * lifeRatio; }
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, sz, 0, Math.PI * 2); ctx.fill();
        if (p.glow) { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; }
      }
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function clear() { pool.length = 0; }
  function count() { return pool.length; }

  return { spawn: spawn, explode: explode, update: update, draw: draw, clear: clear, count: count };
})();