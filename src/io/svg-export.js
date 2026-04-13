// ──────── SVG EXPORT ────────
function exportSVG() {
  var w = cvs.width/DPR, h = cvs.height/DPR;
  var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="'+w+'" height="'+h+'" style="background:#06080c">';
  svg += '<style>text{font-family:JetBrains Mono,monospace;fill:#8899aa;}</style>';
  S.parts.forEach(function(p) {
    var sx = p.x * S.view.zoom + S.view.ox, sy = p.y * S.view.zoom + S.view.oy;
    var def = COMP[p.type];
    svg += '<circle cx="'+sx+'" cy="'+sy+'" r="8" fill="none" stroke="'+(def?def.color:'#888')+'" stroke-width="1.5"/>';
    svg += '<text x="'+sx+'" y="'+(sy+20)+'" text-anchor="middle" font-size="10">'+(p.name||p.type)+'</text>';
  });
  S.wires.forEach(function(wr) {
    var s1 = {x:wr.x1*S.view.zoom+S.view.ox, y:wr.y1*S.view.zoom+S.view.oy};
    var s2 = {x:wr.x2*S.view.zoom+S.view.ox, y:wr.y2*S.view.zoom+S.view.oy};
    svg += '<line x1="'+s1.x+'" y1="'+s1.y+'" x2="'+s2.x+'" y2="'+s2.y+'" stroke="#3a4a5a" stroke-width="2"/>';
  });
  svg += '</svg>';
  var blob = new Blob([svg], {type:'image/svg+xml'});
  var a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = 'voltxampere.svg'; a.click(); URL.revokeObjectURL(a.href);
}
