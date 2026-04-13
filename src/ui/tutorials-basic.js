// ──────── TUTORIAL ────────
var TUT_STEPS = [
  { title: function(){return t('tutTitle');}, text: function(){return t('tutDesc');} },
  { title: function(){return t('tutStep2');}, text: function(){return '';} },
  { title: function(){return t('tutStep3');}, text: function(){return '';} },
  { title: function(){return t('tutStep4');}, text: function(){return '';} },
  { title: function(){return t('tutStep5');}, text: function(){return '';} },
];
let tutStep = 0;

function startTutorial() {
  tutStep = 0;
  document.getElementById('tutorial-overlay').style.display = 'block';
  showTutStep();
}

function showTutStep() {
  var s = TUT_STEPS[tutStep];
  document.getElementById('tut-title').textContent = typeof s.title === 'function' ? s.title() : s.title;
  document.getElementById('tut-text').textContent = typeof s.text === 'function' ? s.text() : s.text;
  // Update tutorial button labels
  var skipBtn = document.querySelector('.tut-btn-skip');
  var nextBtn = document.querySelector('.tut-btn-next');
  if (skipBtn) skipBtn.textContent = t('tutSkip');
  if (nextBtn) nextBtn.textContent = t('tutNext');
  const dots = document.getElementById('tut-dots');
  dots.innerHTML = TUT_STEPS.map((_, i) => `<div class="step-dot${i === tutStep ? ' active' : ''}"></div>`).join('');
}

function nextTutStep() {
  tutStep++;
  if (tutStep >= TUT_STEPS.length) { endTutorial(); return; }
  showTutStep();
}

function endTutorial() {
  document.getElementById('tutorial-overlay').style.display = 'none';
  localStorage.setItem('vxa_tutorial_done', '1');
}
