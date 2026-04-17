// ──────── INTERACTIVE TUTORIAL (Sprint 80) ────────
// Replaces the pre-Sprint-80 non-interactive 5-step card with an 8-step
// guided walkthrough. Reuses the existing #tutorial-overlay / #tut-card
// shell from src/index.html; steps advance either by the user clicking
// "next" or by a polling watcher detecting that the step's target event
// happened (part placed, wire drawn, sim started, etc). Esc always
// skips. Finish sets localStorage.vxa_tutorial_completed (and the legacy
// vxa_tutorial_done so the old auto-start guard keeps working).
//
// Real VoltXAmpere keybindings differ from the sprint spec draft
// (numbers 1/2/4/8 place parts; W toggles wire mode; Shift+P toggles
// the probe). The tutorial text reflects the ACTUAL keys — we aren't
// going to lie to the user about their keyboard.

(function () {
  var MODE = (typeof t === 'function') ? null : null; // lazy

  var STEPS = [
    // 0 — welcome
    {
      id: 'welcome',
      title: function () { return t('tutStep_welcome_title'); },
      text:  function () { return t('tutStep_welcome_body'); },
      advance: 'button', // user clicks "İleri"
      showNextButton: true
    },
    // 1 — place a resistor
    {
      id: 'placeResistor',
      title: function () { return t('tutStep_r_title'); },
      text:  function () { return t('tutStep_r_body'); },
      check: function (snap) { return snap.countByType.resistor >= 1; },
      showNextButton: false
    },
    // 2 — wire mode
    {
      id: 'wire',
      title: function () { return t('tutStep_wire_title'); },
      text:  function () { return t('tutStep_wire_body'); },
      check: function (snap) { return snap.wireCount >= 1; },
      showNextButton: false
    },
    // 3 — add voltage source
    {
      id: 'source',
      title: function () { return t('tutStep_v_title'); },
      text:  function () { return t('tutStep_v_body'); },
      check: function (snap) {
        return (snap.countByType.vdc || 0) + (snap.countByType.vac || 0) >= 1;
      },
      showNextButton: false
    },
    // 4 — add ground
    {
      id: 'ground',
      title: function () { return t('tutStep_gnd_title'); },
      text:  function () { return t('tutStep_gnd_body'); },
      check: function (snap) { return (snap.countByType.ground || 0) >= 1; },
      showNextButton: false
    },
    // 5 — start simulation
    {
      id: 'simulate',
      title: function () { return t('tutStep_sim_title'); },
      text:  function () { return t('tutStep_sim_body'); },
      check: function (snap) { return snap.simRunning; },
      showNextButton: false
    },
    // 6 — probe
    {
      id: 'probe',
      title: function () { return t('tutStep_probe_title'); },
      text:  function () { return t('tutStep_probe_body'); },
      check: function (snap) { return snap.probeActive; },
      showNextButton: false
    },
    // 7 — complete
    {
      id: 'done',
      title: function () { return t('tutStep_done_title'); },
      text:  function () { return t('tutStep_done_body'); },
      advance: 'button',
      showNextButton: true,
      isLast: true
    }
  ];

  var _step        = 0;
  var _pollTimer   = null;
  var _escHandler  = null;
  var _origCounts  = { parts: 0, wires: 0 };
  var _startTime   = 0;

  function snapshot() {
    var byType = {};
    if (typeof S !== 'undefined' && S.parts) {
      for (var i = 0; i < S.parts.length; i++) {
        var type = S.parts[i].type;
        byType[type] = (byType[type] || 0) + 1;
      }
    }
    return {
      countByType: byType,
      partCount:   (typeof S !== 'undefined' && S.parts) ? S.parts.length : 0,
      wireCount:   (typeof S !== 'undefined' && S.wires) ? S.wires.length : 0,
      simRunning:  !!(typeof S !== 'undefined' && S.sim && S.sim.running),
      probeActive: !!(typeof VXA !== 'undefined' && VXA.Probes && VXA.Probes.isActive())
    };
  }

  function render() {
    var s = STEPS[_step];
    var titleEl = document.getElementById('tut-title');
    var textEl  = document.getElementById('tut-text');
    var dotsEl  = document.getElementById('tut-dots');
    var nextBtn = document.querySelector('.tut-btn-next');
    var skipBtn = document.querySelector('.tut-btn-skip');

    if (titleEl) titleEl.textContent = typeof s.title === 'function' ? s.title() : s.title;
    if (textEl)  textEl.textContent  = typeof s.text  === 'function' ? s.text()  : s.text;

    if (dotsEl) {
      var html = '';
      for (var i = 0; i < STEPS.length; i++) {
        html += '<div class="step-dot' + (i === _step ? ' active' : (i < _step ? ' done' : '')) + '"></div>';
      }
      dotsEl.innerHTML = html;
    }

    if (nextBtn) {
      if (s.showNextButton) {
        nextBtn.style.display = '';
        nextBtn.textContent = s.isLast
          ? (typeof t === 'function' ? t('tutClose') : 'Kapat')
          : (typeof t === 'function' ? t('tutNext')  : 'İleri');
      } else {
        nextBtn.style.display = 'none';
      }
    }
    if (skipBtn) {
      skipBtn.textContent = typeof t === 'function' ? t('tutSkip') : 'Atla';
    }
  }

  function poll() {
    if (_step >= STEPS.length) return;
    var s = STEPS[_step];
    if (s.advance === 'button' || typeof s.check !== 'function') return;
    try {
      if (s.check(snapshot())) {
        _step++;
        if (_step >= STEPS.length) { endTutorial(); return; }
        render();
      }
    } catch (e) { /* tutorial check failures must never crash the app */ }
  }

  function installEsc() {
    _escHandler = function (ev) {
      if (ev.key === 'Escape') {
        ev.stopPropagation();
        endTutorial();
      }
    };
    document.addEventListener('keydown', _escHandler, true);
  }

  function removeEsc() {
    if (_escHandler) {
      document.removeEventListener('keydown', _escHandler, true);
      _escHandler = null;
    }
  }

  // Expose on window so inline onclick handlers and other modules find it.
  window.startTutorial = function () {
    var ov = document.getElementById('tutorial-overlay');
    if (!ov) return;
    _step = 0;
    _startTime = Date.now();
    _origCounts.parts = (typeof S !== 'undefined' && S.parts) ? S.parts.length : 0;
    _origCounts.wires = (typeof S !== 'undefined' && S.wires) ? S.wires.length : 0;
    ov.style.display = 'block';
    render();
    installEsc();
    if (_pollTimer) clearInterval(_pollTimer);
    _pollTimer = setInterval(poll, 250);
  };

  window.nextTutStep = function () {
    var s = STEPS[_step];
    if (!s.showNextButton) return; // event-gated steps can't be skipped via "Next"
    if (s.isLast) { endTutorial(); return; }
    _step++;
    if (_step >= STEPS.length) { endTutorial(); return; }
    render();
  };

  window.endTutorial = function () {
    var ov = document.getElementById('tutorial-overlay');
    if (ov) ov.style.display = 'none';
    if (_pollTimer) { clearInterval(_pollTimer); _pollTimer = null; }
    removeEsc();
    try {
      localStorage.setItem('vxa_tutorial_completed', '1');
      // Legacy flag for existing startup.js guard
      localStorage.setItem('vxa_tutorial_done', '1');
    } catch (e) {}
  };

  // Expose a namespaced view for programmatic access (tests / menu hooks).
  if (typeof VXA !== 'undefined') {
    VXA.Tutorial = {
      start:    window.startTutorial,
      next:     window.nextTutStep,
      end:      window.endTutorial,
      skip:     window.endTutorial,
      currentStep: function () { return _step; },
      totalSteps:  function () { return STEPS.length; },
      isActive:    function () {
        var ov = document.getElementById('tutorial-overlay');
        return !!(ov && ov.style.display === 'block');
      },
      STEPS: STEPS // read-only from the outside; used by tests only
    };
  }

  // Global F1 key — restart tutorial from anywhere. Safe to call when
  // a tutorial is already running (it simply resets to step 0).
  document.addEventListener('keydown', function (ev) {
    if (ev.key !== 'F1') return;
    var tgt = ev.target;
    if (tgt && (tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA' || tgt.isContentEditable)) return;
    ev.preventDefault();
    if (window.startTutorial) window.startTutorial();
  });
})();
