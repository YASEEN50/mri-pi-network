/** Inline script — runs before React; redirects Pi Browser to static HTML pages (once). */
export const PI_BROWSER_REDIRECT_SCRIPT = `
(function () {
  try {
    if (location.protocol === 'http:' && location.hostname.indexOf('localhost') === -1) {
      location.replace('https:' + location.href.slice(5));
      return;
    }
    var path = location.pathname;
    var entryPaths = ['/login', '/register'];
    if (entryPaths.indexOf(path) === -1) return;

    function targetForPath(p) {
      if (p === '/login') return '/pi-login.html';
      if (p === '/register') return '/pi-register.html';
      return null;
    }

    function isPiEnvironment() {
      var ua = navigator.userAgent || '';
      if (/PiBrowser|pibrowser|pi browser|pinetwork|minepi/i.test(ua)) return true;
      if (typeof window.Pi !== 'undefined') return true;
      try {
        if (window.self !== window.top) return true;
      } catch (e) {
        return true;
      }
      return false;
    }

    function redirectOnce() {
      var target = targetForPath(path);
      if (!target || !isPiEnvironment()) return;
      var key = 'pi_entry_redirect:' + path;
      if (sessionStorage.getItem(key) === '1') return;
      sessionStorage.setItem(key, '1');
      location.replace(target);
    }

    redirectOnce();
    var tries = 0;
    var timer = setInterval(function () {
      if (!isPiEnvironment()) {
        clearInterval(timer);
        return;
      }
      redirectOnce();
      if (++tries >= 8) clearInterval(timer);
    }, 400);
  } catch (e) {}
})();
`.trim()
