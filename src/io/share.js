// ──────── URL SHARING ────────
function shareURL() {
  var data = { v:1, p:S.parts.map(function(p){return [p.type,p.x,p.y,p.rot||0,p.val,p.freq||0];}), w:S.wires.map(function(w){return [w.x1,w.y1,w.x2,w.y2];}) };
  var encoded = btoa(JSON.stringify(data));
  var url = location.origin + location.pathname + '#circuit=' + encoded;
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
