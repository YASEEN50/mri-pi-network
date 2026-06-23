/** Inline script — runs before React; redirects Pi Browser to static HTML pages. */
export const PI_BROWSER_REDIRECT_SCRIPT = `
(function () {
  try {
    if (location.protocol === 'http:' && location.hostname.indexOf('localhost') === -1) {
      location.replace('https:' + location.href.slice(5));
      return;
    }
    var path = location.pathname;
    if (path !== '/' && path !== '/login') return;
    function go() {
      var ua = navigator.userAgent || '';
      var isPiUa = /PiBrowser|pibrowser|pi browser|pinetwork|minepi/i.test(ua);
      var hasPi = typeof window.Pi !== 'undefined';
      if (isPiUa || hasPi) {
        location.replace(path === '/login' ? '/pi-login.html' : '/pi.html');
      }
    }
    go();
    var tries = 0;
    var timer = setInterval(function () {
      go();
      if (++tries >= 24) clearInterval(timer);
    }, 250);
  } catch (e) {}
})();
`.trim()
