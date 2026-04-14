// ──────── 5.9: ABOUT DIALOG ────────
function showAbout() {
  var box = document.getElementById('about-box');
  var tr = currentLang === 'tr';
  box.innerHTML = '<div style="font:800 24px var(--font-ui);margin-bottom:4px"><span style="color:var(--accent)">\u26A1 Volt</span><span style="color:var(--orange)">X</span><span style="color:var(--blue)">Ampere</span> <span style="font:500 14px var(--font-mono);color:var(--text-3)">v8.0</span></div>'
    + '<div style="font:13px var(--font-ui);color:var(--text-2);margin-bottom:16px">' + (tr?'D\u00fcnyan\u0131n En Geli\u015fmi\u015f \u00dccretsiz Devre Sim\u00fclat\u00f6r\u00fc':'World\'s Most Advanced Free Circuit Simulator') + '</div>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;text-align:left;font-size:11px;color:var(--text-2);margin-bottom:12px">'
    + '<div>\u2705 64+ ' + (tr?'Bile\u015fen':'Components') + '</div>'
    + '<div>\u2705 50+ SPICE ' + (tr?'Model':'Models') + '</div>'
    + '<div>\u2705 Gummel-Poon BJT</div>'
    + '<div>\u2705 MOSFET Level 1</div>'
    + '<div>\u2705 Banded Sparse ' + (tr?'\u00c7\u00f6z\u00fcc\u00fc':'Solver') + '</div>'
    + '<div>\u2705 SPICE3f5 V-Limiting</div>'
    + '<div>\u2705 Trapezoidal ' + (tr?'Entegrasyon':'Integration') + '</div>'
    + '<div>\u2705 GMIN Stepping</div>'
    + '<div>\u2705 Newton-Raphson (30 iter)</div>'
    + '<div>\u2705 ' + (tr?'Adaptif Zaman Ad\u0131m\u0131':'Adaptive Timestep') + '</div>'
    + '<div>\u2705 ' + (tr?'Termal Sim\u00fclasyon':'Thermal Simulation') + '</div>'
    + '<div>\u2705 ' + (tr?'Enerji Tabanl\u0131 Hasar':'Energy-Based Damage') + '</div>'
    + '<div>\u2705 CRT ' + (tr?'Osiloskop':'Oscilloscope') + '</div>'
    + '<div>\u2705 7 ' + (tr?'Ses Efekti':'Sound Effects') + '</div>'
    + '<div>\u2705 AC Small-Signal</div>'
    + '<div>\u2705 Noise (per-source)</div>'
    + '<div>\u2705 Monte Carlo + RSS</div>'
    + '<div>\u2705 Sensitivity / Worst-Case</div>'
    + '<div>\u2705 10/10 ' + (tr?'Do\u011frulama':'Validation') + '</div>'
    + '<div>\u2705 Net Label ' + (tr?'Sistemi':'System') + '</div>'
    + '<div>\u2705 Subcircuit / ' + (tr?'Bloklar':'Blocks') + '</div>'
    + '<div>\u2705 SPICE Import/Export</div>'
    + '<div>\u2705 30 ' + (tr?'Ansiklopedi':'Encyclopedia') + '</div>'
    + '<div>\u2705 5 ' + (tr?'\u0130nteraktif Ders':'Tutorials') + '</div>'
    + '<div>\u2705 35 ' + (tr?'Haz\u0131r Devre':'Preset Circuits') + '</div>'
    + '<div>\u2705 Quick Start ' + (tr?'\u015eablonlar\u0131':'Templates') + '</div>'
    + '<div>\u2705 ' + (tr?'T\u00fcrk\u00e7e + \u0130ngilizce':'Turkish + English') + '</div>'
    + '<div>\u2705 ' + (tr?'S\u0131f\u0131r Ba\u011f\u0131ml\u0131l\u0131k':'Zero Dependencies') + '</div>'
    + '<div>\u2705 76 ' + (tr?'Mod\u00fcler Kaynak':'Modular Sources') + '</div>'
    + '<div>\u2705 PWA Offline</div>'
    + '<div>\u2705 \u23EA ' + (tr?'Zaman Makinesi':'Time Machine') + '</div>'
    + '<div>\u2705 \uD83D\uDD0A ' + (tr?'Mekansal Ses':'Spatial Audio') + '</div>'
    + '<div>\u2705 \u3030\uFE0F ' + (tr?'Kablo Titreşimi':'Wire Vibration') + '</div>'
    + '<div>\u2705 \u26A1 ' + (tr?'Kaos Modu':'Chaos Mode') + '</div>'
    + '<div>\u2705 \uD83D\uDCCF ' + (tr?'Holografik Form\u00fcller':'Holographic Formulas') + '</div>'
    + '<div>\u2705 \uD83D\uDD0C ' + (tr?'3D Prob UX':'3D Probe UX') + '</div>'
    + '<div>\u2705 \uD83E\uDD16 ' + (tr?'AI Devre Asistan\u0131 (Tool Use)':'AI Circuit Assistant (Tool Use)') + '</div>'
    + '<div>\u2705 \uD83D\uDD0D ' + (tr?'AI Hata Tespiti + Auto-Fix':'AI Error Detection + Auto-Fix') + '</div>'
    + '<div>\u2705 \uD83D\uDD32 ' + (tr?'Dijital Sim\u00fclasyon Motoru':'Digital Simulation Engine') + '</div>'
    + '<div>\u2705 \u26A1 ' + (tr?'Mixed-Signal K\u00f6pr\u00fcs\u00fc':'Mixed-Signal Bridge') + '</div>'
    + '</div>'
    + '<div style="font:11px var(--font-mono);color:var(--text-4);margin-top:8px">\u00a9 2026 \u2014 ' + (tr?'A\u00e7\u0131k Kaynak':'Open Source') + ' \u2014 voltxampere.com</div>'
    + '<div style="margin-top:12px;display:flex;gap:8px;justify-content:center">'
    + '<button style="padding:6px 16px;border-radius:6px;background:var(--accent);color:var(--bg);border:none;cursor:pointer;font:600 12px var(--font-ui)" onclick="showValidation()">\uD83D\uDD2C ' + (tr?'Do\u011frulama':'Validation') + '</button>'
    + '<button style="padding:6px 16px;border-radius:6px;background:var(--surface-3);color:var(--text);border:1px solid var(--border);cursor:pointer;font:12px var(--font-ui)" onclick="showChangelog()">' + (tr?'De\u011fi\u015fiklik Ge\u00e7mi\u015fi':'Changelog') + '</button>'
    + '<button style="padding:6px 16px;border-radius:6px;background:var(--surface-3);color:var(--text);border:1px solid var(--border);cursor:pointer;font:12px var(--font-ui)" onclick="document.getElementById(\'about-modal\').classList.remove(\'show\')">' + (tr?'Kapat':'Close') + '</button>'
    + '</div>';
  document.getElementById('about-modal').classList.add('show');
}

function showValidation() {
  var data = VXA.Validation.runAll();
  var txt = VXA.Validation.report(data);
  alert(data.passed + '/' + data.total + (currentLang==='tr' ? ' do\u011frulama testi ge\u00e7ti.' : ' validation tests passed.') + '\n\n' + (currentLang==='tr' ? 'Detaylar i\u00e7in konsolu kontrol edin.' : 'See console for details.'));
}

// ──────── 5.6: WELCOME — trigger after splash ────────
setTimeout(function() { showWelcome(); }, 2200);
