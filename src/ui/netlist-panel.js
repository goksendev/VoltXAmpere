// ──────── SPRINT 46: NETLIST PANEL UI ────────
// Fixed-position drawer on the right side — does NOT alter the existing grid.
// Toggle via button (id=netlist-toggle-btn) or Ctrl+L shortcut.

(function() {
  'use strict';
  if (typeof document === 'undefined') return;

  var DEBOUNCE_MS = 500;
  var panelEl = null;
  var highlightEl = null;
  var textareaEl = null;
  var errorsEl = null;
  var lastText = '';
  var debounceTimer = null;
  var opened = false;

  function ensurePanel() {
    if (panelEl) return panelEl;

    // Panel CSS (inline, injected once)
    var style = document.createElement('style');
    style.id = 'netlist-panel-style';
    style.textContent =
      '#netlist-panel{position:fixed;top:48px;right:0;bottom:48px;width:380px;' +
      'background:var(--surface-2,#1a1a1a);border-left:1px solid var(--border,#333);' +
      'display:none;flex-direction:column;z-index:1000;font-family:var(--font-mono,monospace);' +
      'box-shadow:-4px 0 16px rgba(0,0,0,0.3)}' +
      '#netlist-panel.open{display:flex}' +
      '#netlist-panel-header{padding:8px 12px;border-bottom:1px solid var(--border,#333);' +
      'display:flex;align-items:center;gap:8px;font:600 12px var(--font-ui,sans-serif)}' +
      '#netlist-panel-body{flex:1;position:relative;overflow:hidden}' +
      '#netlist-highlight,#netlist-textarea{position:absolute;inset:0;margin:0;padding:8px 12px;' +
      'font:12px/1.55 var(--font-mono,monospace);white-space:pre-wrap;word-break:break-word;' +
      'overflow:auto;box-sizing:border-box;border:none;background:transparent;color:var(--text,#eee);resize:none}' +
      '#netlist-highlight{pointer-events:none;color:transparent}' +
      '#netlist-textarea{caret-color:var(--accent,#00e09e);color:rgba(255,255,255,0.9)}' +
      '#netlist-errors{padding:6px 12px;border-top:1px solid var(--border,#333);max-height:120px;' +
      'overflow:auto;font:11px var(--font-mono,monospace);color:#e74c3c;background:var(--surface-1,#141414)}' +
      '#netlist-errors:empty{display:none}' +
      '.nl-comment{color:#6a737d;font-style:italic}' +
      '.nl-command{color:#e36209;font-weight:600}' +
      '.nl-component{color:#79b8ff;font-weight:600}' +
      '.nl-node{color:#85e89d}' +
      '.nl-value{color:#ffab70}' +
      '#netlist-toggle-btn{background:var(--surface-3,#222);color:var(--text,#eee);border:1px solid var(--border,#333);' +
      'padding:4px 10px;border-radius:4px;cursor:pointer;font:11px var(--font-ui,sans-serif)}' +
      '#netlist-toggle-btn.active{background:var(--accent,#00e09e);color:#000}';
    document.head.appendChild(style);

    panelEl = document.createElement('div');
    panelEl.id = 'netlist-panel';
    panelEl.innerHTML =
      '<div id="netlist-panel-header">' +
      '  <span>📝 SPICE Netlist (live)</span>' +
      '  <span style="flex:1"></span>' +
      '  <button onclick="copyNetlist()" style="background:var(--surface-3);color:var(--text);border:1px solid var(--border);padding:3px 8px;border-radius:3px;cursor:pointer;font:11px var(--font-ui)">📋 Kopyala</button>' +
      '  <button onclick="toggleNetlistPanel()" style="background:var(--surface-3);color:var(--text);border:1px solid var(--border);padding:3px 8px;border-radius:3px;cursor:pointer;font:11px var(--font-ui)">✕</button>' +
      '</div>' +
      '<div id="netlist-panel-body">' +
      '  <pre id="netlist-highlight" aria-hidden="true"></pre>' +
      '  <textarea id="netlist-textarea" spellcheck="false"></textarea>' +
      '</div>' +
      '<div id="netlist-errors"></div>';
    document.body.appendChild(panelEl);

    highlightEl = document.getElementById('netlist-highlight');
    textareaEl = document.getElementById('netlist-textarea');
    errorsEl = document.getElementById('netlist-errors');

    textareaEl.addEventListener('input', onInput);
    textareaEl.addEventListener('scroll', function() {
      highlightEl.scrollTop = textareaEl.scrollTop;
      highlightEl.scrollLeft = textareaEl.scrollLeft;
    });
    return panelEl;
  }

  function onInput() {
    var txt = textareaEl.value;
    renderHighlight(txt);
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(function() {
      try {
        var n = VXA.NetlistEditor.apply(lastText, txt);
        if (n > 0 && typeof buildCircuitFromCanvas === 'function') {
          // part.val changed — sim will pick it up next step
        }
      } catch (e) {}
      lastText = txt;
      showErrors(VXA.NetlistEditor.validate(txt));
    }, DEBOUNCE_MS);
  }

  function renderHighlight(txt) {
    if (!highlightEl) return;
    highlightEl.innerHTML = VXA.NetlistEditor.highlight(txt) + '\n';
  }

  function showErrors(errs) {
    if (!errorsEl) return;
    if (!errs || errs.length === 0) { errorsEl.textContent = ''; return; }
    errorsEl.innerHTML = errs.map(function(e) {
      return 'Line ' + e.line + ': ' + VXA.NetlistEditor.escapeHtml(e.message);
    }).join('\n');
  }

  function refresh() {
    if (!opened || !textareaEl) return;
    var fresh = VXA.NetlistEditor.generate();
    // Preserve cursor if text differs only trivially
    var active = document.activeElement === textareaEl;
    if (!active || lastText !== textareaEl.value) {
      textareaEl.value = fresh;
      lastText = fresh;
      renderHighlight(fresh);
      showErrors(VXA.NetlistEditor.validate(fresh));
    }
  }

  window.toggleNetlistPanel = function(force) {
    ensurePanel();
    if (typeof force === 'boolean') opened = force;
    else opened = !opened;
    panelEl.classList.toggle('open', opened);
    var btn = document.getElementById('netlist-toggle-btn');
    if (btn) btn.classList.toggle('active', opened);
    if (opened) refresh();
  };

  window.copyNetlist = function() {
    ensurePanel();
    var txt = textareaEl.value;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).catch(function() {});
    }
    if (typeof showInfoCard === 'function') showInfoCard('Netlist kopyalandı', '', '');
  };

  // Ctrl+L shortcut
  document.addEventListener('keydown', function(e) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'l') {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      e.preventDefault();
      window.toggleNetlistPanel();
    }
  });

  // Periodic refresh (500ms) while open — cheap since only regenerates if open
  setInterval(function() { if (opened) refresh(); }, 500);

  // Injection of toggle button into toolbar (after DOM ready)
  function injectButton() {
    if (document.getElementById('netlist-toggle-btn')) return;
    var btn = document.createElement('button');
    btn.id = 'netlist-toggle-btn';
    btn.textContent = '📝 Netlist';
    btn.title = 'SPICE Netlist (Ctrl+L)';
    btn.onclick = function() { window.toggleNetlistPanel(); };
    // Try common toolbar locations; fall back to floating button
    var host = document.querySelector('.toolbar') || document.querySelector('#toolbar') ||
               document.querySelector('header') || document.getElementById('sb-about');
    if (host && host.parentNode) {
      host.parentNode.insertBefore(btn, host.nextSibling || null);
    } else {
      btn.style.cssText = 'position:fixed;top:8px;right:8px;z-index:1001';
      document.body.appendChild(btn);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectButton);
  } else {
    setTimeout(injectButton, 600);
  }

  // Also ensure panel exists for API / test use
  setTimeout(ensurePanel, 700);
})();
