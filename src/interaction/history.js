// ──────── UNDO / REDO ────────
function saveUndo() {
  S.undoStack.push(JSON.stringify({ parts: S.parts, wires: S.wires, nextId: S.nextId }));
  if (S.undoStack.length > MAX_UNDO) S.undoStack.shift();
  S.redoStack = [];
}
function undo() {
  if (!S.undoStack.length) return;
  S.redoStack.push(JSON.stringify({ parts: S.parts, wires: S.wires, nextId: S.nextId }));
  const p = JSON.parse(S.undoStack.pop());
  S.parts = p.parts; S.wires = p.wires; S.nextId = p.nextId; S.sel = []; needsRender = true; updateInspector();
}
function redo() {
  if (!S.redoStack.length) return;
  S.undoStack.push(JSON.stringify({ parts: S.parts, wires: S.wires, nextId: S.nextId }));
  const n = JSON.parse(S.redoStack.pop());
  S.parts = n.parts; S.wires = n.wires; S.nextId = n.nextId; S.sel = []; needsRender = true; updateInspector();
}
