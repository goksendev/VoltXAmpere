// ──────── 5.6: WELCOME EXPERIENCE (Sprint 34) ────────
function showWelcome() {
  if (localStorage.getItem('vxa_visited')) return;
  localStorage.setItem('vxa_visited', 'true');
  var tr = currentLang === 'tr';
  var box = document.getElementById('welcome-box');
  box.innerHTML =
    '<div style="font:800 32px var(--font-ui);margin-bottom:4px">'
    + '<span style="color:var(--accent)">\u26A1 Volt</span>'
    + '<span style="color:var(--orange)">X</span>'
    + '<span style="color:var(--blue)">Ampere</span></div>'
    + '<div style="font:13px var(--font-ui);color:var(--text-2);margin-bottom:6px">'
    + (tr ? 'D\u00fcnyan\u0131n En Geli\u015fmi\u015f \u00dccretsiz Devre Sim\u00fclat\u00f6r\u00fc'
          : "World's Most Advanced Free Circuit Simulator") + '</div>'
    + '<div style="font:11px var(--font-mono);color:var(--text-3);margin-bottom:20px">'
    + '71 ' + (tr?'bile\u015fen':'components') + ' \u00B7 55 '
    + (tr?'haz\u0131r devre':'presets') + ' \u00B7 16 '
    + (tr?'analiz arac\u0131':'analysis tools') + '</div>'
    + '<div style="display:flex;flex-direction:column;gap:8px;align-items:center">'
    // Live Demo (primary)
    + '<button id="welcome-btn-demo" style="padding:10px 28px;border-radius:8px;background:var(--accent);'
    + 'color:var(--bg);border:none;font:700 14px var(--font-ui);cursor:pointer;'
    + 'width:240px;transition:transform 0.15s" '
    + 'onmouseover="this.style.transform=\'scale(1.03)\'" '
    + 'onmouseout="this.style.transform=\'scale(1)\'" '
    + 'onclick="closeWelcome();runQuickDemo()">'
    + '\u26A1 ' + (tr ? 'Canl\u0131 Demo' : 'Live Demo') + '</button>'
    // Tutorial
    + '<button id="welcome-btn-tutorial" style="padding:8px 24px;border-radius:8px;background:var(--surface-3);'
    + 'color:var(--text);border:1px solid var(--border);font:600 12px var(--font-ui);'
    + 'cursor:pointer;width:240px" '
    + 'onclick="closeWelcome();startTutorial(\'ohm\')">'
    + '\uD83C\uDF93 ' + (tr ? '\u0130lk Dersi Ba\u015flat' : 'Start First Lesson') + '</button>'
    // Empty
    + '<button id="welcome-btn-empty" style="padding:8px 24px;border-radius:8px;background:transparent;'
    + 'color:var(--text-3);border:1px solid var(--border-2);font:12px var(--font-ui);'
    + 'cursor:pointer;width:240px" '
    + 'onclick="closeWelcome()">'
    + '\uD83D\uDD27 ' + (tr ? 'Bo\u015f Devre ile Ba\u015fla' : 'Start with Empty Circuit') + '</button>'
    + '</div>';
  document.getElementById('welcome-dialog').classList.add('show');
}

function closeWelcome() {
  var dlg = document.getElementById('welcome-dialog');
  if (dlg) dlg.classList.remove('show');
}

// ═══════════════════════════════════════════════
// QUICK DEMO — Sprint 34
// Loads the LED preset (safe pin coords) + runs sim + info card
// ═══════════════════════════════════════════════
function runQuickDemo() {
  // Use existing 'led' preset for safe pin alignment
  if (typeof loadPreset === 'function') loadPreset('led');
  // Ensure LED has model assigned
  setTimeout(function() {
    var led = S.parts.find(function(p){ return p.type === 'led'; });
    if (led && !led.model) {
      led.model = 'RED_5MM';
      if (typeof applyModel === 'function') applyModel(led, 'RED_5MM');
    }
    needsRender = true;
  }, 100);
  // Start simulation after brief delay (let preset settle visually)
  setTimeout(function() {
    if (!S.sim.running && typeof toggleSim === 'function') toggleSim();
  }, 800);
  // Show info card
  setTimeout(function() {
    var tr = currentLang === 'tr';
    if (typeof showInfoCard === 'function') {
      showInfoCard(
        tr ? '\u2705 LED yan\u0131yor! Vf \u2248 1.78V \u2014 kalibre edilmi\u015f model.'
           : '\u2705 LED is on! Vf \u2248 1.78V \u2014 calibrated SPICE model.',
        tr ? 'Direnci de\u011fi\u015ftirmeyi deneyin (\u00e7ift t\u0131klama veya E tu\u015fu)'
           : 'Try changing the resistor (double-click or press E)',
        ''
      );
    }
  }, 2000);
}
