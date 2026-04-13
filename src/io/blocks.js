// ──────── SPRINT 9: MÜHENDİSLİK İŞ AKIŞI ────────

// 9.2: SUBCIRCUIT / BLOCK SYSTEM
VXA.Blocks = (function() {
  var KEY = 'vxa_blocks';
  function load() { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch(e) { return []; } }
  function save(blocks) { localStorage.setItem(KEY, JSON.stringify(blocks)); }
  function saveBlock(name, parts, wires) {
    if (!parts.length) return false;
    var cx = 0, cy = 0; parts.forEach(function(p) { cx += p.x; cy += p.y; }); cx /= parts.length; cy /= parts.length;
    var block = {
      name: name, created: Date.now(),
      parts: parts.map(function(p) { return { type: p.type, dx: p.x - cx, dy: p.y - cy, rot: p.rot || 0, val: p.val, model: p.model, flipH: p.flipH, flipV: p.flipV }; }),
      wires: wires.map(function(w) { return { dx1: w.x1 - cx, dy1: w.y1 - cy, dx2: w.x2 - cx, dy2: w.y2 - cy }; })
    };
    var blocks = load(); blocks.push(block); save(blocks);
    return true;
  }
  function placeBlock(blockIdx, x, y) {
    var blocks = load(); var block = blocks[blockIdx]; if (!block) return;
    saveUndo();
    block.parts.forEach(function(bp) {
      var p = { id: S.nextId++, type: bp.type, name: nextName(bp.type), x: snap(x + bp.dx), y: snap(y + bp.dy), rot: bp.rot || 0, val: bp.val, flipH: bp.flipH, flipV: bp.flipV };
      if (bp.model) { p.model = bp.model; applyModel(p, bp.model); }
      S.parts.push(p);
    });
    block.wires.forEach(function(bw) {
      S.wires.push({ x1: snap(x + bw.dx1), y1: snap(y + bw.dy1), x2: snap(x + bw.dx2), y2: snap(y + bw.dy2) });
    });
    needsRender = true;
  }
  function deleteBlock(idx) { var blocks = load(); blocks.splice(idx, 1); save(blocks); }
  function listBlocks() { return load(); }
  return { saveBlock: saveBlock, placeBlock: placeBlock, deleteBlock: deleteBlock, listBlocks: listBlocks };
})();
function saveAsBlock() {
  if (!S.sel.length) return;
  var selParts = S.parts.filter(function(p) { return S.sel.includes(p.id); });
  var selWires = S.wires.filter(function(w) {
    return selParts.some(function(p) { var pins = getPartPins(p); return pins.some(function(pin) { return (Math.abs(w.x1 - pin.x) < 3 && Math.abs(w.y1 - pin.y) < 3) || (Math.abs(w.x2 - pin.x) < 3 && Math.abs(w.y2 - pin.y) < 3); }); });
  });
  var name = prompt(currentLang === 'tr' ? 'Blok adı:' : 'Block name:', 'Block ' + (VXA.Blocks.listBlocks().length + 1));
  if (!name) return;
  VXA.Blocks.saveBlock(name, selParts, selWires);
  showInfoCard(currentLang === 'tr' ? 'Blok Kaydedildi' : 'Block Saved', name, selParts.length + (currentLang === 'tr' ? ' bileşen' : ' components'));
}
