// ──────── TIME MACHINE (Sprint 11) ────────
VXA.TimeMachine = (function() {
  'use strict';

  var MAX_SNAPSHOTS = 2000;
  var BASE_INTERVAL_MS = 10;
  var SPIKE_THRESHOLD = 0.5;
  var SPIKE_INTERVAL_MS = 0.5;

  var snapshots = [];
  var head = 0;
  var count = 0;
  var _isPlayback = false;
  var playbackIndex = -1;
  var bookmarks = [];
  var markers = [];
  var lastCaptureTime = -999;
  var lastNodeVoltages = null;
  var enabled = false;

  function createSnapshot(simTime, nodes, components, thermalData, damageData, scopeTraces) {
    return {
      t: simTime,
      n: nodes ? new Float64Array(nodes) : new Float64Array(0),
      c: components.map(function(p) {
        return {
          id: p.id,
          v: p._v !== undefined ? p._v : (p.voltage !== undefined ? p.voltage : 0),
          i: p._i !== undefined ? p._i : (p.current !== undefined ? p.current : 0),
          on: p.on !== undefined ? p.on : true,
          damaged: p.damaged || false,
          ledBrightness: p.ledBrightness || 0
        };
      }),
      th: thermalData ? thermalData.map(function(t) {
        return { id: t.id, temp: t.temp, status: t.status };
      }) : [],
      dm: damageData ? damageData.slice() : [],
      sc: scopeTraces ? scopeTraces.map(function(ch) {
        if (!ch || !ch.buf) return [];
        var arr = [];
        for (var k = 0; k < Math.min(ch.buf.length, 100); k++) arr.push(ch.buf[k]);
        return arr;
      }) : []
    };
  }

  function detectSpike(nodes) {
    if (!lastNodeVoltages || !nodes) return false;
    var len = Math.min(nodes.length, lastNodeVoltages.length);
    for (var i = 0; i < len; i++) {
      if (Math.abs(nodes[i] - lastNodeVoltages[i]) > SPIKE_THRESHOLD) return true;
    }
    return false;
  }

  return {
    setEnabled: function(val) {
      enabled = !!val;
      if (!enabled) this.reset();
    },
    isEnabled: function() { return enabled; },

    capture: function(simTime, nodeVoltages, components, thermalStates, damageStates, scopeTraces) {
      if (!enabled || _isPlayback) return;
      var simTimeMs = simTime * 1000;
      var isSpike = detectSpike(nodeVoltages);
      var interval = isSpike ? SPIKE_INTERVAL_MS : BASE_INTERVAL_MS;
      if (simTimeMs - lastCaptureTime < interval) return;

      var snap = createSnapshot(simTime, nodeVoltages, components, thermalStates, damageStates, scopeTraces);

      if (count < MAX_SNAPSHOTS) {
        snapshots.push(snap);
        count++;
      } else {
        snapshots[head] = snap;
      }

      if (isSpike) {
        markers.push({ index: count < MAX_SNAPSHOTS ? count - 1 : head, type: 'spike', time: simTime });
      }
      if (damageStates && damageStates.length > 0) {
        var newDamage = damageStates.some(function(d) { return d.justDamaged; });
        if (newDamage) {
          markers.push({ index: count < MAX_SNAPSHOTS ? count - 1 : head, type: 'damage', time: simTime });
        }
      }

      head = (head + 1) % MAX_SNAPSHOTS;
      lastCaptureTime = simTimeMs;
      lastNodeVoltages = nodeVoltages ? new Float64Array(nodeVoltages) : null;
    },

    isPlayback: function() { return _isPlayback; },

    seekTo: function(index) {
      if (count === 0) return null;
      var idx = Math.max(0, Math.min(index, count - 1));
      _isPlayback = true;
      playbackIndex = idx;
      return this.getSnapshot(idx);
    },

    getSnapshot: function(index) {
      if (count === 0 || index < 0 || index >= count) return null;
      var realIndex;
      if (count < MAX_SNAPSHOTS) {
        realIndex = index;
      } else {
        realIndex = (head + index) % MAX_SNAPSHOTS;
      }
      return snapshots[realIndex] || null;
    },

    getCurrentSnapshot: function() {
      if (!_isPlayback || playbackIndex < 0) return null;
      return this.getSnapshot(playbackIndex);
    },

    getPlaybackIndex: function() { return playbackIndex; },
    getCount: function() { return count; },

    stepForward: function() {
      if (!_isPlayback || count === 0) return null;
      playbackIndex = Math.min(playbackIndex + 1, count - 1);
      return this.getSnapshot(playbackIndex);
    },

    stepBackward: function() {
      if (!_isPlayback || count === 0) return null;
      playbackIndex = Math.max(playbackIndex - 1, 0);
      return this.getSnapshot(playbackIndex);
    },

    resume: function() {
      _isPlayback = false;
      playbackIndex = -1;
    },

    addBookmark: function(label) {
      if (!_isPlayback || playbackIndex < 0) return;
      var snap = this.getSnapshot(playbackIndex);
      if (!snap) return;
      bookmarks.push({
        index: playbackIndex,
        label: label || ('Bookmark ' + (bookmarks.length + 1)),
        time: snap.t
      });
    },

    removeBookmark: function(idx) {
      if (idx >= 0 && idx < bookmarks.length) bookmarks.splice(idx, 1);
    },

    getBookmarks: function() { return bookmarks.slice(); },
    getMarkers: function() { return markers.slice(); },

    reset: function() {
      snapshots = [];
      head = 0;
      count = 0;
      _isPlayback = false;
      playbackIndex = -1;
      bookmarks = [];
      markers = [];
      lastCaptureTime = -999;
      lastNodeVoltages = null;
    },

    getStats: function() {
      var memoryBytes = 0;
      if (count > 0) {
        var sampleSnap = snapshots[0];
        if (sampleSnap) {
          memoryBytes = count * (sampleSnap.n.byteLength + JSON.stringify(sampleSnap.c).length + 200);
        }
      }
      return {
        count: count,
        maxSnapshots: MAX_SNAPSHOTS,
        memoryKB: Math.round(memoryBytes / 1024),
        oldestTime: count > 0 ? snapshots[count < MAX_SNAPSHOTS ? 0 : head].t : 0,
        newestTime: count > 0 ? snapshots[count < MAX_SNAPSHOTS ? count - 1 : (head - 1 + MAX_SNAPSHOTS) % MAX_SNAPSHOTS].t : 0,
        markerCount: markers.length,
        bookmarkCount: bookmarks.length
      };
    }
  };
})();
