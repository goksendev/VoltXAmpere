// ──────── TIMELINE BAR UI (Sprint 11) ────────
(function() {
  'use strict';

  var isDragging = false;
  var autoPlayTimer = null;
  var autoPlaySpeed = 1;

  function formatSimTime(sec) {
    if (sec === 0) return '0s';
    if (Math.abs(sec) < 0.001) return (sec * 1e6).toFixed(0) + '\u00B5s';
    if (Math.abs(sec) < 1) return (sec * 1000).toFixed(1) + 'ms';
    var mins = Math.floor(sec / 60);
    var secs = (sec % 60).toFixed(3);
    return (mins < 10 ? '0' : '') + mins + ':' + (parseFloat(secs) < 10 ? '0' : '') + secs;
  }

  function updateTimeDisplay(simTimeSec) {
    var cur = document.getElementById('tl-current');
    var tot = document.getElementById('tl-total');
    if (!cur || !tot) return;
    cur.textContent = formatSimTime(simTimeSec);
    var stats = VXA.TimeMachine.getStats();
    tot.textContent = formatSimTime(stats.newestTime);
  }

  function drawTimelineCanvas() {
    var canvas = document.getElementById('tl-canvas');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var w = canvas.width = canvas.offsetWidth;
    var h = canvas.height = 32;
    ctx.clearRect(0, 0, w, h);

    var tm = VXA.TimeMachine;
    var cnt = tm.getCount();
    if (cnt === 0) return;

    // Mini voltage envelope (scope ch0 data)
    ctx.strokeStyle = 'rgba(0, 224, 158, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    var step = Math.max(1, Math.floor(cnt / w));
    for (var i = 0; i < cnt; i += step) {
      var snap = tm.getSnapshot(i);
      if (!snap || !snap.sc || !snap.sc[0] || snap.sc[0].length === 0) continue;
      var x = (i / cnt) * w;
      var lastVal = snap.sc[0][snap.sc[0].length - 1];
      var y = h / 2 - (lastVal || 0) * (h / 4) / 5;
      y = Math.max(2, Math.min(h - 2, y));
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Markers
    var mkrs = tm.getMarkers();
    for (var m = 0; m < mkrs.length; m++) {
      var mx = (mkrs[m].index / cnt) * w;
      ctx.fillStyle = mkrs[m].type === 'spike' ? '#ff4444' : '#ff8800';
      ctx.beginPath();
      ctx.moveTo(mx - 3, 0);
      ctx.lineTo(mx + 3, 0);
      ctx.lineTo(mx, 6);
      ctx.fill();
    }

    // Bookmarks
    var bmarks = tm.getBookmarks();
    for (var b = 0; b < bmarks.length; b++) {
      var bx = (bmarks[b].index / cnt) * w;
      ctx.fillStyle = '#4a9eff';
      ctx.font = '10px sans-serif';
      ctx.fillText('\u2691', bx - 4, 28);
    }

    // Playhead
    if (tm.isPlayback()) {
      var ph = document.getElementById('tl-playhead');
      if (ph) {
        ph.style.left = ((tm.getPlaybackIndex() / cnt) * w) + 'px';
      }
    }
  }

  function scrubTo(e) {
    var scrubber = document.getElementById('tl-scrubber');
    if (!scrubber) return;
    var rect = scrubber.getBoundingClientRect();
    var ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    var index = Math.round(ratio * (VXA.TimeMachine.getCount() - 1));
    var snap = VXA.TimeMachine.seekTo(index);
    if (snap) {
      drawTimelineCanvas();
      updateTimeDisplay(snap.t);
      needsRender = true;
    }
  }

  function showTimeline() {
    var bar = document.getElementById('timeline-bar');
    if (bar) {
      bar.style.display = 'flex';
      drawTimelineCanvas();
    }
  }

  function hideTimeline() {
    var bar = document.getElementById('timeline-bar');
    if (bar) bar.style.display = 'none';
    if (autoPlayTimer) { clearInterval(autoPlayTimer); autoPlayTimer = null; }
  }

  function enterPlayback() {
    var tm = VXA.TimeMachine;
    if (tm.getCount() === 0) return;
    if (S.sim.running) toggleSim();
    tm.seekTo(tm.getCount() - 1);
    showTimeline();
    var snap = tm.getCurrentSnapshot();
    if (snap) updateTimeDisplay(snap.t);
    needsRender = true;
  }

  function exitPlayback() {
    VXA.TimeMachine.resume();
    hideTimeline();
    needsRender = true;
  }

  // Auto-play (forward playback at speed)
  function startAutoPlay() {
    if (autoPlayTimer) return;
    autoPlayTimer = setInterval(function() {
      var snap = VXA.TimeMachine.stepForward();
      if (snap) {
        drawTimelineCanvas();
        updateTimeDisplay(snap.t);
        needsRender = true;
      } else {
        clearInterval(autoPlayTimer);
        autoPlayTimer = null;
      }
    }, 16);
  }

  function stopAutoPlay() {
    if (autoPlayTimer) { clearInterval(autoPlayTimer); autoPlayTimer = null; }
  }

  // Init event listeners after DOM ready
  function initTimelineEvents() {
    var scrubber = document.getElementById('tl-scrubber');
    if (scrubber) {
      scrubber.addEventListener('mousedown', function(e) {
        isDragging = true;
        stopAutoPlay();
        scrubTo(e);
      });
      scrubber.addEventListener('touchstart', function(e) {
        isDragging = true;
        stopAutoPlay();
        if (e.touches.length) scrubTo(e.touches[0]);
      }, { passive: true });
    }

    document.addEventListener('mousemove', function(e) {
      if (isDragging) scrubTo(e);
    });
    document.addEventListener('mouseup', function() { isDragging = false; });
    document.addEventListener('touchmove', function(e) {
      if (isDragging && e.touches.length) scrubTo(e.touches[0]);
    }, { passive: true });
    document.addEventListener('touchend', function() { isDragging = false; });

    // Button handlers
    var btnMap = {
      'tl-step-back': function() {
        stopAutoPlay();
        var snap = VXA.TimeMachine.stepBackward();
        if (snap) { drawTimelineCanvas(); updateTimeDisplay(snap.t); needsRender = true; }
      },
      'tl-back': function() {
        stopAutoPlay();
        for (var i = 0; i < 10; i++) VXA.TimeMachine.stepBackward();
        var snap = VXA.TimeMachine.getCurrentSnapshot();
        if (snap) { drawTimelineCanvas(); updateTimeDisplay(snap.t); needsRender = true; }
      },
      'tl-play-pause': function() {
        if (autoPlayTimer) { stopAutoPlay(); }
        else { startAutoPlay(); }
      },
      'tl-forward': function() {
        stopAutoPlay();
        for (var i = 0; i < 10; i++) VXA.TimeMachine.stepForward();
        var snap = VXA.TimeMachine.getCurrentSnapshot();
        if (snap) { drawTimelineCanvas(); updateTimeDisplay(snap.t); needsRender = true; }
      },
      'tl-step-fwd': function() {
        stopAutoPlay();
        var snap = VXA.TimeMachine.stepForward();
        if (snap) { drawTimelineCanvas(); updateTimeDisplay(snap.t); needsRender = true; }
      },
      'tl-bookmark': function() {
        var label = prompt(t('bookmarkName') || 'Bookmark name:');
        if (label) VXA.TimeMachine.addBookmark(label);
        drawTimelineCanvas();
      },
      'tl-exit': function() { exitPlayback(); }
    };

    Object.keys(btnMap).forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('click', btnMap[id]);
    });
  }

  // Keyboard shortcuts for TimeMachine
  document.addEventListener('keydown', function(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (!VXA.TimeMachine || !VXA.TimeMachine.isEnabled()) return;

    // Comma — step back (enter playback if not already)
    if (e.key === ',') {
      e.preventDefault();
      if (!VXA.TimeMachine.isPlayback()) enterPlayback();
      else {
        var snap = VXA.TimeMachine.stepBackward();
        if (snap) { drawTimelineCanvas(); updateTimeDisplay(snap.t); needsRender = true; }
      }
      return;
    }
    // Period — step forward
    if (e.key === '.') {
      e.preventDefault();
      if (VXA.TimeMachine.isPlayback()) {
        var snap2 = VXA.TimeMachine.stepForward();
        if (snap2) { drawTimelineCanvas(); updateTimeDisplay(snap2.t); needsRender = true; }
      }
      return;
    }
    // M — toggle TimeMachine playback (enter/exit)
    if (e.key === 'm' && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
      if (VXA.TimeMachine.isPlayback()) exitPlayback();
      else enterPlayback();
      return;
    }
    // Escape during playback — exit
    if (e.key === 'Escape' && VXA.TimeMachine.isPlayback()) {
      e.preventDefault();
      e.stopPropagation();
      exitPlayback();
      return;
    }
  }, true); // capture phase to get Escape before other handlers

  // Expose for external use
  window._tlDrawCanvas = drawTimelineCanvas;
  window._tlUpdateTime = updateTimeDisplay;
  window._tlEnterPlayback = enterPlayback;
  window._tlExitPlayback = exitPlayback;
  window._tlInitEvents = initTimelineEvents;
  window._tlShowTimeline = showTimeline;
  window._tlHideTimeline = hideTimeline;

  // Init when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTimelineEvents);
  } else {
    setTimeout(initTimelineEvents, 100);
  }
})();
