// ──────── COPY / PASTE / DUPLICATE ────────
function doCopy() {
  if (!S.sel.length) return;
  const sp = S.parts.filter(p => S.sel.includes(p.id));
  const cx = sp.reduce((a, p) => a + p.x, 0) / sp.length;
  const cy = sp.reduce((a, p) => a + p.y, 0) / sp.length;
  S.clipboard = sp.map(p => ({ type: p.type, rot: p.rot || 0, val: p.val, flipH: p.flipH, flipV: p.flipV, dx: p.x - cx, dy: p.y - cy }));
}
function doPaste() {
  if (!S.clipboard) return; saveUndo();
  const w = s2w(S.mouse.x, S.mouse.y); const newSel = [];
  S.clipboard.forEach(c => {
    const np = { id: S.nextId++, type: c.type, name: nextName(c.type), x: snap(w.x + c.dx), y: snap(w.y + c.dy), rot: c.rot, val: c.val, flipH: c.flipH, flipV: c.flipV };
    S.parts.push(np); newSel.push(np.id);
  });
  S.sel = newSel; needsRender = true; updateInspector();
}
function doDuplicate() {
  if (!S.sel.length) return; doCopy(); saveUndo(); const newSel = [];
  const sp = S.parts.filter(p => S.sel.includes(p.id));
  const cx = sp.reduce((a, p) => a + p.x, 0) / sp.length;
  const cy = sp.reduce((a, p) => a + p.y, 0) / sp.length;
  S.clipboard.forEach(c => {
    const np = { id: S.nextId++, type: c.type, name: nextName(c.type), x: snap(cx + c.dx + GRID), y: snap(cy + c.dy + GRID), rot: c.rot, val: c.val, flipH: c.flipH, flipV: c.flipV };
    S.parts.push(np); newSel.push(np.id);
  });
  S.sel = newSel; needsRender = true; updateInspector();
}
