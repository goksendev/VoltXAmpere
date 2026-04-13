// ──────── CONTEXT MENU ────────
const ctxMenu = document.getElementById('ctx-menu');
function showCtx(x, y) { ctxMenu.style.display = 'block'; ctxMenu.style.left = x + 'px'; ctxMenu.style.top = y + 'px'; }
function hideCtx() { ctxMenu.style.display = 'none'; }
function ctxEditVal() {
  hideCtx(); if (!S.sel.length) return;
  const p = S.parts.find(pp => pp.id === S.sel[0]); if (!p) return;
  openInlineEdit(p);
}
function ctxRotate() { hideCtx(); rotateSelected(); }
function ctxFlipH() { hideCtx(); if (!S.sel.length) return; saveUndo(); S.parts.filter(p => S.sel.includes(p.id)).forEach(p => p.flipH = !p.flipH); needsRender = true; }
function ctxFlipV() { hideCtx(); if (!S.sel.length) return; saveUndo(); S.parts.filter(p => S.sel.includes(p.id)).forEach(p => p.flipV = !p.flipV); needsRender = true; }
function ctxCopy() { hideCtx(); doCopy(); }
function ctxDelete() { hideCtx(); deleteSelected(); }
