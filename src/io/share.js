// ──────── URL SHARING ────────
// Sprint 33: Format v2 — preserves model, switch state, wiper, label, etc.
function shareURL() {
  var data = {
    v: 2, // Format versiyonu 2 — extras objesi destekler
    p: S.parts.map(function(p) {
      var entry = [p.type, p.x, p.y, p.rot||0, p.val, p.freq||0];
      var extras = {};
      if (p.model) extras.m = p.model;                                    // SPICE model adı
      if (p.ledColor) extras.lc = p.ledColor;                              // LED rengi
      if (p.closed) extras.cl = 1;                                         // Switch/relay durumu
      if (p.wiper !== undefined && p.wiper !== 0.5) extras.wp = p.wiper;  // Pot wiper (default 0.5 ise atla)
      if (p.label) extras.lb = p.label;                                    // Net label ismi
      if (p.coupling) extras.cp = p.coupling;                              // Trafo coupling
      if (p.L1) extras.l1 = p.L1;                                          // Trafo L1
      if (p.L2) extras.l2 = p.L2;                                          // Trafo L2
      if (p.phase) extras.ph = p.phase;                                    // AC source faz
      if (p.duty) extras.dt = p.duty;                                      // Pulse duty cycle
      if (p.dcOffset) extras.dc = p.dcOffset;                              // AC DC offset
      if (p.impedance && p.impedance !== 8) extras.z = p.impedance;        // Speaker impedans
      // Sprint 40: PWL / EXP / SFFM / cap IC / src type override
      if (Array.isArray(p.pwlPoints) && p.pwlPoints.length > 0) extras.pw = p.pwlPoints;
      if (p.expParams) extras.ep = p.expParams;
      if (p.sffmParams) extras.sf = p.sffmParams;
      if (typeof p.icVoltage === 'number' && p.icVoltage !== 0) extras.ic = p.icVoltage;
      if (p.srcType) extras.st = p.srcType;
      if (Object.keys(extras).length > 0) entry.push(extras);
      return entry;
    }),
    w: S.wires.map(function(w) { return [w.x1, w.y1, w.x2, w.y2]; })
  };
  var json = JSON.stringify(data);
  // UTF-8 safe btoa (Türkçe karakter, μ/Ω semboller için)
  var encoded = btoa(unescape(encodeURIComponent(json)));
  var url = location.origin + location.pathname + '#circuit=' + encoded;
  if (url.length > 2000) {
    console.warn('Share URL is very long (' + url.length + ' chars). Some browsers may truncate.');
  }
  var embedUrl = url + '&embed=1';
  var embedCode = '<iframe src="'+embedUrl+'" width="100%" height="600" frameborder="0"></iframe>';
  // Update modal content
  document.getElementById('share-title-h').textContent = t('shareTitle');
  document.getElementById('sh-url-label').textContent = '\uD83D\uDD17 ' + t('shareURL');
  document.getElementById('share-url-text').textContent = url;
  document.getElementById('sh-embed-label').textContent = '</> ' + t('shareEmbed');
  document.getElementById('share-embed-text').textContent = embedCode;
  document.getElementById('sh-qr-label').textContent = '\uD83D\uDCF1 ' + t('shareQR');
  document.getElementById('sh-social-label').textContent = '\uD83C\uDF10 ' + t('shareSocial');
  // QR code via Google Charts API
  document.getElementById('share-qr-img').src = 'https://chart.googleapis.com/chart?cht=qr&chs=150x150&chl=' + encodeURIComponent(url);
  // Store URL for social sharing
  window._shareURL = url;
  // Show modal
  document.getElementById('share-modal').classList.add('show');
}

function copyShareURL() {
  navigator.clipboard.writeText(window._shareURL || '').then(function() {
    showInfoCard(t('copied'), '', '');
  });
}
function copyEmbed() {
  var text = document.getElementById('share-embed-text').textContent;
  navigator.clipboard.writeText(text).then(function() {
    showInfoCard(t('copied'), '', '');
  });
}
function shareToTwitter() {
  window.open('https://twitter.com/intent/tweet?text=' + encodeURIComponent('Check out this circuit!') + '&url=' + encodeURIComponent(window._shareURL || ''));
}
function shareToWhatsApp() {
  window.open('https://wa.me/?text=' + encodeURIComponent('Check out this circuit: ' + (window._shareURL || '')));
}
function shareToLinkedIn() {
  window.open('https://www.linkedin.com/sharing/share-offsite/?url=' + encodeURIComponent(window._shareURL || ''));
}
function shareToTelegram() {
  window.open('https://t.me/share/url?url=' + encodeURIComponent(window._shareURL || '') + '&text=VoltXAmpere+Circuit');
}
