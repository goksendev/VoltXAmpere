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
    // Sprint 34: Don't overwrite difficulty if PRESET_META has set a richer value (1-5 scale)
    if (pr.difficulty == null) pr.difficulty = diffMap[pr.id] || 1;
    pr.componentCount = pr.parts ? pr.parts.length : 0;
  });
  // Sprint 34: Re-apply preset metadata after gallery setup
  if (typeof decoratePresets === 'function') decoratePresets();
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
    // Sprint 34: 1-5 difficulty stars + rich details + nextPreset link
    var diff = pr.difficulty || 2;
    var stars = '';
    for (var s = 0; s < 5; s++) stars += s < diff ? '\u2B50' : '\u2606';
    var diffLabel = diff <= 2 ? t('diffEasy') : diff === 3 ? t('diffMedium') : t('diffHard');
    // Sprint 34: Use rich details if available
    var richDesc = '';
    if (pr.details && typeof pr.details === 'object') {
      richDesc = pr.details[currentLang] || pr.details.tr || pr.details.en || '';
    }
    var card = document.createElement('div');
    card.className = 'gallery-card';
    var nextLink = '';
    if (pr.nextPreset) {
      var nextPr = PRESETS.find(function(x){ return x.id === pr.nextPreset; });
      if (nextPr) {
        var nextName = typeof nextPr.name === 'object' ? (nextPr.name[currentLang] || nextPr.name.tr) : nextPr.name;
        nextLink = '<div class="gc-next" data-next="'+pr.nextPreset+'" style="font:10px var(--font-ui);color:var(--accent);margin-top:4px;cursor:pointer">'
          + (currentLang==='tr' ? 'Sonraki' : 'Next') + ': ' + nextName + ' \u2192</div>';
      }
    }
    card.innerHTML = '<div class="gc-name"><span class="gc-dot" style="background:'+(pr.color||'#888')+'"></span>'+name+'</div>'
      + '<div class="gc-desc">'+(richDesc || desc || '')+'</div>'
      + '<div class="gc-meta"><span style="letter-spacing:-1px">'+stars+'</span><span>'+pr.componentCount+' '+t('parts')+'</span></div>'
      + nextLink
      + '<button class="gc-load" data-id="'+pr.id+'">'+t('galleryLoad')+'</button>';
    card.querySelector('.gc-load').addEventListener('click', function() {
      loadPreset(this.getAttribute('data-id'));
      document.getElementById('gallery-modal').classList.remove('show');
    });
    var nextEl = card.querySelector('.gc-next');
    if (nextEl) {
      nextEl.addEventListener('click', function(ev) {
        ev.stopPropagation();
        loadPreset(this.getAttribute('data-next'));
        document.getElementById('gallery-modal').classList.remove('show');
      });
    }
    grid.appendChild(card);
  });
  document.getElementById('gallery-modal').classList.add('show');
}

function filterGallery() { showGallery(); }

// Sprint 33: Format v2 + applies model + v1 backward compat + loaded notification
function loadFromURL() {
  if (!location.hash.startsWith('#circuit=')) return;
  try {
    var encoded = location.hash.substring(9);
    if (encoded.indexOf('&') > -1) encoded = encoded.split('&')[0];
    var json;
    try { json = decodeURIComponent(escape(atob(encoded))); }
    catch(e) { json = atob(encoded); }
    var data = JSON.parse(json);
    if (!data.p || !data.w) return;
    S.parts = []; S.wires = []; S.nextId = 1;
    data.p.forEach(function(p) {
      var type = p[0], x = p[1], y = p[2], rot = p[3], val = p[4], freq = p[5] || 0;
      var extras = (p.length > 6 && typeof p[6] === 'object') ? p[6] : {};
      var newPart = {
        id: S.nextId++, type: type, name: nextName(type),
        x: x, y: y, rot: rot, val: val, freq: freq,
        flipH: false, flipV: false, closed: false
      };
      // Sprint 33 extras (format v2)
      if (extras.cl) newPart.closed = true;
      if (extras.wp !== undefined) newPart.wiper = extras.wp;
      if (extras.lb) newPart.label = extras.lb;
      if (extras.lc) newPart.ledColor = extras.lc;
      if (extras.cp) newPart.coupling = extras.cp;
      if (extras.l1) newPart.L1 = extras.l1;
      if (extras.l2) newPart.L2 = extras.l2;
      if (extras.ph) newPart.phase = extras.ph;
      if (extras.dt) newPart.duty = extras.dt;
      if (extras.dc) newPart.dcOffset = extras.dc;
      if (extras.z) newPart.impedance = extras.z;
      // Model uygulaması (KRİTİK)
      if (extras.m) {
        newPart.model = extras.m;
        if (typeof applyModel === 'function') applyModel(newPart, extras.m);
      } else {
        // Format v1 uyumluluğu: model yoksa default
        var defModel = (typeof VXA !== 'undefined' && VXA.Models && VXA.Models.getDefault)
                       ? VXA.Models.getDefault(type) : null;
        if (defModel) {
          newPart.model = defModel;
          if (typeof applyModel === 'function') applyModel(newPart, defModel);
        }
      }
      S.parts.push(newPart);
    });
    data.w.forEach(function(w) {
      S.wires.push({ x1: w[0], y1: w[1], x2: w[2], y2: w[3] });
    });
    S.sel = []; needsRender = true;
    if (S.parts.length) {
      setTimeout(function() {
        var mnx=Infinity,mny=Infinity,mxx=-Infinity,mxy=-Infinity;
        S.parts.forEach(function(p){mnx=Math.min(mnx,p.x-60);mny=Math.min(mny,p.y-60);mxx=Math.max(mxx,p.x+60);mxy=Math.max(mxy,p.y+60);});
        var cw=cvs.width/DPR,ch=cvs.height/DPR;
        S.view.zoom=Math.min(cw/(mxx-mnx),ch/(mxy-mny),S.view.maxZoom)*0.85;
        S.view.ox=cw/2-((mnx+mxx)/2)*S.view.zoom;
        S.view.oy=ch/2-((mny+mxy)/2)*S.view.zoom;
        needsRender=true;
      }, 100);
      setTimeout(function() {
        var msg = (typeof currentLang !== 'undefined' && currentLang === 'tr')
          ? '\uD83D\uDD17 Paylaşılan devre yüklendi! ' + S.parts.length + ' bileşen.'
          : '\uD83D\uDD17 Shared circuit loaded! ' + S.parts.length + ' components.';
        if (typeof showInfoCard === 'function') showInfoCard(msg, '', '');
      }, 500);
    }
  } catch (e) { console.error('URL load error:', e); }
}
