// ──────── CSV EXPORT ────────
function exportCSV() {
  var lines = ['Time'];
  var ch = S.scope.ch;
  for (var i = 0; i < 4; i++) if (ch[i].on) lines[0] += ','+ch[i].label;
  lines[0] += '\n';
  var ptr = S.scope.ptr;
  for (var s = 0; s < 600; s++) {
    var t = s * SIM_DT * SUBSTEPS;
    var line = t.toExponential(4);
    for (var i = 0; i < 4; i++) if (ch[i].on) line += ',' + ch[i].buf[(ptr+s)%600].toFixed(6);
    lines.push(line + '\n');
  }
  var blob = new Blob(lines, {type:'text/csv'});
  var a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = 'voltxampere-scope.csv'; a.click(); URL.revokeObjectURL(a.href);
}
