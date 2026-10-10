// iOS zooms the page when a field under 16px gets focus, and a standalone app
// gives no easy way back out. `maximum-scale=1` stops that auto-zoom on iOS,
// where WebKit still honours user pinch-zoom regardless. Not applied elsewhere:
// on Android it would disable pinch-zoom, and Android doesn't auto-zoom anyway.
(function () {
  var ua = navigator.userAgent;
  var iOS = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  if (!iOS) return;
  var meta = document.querySelector('meta[name="viewport"]');
  if (meta && meta.content.indexOf('maximum-scale') === -1) meta.content += ', maximum-scale=1';
})();
