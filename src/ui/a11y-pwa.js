// ──────── SPRINT 10: FİNAL CİLALAMA + PWA + A11Y ────────

// 10.1: PWA MANIFEST (inline)
(function setupPWA() {
  if (typeof document === 'undefined') return;
  try {
    var iconCanvas = document.createElement('canvas');
    iconCanvas.width = iconCanvas.height = 192;
    var ictx = iconCanvas.getContext('2d');
    ictx.fillStyle = '#06080c'; ictx.fillRect(0, 0, 192, 192);
    ictx.fillStyle = '#00d4ff'; ictx.font = 'bold 120px sans-serif'; ictx.textAlign = 'center'; ictx.textBaseline = 'middle';
    ictx.fillText('\u26A1', 96, 86);
    ictx.fillStyle = '#fff'; ictx.font = 'bold 24px sans-serif'; ictx.fillText('VXA', 96, 160);
    var iconURL = iconCanvas.toDataURL('image/png');
    var manifest = { name: 'VoltXAmpere \u2014 Circuit Simulator', short_name: 'VoltXAmpere', description: 'Free online SPICE-class circuit simulator', start_url: './', display: 'standalone', background_color: '#06080c', theme_color: '#00d4ff', orientation: 'any', icons: [{ src: iconURL, sizes: '192x192', type: 'image/png' }], categories: ['education', 'utilities'], lang: 'tr' };
    var blob = new Blob([JSON.stringify(manifest)], { type: 'application/json' });
    var oldLink = document.querySelector('link[rel="manifest"]');
    if (oldLink) oldLink.remove();
    var link = document.createElement('link'); link.rel = 'manifest'; link.href = URL.createObjectURL(blob);
    document.head.appendChild(link);
  } catch(e) { /* Manifest oluşturulamadı — OK */ }
})();

// 10.2: ERİŞİLEBİLİRLİK
function announce(message) {
  var el = document.getElementById('sr-announcer');
  if (!el) {
    el = document.createElement('div'); el.id = 'sr-announcer';
    el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite'); el.setAttribute('aria-atomic', 'true');
    el.className = 'sr-only';
    document.body.appendChild(el);
  }
  el.textContent = message;
}
function setupA11yLabels() {
  document.querySelectorAll('.tb-btn, button[onclick]').forEach(function(btn) {
    if (!btn.getAttribute('aria-label')) {
      var label = btn.getAttribute('title') || btn.textContent.trim().replace(/[\u2600-\u27BF\uD800-\uDBFF\uDC00-\uDFFF]/g, '').trim();
      if (label) btn.setAttribute('aria-label', label);
    }
  });
}
function toggleHighContrast() {
  S.highContrast = !S.highContrast;
  document.documentElement.setAttribute('data-contrast', S.highContrast ? 'high' : 'normal');
  if (typeof localStorage !== 'undefined') localStorage.setItem('vxa_high_contrast', S.highContrast ? '1' : '0');
  announce(S.highContrast ? 'Y\u00fcksek kontrast a\u00e7\u0131k' : 'Y\u00fcksek kontrast kapal\u0131');
}

