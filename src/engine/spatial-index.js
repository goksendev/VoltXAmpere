// ──────── SPRINT 45: SPATIAL INDEX (Quadtree) ────────
// Viewport-culling index for S.parts. Rebuilds on demand; markDirty() after
// add/remove/move. Render loop integration is opt-in — Sprint 45 ships the
// data structure and hooks, future sprints wire it into drawScene().

VXA.SpatialIndex = (function() {
  'use strict';

  function Quadtree(bounds, maxItems, maxDepth) {
    this.bounds = bounds;
    this.maxItems = maxItems || 8;
    this.maxDepth = maxDepth || 6;
    this.items = [];
    this.children = null;
    this.depth = 0;
  }

  Quadtree.prototype._contains = function(item) {
    return item.x >= this.bounds.x && item.x < this.bounds.x + this.bounds.w &&
           item.y >= this.bounds.y && item.y < this.bounds.y + this.bounds.h;
  };

  Quadtree.prototype._intersects = function(r) {
    return !(r.x > this.bounds.x + this.bounds.w ||
             r.x + r.w < this.bounds.x ||
             r.y > this.bounds.y + this.bounds.h ||
             r.y + r.h < this.bounds.y);
  };

  Quadtree.prototype._itemInRange = function(item, r) {
    var hw = (item.w || 60) / 2, hh = (item.h || 60) / 2;
    return !(item.x - hw > r.x + r.w || item.x + hw < r.x ||
             item.y - hh > r.y + r.h || item.y + hh < r.y);
  };

  Quadtree.prototype._subdivide = function() {
    var x = this.bounds.x, y = this.bounds.y;
    var hw = this.bounds.w / 2, hh = this.bounds.h / 2;
    this.children = [
      new Quadtree({ x: x, y: y, w: hw, h: hh }, this.maxItems, this.maxDepth),
      new Quadtree({ x: x + hw, y: y, w: hw, h: hh }, this.maxItems, this.maxDepth),
      new Quadtree({ x: x, y: y + hh, w: hw, h: hh }, this.maxItems, this.maxDepth),
      new Quadtree({ x: x + hw, y: y + hh, w: hw, h: hh }, this.maxItems, this.maxDepth)
    ];
    for (var i = 0; i < 4; i++) this.children[i].depth = this.depth + 1;
    var keep = [];
    for (var j = 0; j < this.items.length; j++) {
      var it = this.items[j], placed = false;
      for (var c = 0; c < 4; c++) {
        if (this.children[c]._contains(it)) { this.children[c].insert(it); placed = true; break; }
      }
      if (!placed) keep.push(it);
    }
    this.items = keep;
  };

  Quadtree.prototype.insert = function(item) {
    if (!this._contains(item)) return false;
    if (this.children) {
      for (var i = 0; i < 4; i++) {
        if (this.children[i]._contains(item)) { this.children[i].insert(item); return true; }
      }
      this.items.push(item);
      return true;
    }
    this.items.push(item);
    if (this.items.length > this.maxItems && this.depth < this.maxDepth) this._subdivide();
    return true;
  };

  Quadtree.prototype.query = function(range, result) {
    result = result || [];
    if (!this._intersects(range)) return result;
    for (var i = 0; i < this.items.length; i++) {
      if (this._itemInRange(this.items[i], range)) result.push(this.items[i]);
    }
    if (this.children) {
      for (var c = 0; c < 4; c++) this.children[c].query(range, result);
    }
    return result;
  };

  Quadtree.prototype.clear = function() { this.items = []; this.children = null; };

  // ── Index management ───────────────────────────
  var _tree = null;
  var _dirty = true;
  var _lastPartCount = -1;
  var _lastWireCount = -1;
  var _rebuildCount = 0;

  function rebuild() {
    _rebuildCount++;
    if (typeof S === 'undefined' || !S || !Array.isArray(S.parts) || S.parts.length === 0) {
      _tree = null; _dirty = false; return;
    }
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (var i = 0; i < S.parts.length; i++) {
      var p = S.parts[i];
      if (p.x - 80 < minX) minX = p.x - 80;
      if (p.y - 80 < minY) minY = p.y - 80;
      if (p.x + 80 > maxX) maxX = p.x + 80;
      if (p.y + 80 > maxY) maxY = p.y + 80;
    }
    var pad = 200;
    _tree = new Quadtree({
      x: minX - pad, y: minY - pad,
      w: Math.max(1, (maxX - minX) + pad * 2),
      h: Math.max(1, (maxY - minY) + pad * 2)
    });
    for (var j = 0; j < S.parts.length; j++) {
      var pp = S.parts[j];
      _tree.insert({ x: pp.x, y: pp.y, w: 80, h: 80, ref: pp });
    }
    _dirty = false;
    _lastPartCount = S.parts.length;
    _lastWireCount = Array.isArray(S.wires) ? S.wires.length : 0;
  }

  // Ensure tree reflects current S.parts — polled by render hooks.
  function ensureFresh() {
    if (typeof S === 'undefined' || !S || !S.parts) return;
    var pc = S.parts.length;
    var wc = Array.isArray(S.wires) ? S.wires.length : 0;
    if (_dirty || pc !== _lastPartCount || wc !== _lastWireCount) rebuild();
  }

  function queryViewport(viewX, viewY, viewW, viewH, zoom) {
    ensureFresh();
    if (!_tree) return [];
    var ox = (S && S.view && typeof S.view.ox === 'number') ? S.view.ox : 0;
    var oy = (S && S.view && typeof S.view.oy === 'number') ? S.view.oy : 0;
    var z = zoom || (S && S.view && S.view.zoom) || 1;
    var cx = (viewX - ox) / z;
    var cy = (viewY - oy) / z;
    var cw = viewW / z;
    var ch = viewH / z;
    return _tree.query({ x: cx, y: cy, w: cw, h: ch }).map(function(it) { return it.ref; });
  }

  function queryRange(x, y, w, h) {
    ensureFresh();
    if (!_tree) return [];
    return _tree.query({ x: x, y: y, w: w, h: h }).map(function(it) { return it.ref; });
  }

  function markDirty() { _dirty = true; }
  function isDirty() { return _dirty; }
  function getRebuildCount() { return _rebuildCount; }
  function getTree() { return _tree; }

  return {
    Quadtree: Quadtree,
    rebuild: rebuild,
    ensureFresh: ensureFresh,
    queryViewport: queryViewport,
    queryRange: queryRange,
    markDirty: markDirty,
    isDirty: isDirty,
    getRebuildCount: getRebuildCount,
    getTree: getTree
  };
})();
