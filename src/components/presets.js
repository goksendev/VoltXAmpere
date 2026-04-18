// ──────── PRESETS ────────
var PRESETS = [];


(function buildPalette() {
  const cats = { Passive: 'Pasif (Passive)', Sources: 'Kaynaklar (Sources)', Semi: 'Yarıiletken (Semiconductor)', ICs: 'Entegre (ICs)', Logic: 'Lojik (Logic)', Control: 'Kontrol (Control)', Basic: 'Temel (Basic)' };
  const el = document.getElementById('left');
  for (const [ck, cl] of Object.entries(cats)) {
    const items = Object.entries(COMP).filter(([, v]) => v.cat === ck);
    if (!items.length) continue;
    const hdr = document.createElement('div');
    hdr.className = 'cat-header open';
    hdr.innerHTML = `<span>${cl}</span><span class="arrow">&#9654;</span>`;
    const body = document.createElement('div');
    body.className = 'cat-body'; body.style.maxHeight = '400px';
    items.forEach(([k, v]) => {
      const d = document.createElement('div'); d.className = 'comp-item';
      d.innerHTML = `<span style="display:flex;align-items:center"><span class="dot" style="background:${v.color}"></span>${v.name}</span>${v.key ? '<span class="key">'+v.key+'</span>' : ''}`;
      d.addEventListener('click', () => startPlace(k));
      body.appendChild(d);
    });
    hdr.addEventListener('click', () => { hdr.classList.toggle('open'); body.classList.toggle('closed'); });
    el.appendChild(hdr); el.appendChild(body);
  }
  // Preset section
  const psec = document.createElement('div');
  psec.innerHTML = '<div style="margin-top:16px;padding:8px;font-size:11px;font-weight:700;color:var(--accent);text-transform:uppercase;letter-spacing:1px;border-top:2px solid var(--accent);border-radius:0">&#9889; Hazır Devreler (Presets)</div>';
  el.appendChild(psec);
  PRESETS.forEach(pr => {
    const d = document.createElement('div'); d.className = 'comp-item';
    d.innerHTML = `<span style="display:flex;align-items:center"><span class="dot" style="background:${pr.color}"></span>${pr.name}</span>`;
    d.addEventListener('click', () => loadPreset(pr.id));
    el.appendChild(d);
  });
})();