// 10.4: CHANGELOG
function showChangelog() {
  var html = '<div style="font:12px var(--font-ui);color:var(--text-2);line-height:1.7;max-height:400px;overflow-y:auto;padding:8px">';
  html += '<h3 style="color:var(--accent);font-size:14px;margin:0 0 8px">v9.0 \u2014 .SUBCKT Era</h3>';
  html += '<p>\u2022 \u23EA Zaman Makinesi \u2014 DAW tarz\u0131 timeline, state scrubbing</p>';
  html += '<p>\u2022 Spike markers + bookmark sistemi</p>';
  html += '<p>\u2022 Circular buffer (2000 snapshot, ~5-10MB)</p>';
  html += '<p>\u2022 Kare kare ileri/geri (. ve ,) k\u0131sayollar\u0131</p>';
  html += '<p>\u2022 \uD83D\uDD0A Mekansal Ses \u2014 stereo panning, 50Hz harmonik u\u011Fultu</p>';
  html += '<p>\u2022 \u3030\uFE0F Kablo Titre\u015Fimi \u2014 ak\u0131m bazl\u0131 titreyen kablolar + renk de\u011Fi\u015Fimi</p>';
  html += '<p>\u2022 \u26A1 Kaos Modu \u2014 5 senaryo (voltaj surge, noise, harmonik, s\u0131cakl\u0131k, ya\u015Flanma), sa\u011Flaml\u0131k raporu, \u00fcstel patlama \u00f6l\u00e7ekleme</p>';
  html += '<p>\u2022 \uD83D\uDCCF Holografik Form\u00fcller \u2014 Hover\'da canl\u0131 V=IR, P=I\u00B2R, Xc, gm form\u00fclleri</p>';
  html += '<p>\u2022 \uD83D\uDD0C 3D Prob UX \u2014 S\u00fcr\u00fcklenebilir multimetre problar\u0131 + \u0394V tooltip</p>';
  html += '<p>\u2022 \uD83E\uDDF2 M\u0131knat\u0131sl\u0131 Pin Snap + Kapasit\u00f6r Nefes Efekti</p>';
  html += '<p>\u2022 \uD83E\uDD16 AI Devre Asistan\u0131 \u2014 Anthropic API + 11 tool (addComponent, addWire, analyze, vb.), do\u011Fal dil ile devre kur</p>';
  html += '<p>\u2022 \uD83D\uDD0D AI Hata Tespiti \u2014 8 hata tipi (floating node, diren\u00E7siz LED, k\u0131sa devre), auto-correction, canvas overlay</p>';
  html += '<p>\u2022 \uD83D\uDD32 Dijital Motor \u2014 Event-driven sim\u00fclasyon, D/JK/T Flip-Flop, Counter, Shift Register, MUX, 7-Segment, Timing Diagram</p>';
  html += '<p>\u2022 \u26A1 Mixed-Signal K\u00f6pr\u00fcs\u00fc \u2014 ADC/DAC (8-bit), Komparatör, PWM Generator, analog\u2194dijital senkronizasyon</p>';
  html += '<p>\u2022 \uD83D\uDCC8 Performans Stres Testi \u2014 500 bile\u015fen benchmark, FPS/simStep/memory \u00f6l\u00e7\u00fcm\u00fc</p>';
  html += '<h3 style="color:var(--accent);font-size:14px;margin:16px 0 8px">v7.1 \u2014 Accuracy & Quality</h3>';
  html += '<p>\u2022 Banded sparse \u00e7\u00f6z\u00fcc\u00fc (Cuthill-McKee, O(n\u00d7bw\u00b2))</p>';
  html += '<p>\u2022 SPICE3f5 junction voltage limiting</p>';
  html += '<p>\u2022 Trapezoidal integration (BE/TRAP otomatik)</p>';
  html += '<p>\u2022 Kademeli GMIN stepping (1e-2 \u2192 1e-12)</p>';
  html += '<p>\u2022 Noise analizi yeniden yaz\u0131ld\u0131 (per-source transfer)</p>';
  html += '<p>\u2022 Op-Amp 2 kutuplu model + slew rate + sat\u00fcrasyon</p>';
  html += '<p>\u2022 10 referans devre cross-validation (hepsi PASS)</p>';
  html += '<p>\u2022 Enerji tabanl\u0131 hasar modeli</p>';
  html += '<p>\u2022 Worst-case RSS y\u00f6ntemi</p>';
  html += '<p>\u2022 30 bile\u015fen ansiklopedisi</p>';
  html += '<p>\u2022 Quick Start \u015fablonlar\u0131</p>';
  html += '<p>\u2022 i18n tam \u00e7eviri (81 key)</p>';
  html += '<p>\u2022 76 mod\u00fcler kaynak dosya + build sistemi</p>';
  html += '<p>\u2022 Mobil responsive CSS</p>';
  html += '<h3 style="color:var(--accent);font-size:14px;margin:16px 0 8px">v7.0 \u2014 Phase 2</h3>';
  html += '<p>\u2022 Sparse MNA + Newton-Raphson (30 iter, damping)</p>';
  html += '<p>\u2022 50+ SPICE model, Gummel-Poon BJT, MOSFET Level 1</p>';
  html += '<p>\u2022 AC analiz, Noise, Sensitivity, Monte Carlo</p>';
  html += '<p>\u2022 Net label, Subcircuit, SPICE import/export</p>';
  html += '<p>\u2022 PWA + Eri\u015filebilirlik (WCAG 2.1 AA)</p>';
  html += '<h3 style="color:var(--green);font-size:14px;margin:16px 0 8px">v6.0 \u2014 Phase 1</h3>';
  html += '<p>\u2022 5 arka plan, 4 kablo stili, IEC/ANSI sembol</p>';
  html += '<p>\u2022 Termal sim\u00fclasyon + hasar + partik\u00fcl efektleri</p>';
  html += '<p>\u2022 CRT phosphor osiloskop + 7 ses efekti</p>';
  html += '<p>\u2022 5 interaktif ders + ansiklopedi</p>';
  html += '</div>';
  var modal = document.getElementById('about-modal');
  if (modal) { document.getElementById('about-box').innerHTML = html + '<div style="margin-top:12px;text-align:center"><button style="padding:6px 16px;border-radius:6px;background:var(--surface-3);color:var(--text);border:1px solid var(--border);cursor:pointer;font:12px var(--font-ui)" onclick="document.getElementById(\'about-modal\').classList.remove(\'show\')">' + (currentLang==='tr'?'Kapat':'Close') + '</button></div>'; modal.classList.add('show'); }
}

// 10.5: PERFORMANCE BENCHMARK