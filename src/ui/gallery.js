// ──────── GALLERY ────────
var galleryFilter = 'all';

(function enrichPresets() {
  var catMap = {
    'vdiv':'basic','rclp':'filter','led':'basic','halfwave':'power','rccharge':'basic',
    'rlc':'filter','serpar':'basic','rl':'basic','ce-amp':'amplifier','npn-sw':'digital',
    'cmos-inv':'digital','inv-opamp':'amplifier','noninv-opamp':'amplifier',
    'zener-reg':'power','vreg-7805':'power','logic-demo':'digital','trafo':'power',
    'dep-src':'analysis','dc-sweep-led':'analysis','bode-rc':'analysis',
    'jfet-cs':'amplifier','scr-phase':'power','param-sweep-rc':'analysis',
    'fft-square':'analysis','dff-toggle':'digital','lissajous':'analysis',
    'diff-meas':'analysis','ntc-sensor':'sensor','ldr-sensor':'sensor',
    'pot-divider':'basic','mc-rc':'analysis','crystal-osc':'filter',
    'dc-motor':'power','sens-demo':'analysis','wc-demo':'analysis'
  };
  var diffMap = {
    'vdiv':1,'rclp':1,'led':1,'halfwave':2,'rccharge':1,'rlc':2,'serpar':1,'rl':1,
    'ce-amp':2,'npn-sw':2,'cmos-inv':2,'inv-opamp':2,'noninv-opamp':2,
    'zener-reg':2,'vreg-7805':1,'logic-demo':1,'trafo':2,
    'dep-src':2,'dc-sweep-led':1,'bode-rc':2,
    'jfet-cs':3,'scr-phase':3,'param-sweep-rc':2,'fft-square':2,
    'dff-toggle':2,'lissajous':2,'diff-meas':2,
    'ntc-sensor':1,'ldr-sensor':1,'pot-divider':1,'mc-rc':2,
    'crystal-osc':3,'dc-motor':2,'sens-demo':2,'wc-demo':2
  };
  PRESETS.forEach(function(pr) {
    pr.category = catMap[pr.id] || 'basic';
    pr.difficulty = diffMap[pr.id] || 1;
    pr.componentCount = pr.parts ? pr.parts.length : 0;
  });
})();

function showGallery() {
  document.getElementById('gallery-title-h').textContent = t('galleryTitle');
  document.getElementById('gallery-search').placeholder = t('gallerySearch');
  var fDiv = document.getElementById('gallery-filters');
  var cats = [
    ['all', t('galleryAll')], ['basic', t('galleryBasic')], ['filter', t('galleryFilter')],
    ['amplifier', t('galleryAmp')], ['digital', t('galleryDigital')], ['power', t('galleryPower')],
    ['sensor', t('gallerySensor')], ['analysis', t('galleryAnalysis')]
  ];
  fDiv.innerHTML = '';
  cats.forEach(function(c) {
    var btn = document.createElement('button');
    btn.className = 'gallery-filter-btn' + (galleryFilter === c[0] ? ' active' : '');
    btn.textContent = c[1];
    btn.onclick = function() { galleryFilter = c[0]; showGallery(); };
    fDiv.appendChild(btn);
  });
  var grid = document.getElementById('gallery-grid');
  var search = (document.getElementById('gallery-search').value || '').toLowerCase();
  grid.innerHTML = '';
  PRESETS.forEach(function(pr) {
    if (galleryFilter !== 'all' && pr.category !== galleryFilter) return;
    var name = typeof pr.name === 'object' ? (pr.name[currentLang] || pr.name.tr || pr.name) : pr.name;
    var desc = typeof pr.desc === 'object' ? (pr.desc[currentLang] || pr.desc.tr || pr.desc) : pr.desc;
    if (search && name.toLowerCase().indexOf(search) === -1 && (desc||'').toLowerCase().indexOf(search) === -1) return;
    var stars = pr.difficulty === 1 ? '\u2B50' : pr.difficulty === 2 ? '\u2B50\u2B50' : '\u2B50\u2B50\u2B50';
    var diffLabel = pr.difficulty === 1 ? t('diffEasy') : pr.difficulty === 2 ? t('diffMedium') : t('diffHard');
    var card = document.createElement('div');
    card.className = 'gallery-card';
    card.innerHTML = '<div class="gc-name"><span class="gc-dot" style="background:'+(pr.color||'#888')+'"></span>'+name+'</div>'
      + '<div class="gc-desc">'+(desc||'')+'</div>'
      + '<div class="gc-meta"><span>'+stars+' '+diffLabel+'</span><span>'+pr.componentCount+' '+t('parts')+'</span></div>'
      + '<button class="gc-load" data-id="'+pr.id+'">'+t('galleryLoad')+'</button>';
    card.querySelector('.gc-load').addEventListener('click', function() {
      loadPreset(this.getAttribute('data-id'));
      document.getElementById('gallery-modal').classList.remove('show');
    });
    grid.appendChild(card);
  });
  document.getElementById('gallery-modal').classList.add('show');
}

function filterGallery() { showGallery(); }

function loadFromURL() {
  if (!location.hash.startsWith('#circuit=')) return;
  try {
    const encoded = location.hash.substring(9);
    const data = JSON.parse(atob(encoded));
    if (!data.p || !data.w) return;
    S.parts = []; S.wires = []; S.nextId = 1;
    data.p.forEach(p => {
      const [type, x, y, rot, val, freq] = p;
      S.parts.push({ id: S.nextId++, type, name: nextName(type), x, y, rot, val, freq: freq || 0, flipH: false, flipV: false, closed: false });
    });
    data.w.forEach(w => {
      const [x1, y1, x2, y2] = w;
      S.wires.push({ x1, y1, x2, y2 });
    });
    S.sel = []; needsRender = true;
    // Fit
    if (S.parts.length) {
      setTimeout(() => {
        let mnx=Infinity,mny=Infinity,mxx=-Infinity,mxy=-Infinity;
        S.parts.forEach(p=>{mnx=Math.min(mnx,p.x-60);mny=Math.min(mny,p.y-60);mxx=Math.max(mxx,p.x+60);mxy=Math.max(mxy,p.y+60);});
        const cw=cvs.width/DPR,ch=cvs.height/DPR;
        S.view.zoom=Math.min(cw/(mxx-mnx),ch/(mxy-mny),S.view.maxZoom)*0.85;
        S.view.ox=cw/2-((mnx+mxx)/2)*S.view.zoom;
        S.view.oy=ch/2-((mny+mxy)/2)*S.view.zoom;
        needsRender=true;
      }, 100);
    }
  } catch (e) { console.error('URL load error:', e); }
}
