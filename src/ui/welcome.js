// ──────── 5.6: WELCOME EXPERIENCE ────────
function showWelcome() {
  if (localStorage.getItem('vxa_visited')) return;
  localStorage.setItem('vxa_visited', 'true');
  var box = document.getElementById('welcome-box');
  box.innerHTML = '<div style="font:800 28px var(--font-ui);margin-bottom:8px"><span style="color:var(--accent)">Volt</span><span style="color:var(--orange)">X</span><span style="color:var(--blue)">Ampere</span></div>'
    + '<div style="font:13px var(--font-ui);color:var(--text-2);margin-bottom:20px">' + (currentLang==='tr'?'Hoş geldiniz! Hızlı tur yapmak ister misiniz?':'Welcome! Would you like a quick tour?') + '</div>'
    + '<div style="display:flex;gap:10px;justify-content:center">'
    + '<button style="padding:8px 20px;border-radius:8px;background:var(--accent);color:var(--bg);border:none;font:600 13px var(--font-ui);cursor:pointer" onclick="document.getElementById(\'welcome-dialog\').classList.remove(\'show\');startTutorial(\'ohm\')">' + (currentLang==='tr'?'🎓 Hızlı Tur':'🎓 Quick Tour') + '</button>'
    + '<button style="padding:8px 20px;border-radius:8px;background:var(--surface-3);color:var(--text);border:1px solid var(--border);font:12px var(--font-ui);cursor:pointer" onclick="document.getElementById(\'welcome-dialog\').classList.remove(\'show\')">' + (currentLang==='tr'?'Atla':'Skip') + '</button></div>';
  document.getElementById('welcome-dialog').classList.add('show');
}
