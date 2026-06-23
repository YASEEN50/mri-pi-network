/** Pi Network auth — init → authenticate → backend /v2/me via NextAuth */
window.PiAuth = (function () {
  var SKIP_KEY = 'pi_skip_auto_login'

  function shouldSkipAuto() {
    try { return sessionStorage.getItem(SKIP_KEY) === '1' } catch (e) { return false }
  }

  function loadSdk() {
    if (window.Pi) return Promise.resolve()
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script')
      s.src = 'https://sdk.minepi.com/pi-sdk.js'
      s.onload = resolve
      s.onerror = function () { reject(new Error('تعذر تحميل Pi SDK')) }
      document.head.appendChild(s)
    })
  }

  function getSandbox() {
    return fetch('/api/pi-config', { cache: 'no-store' })
      .then(function (r) { return r.json() })
      .then(function (d) { return d.sandbox === true })
      .catch(function () { return false })
  }

  function requestCookieAccess() {
    if (document.requestStorageAccess) {
      return document.requestStorageAccess().catch(function () {})
    }
    return Promise.resolve()
  }

  function initPi() {
    return loadSdk()
      .then(getSandbox)
      .then(function (sandbox) {
        if (!window.Pi) throw new Error('Pi Browser غير متوفر')
        return Promise.resolve(window.Pi.init({ version: '2.0', sandbox: sandbox }))
      })
  }

  function authenticatePi() {
    return initPi().then(function () {
      return window.Pi.authenticate(['username'], function () {})
    })
  }

  function verifySessionThenGo() {
    return fetch('/api/auth/session', { credentials: 'include', cache: 'no-store' })
      .then(function (r) { return r.json() })
      .then(function (s) {
        if (s && s.user) {
          window.location.href = '/dashboard'
          return
        }
        throw new Error('تم التحقق لكن الجلسة لم تُحفظ')
      })
  }

  function establishSession(accessToken) {
    return requestCookieAccess()
      .then(function () { return fetch('/api/auth/csrf', { credentials: 'include' }) })
      .then(function (r) { return r.json() })
      .then(function (csrf) {
        return fetch('/api/auth/callback/pi-network', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            csrfToken: csrf.csrfToken,
            accessToken: accessToken,
            callbackUrl: '/dashboard',
            json: 'true',
          }).toString(),
        })
      })
      .then(function (res) { return res.json() })
      .then(function (data) {
        if (data.error) throw new Error('فشل تسجيل الدخول')
        return verifySessionThenGo()
      })
  }

  function signIn() {
    return authenticatePi()
      .then(function (auth) {
        if (!auth || !auth.accessToken) throw new Error('لم يتم استلام رمز Pi')
        return establishSession(auth.accessToken)
      })
  }

  function tryAutoSignIn() {
    if (shouldSkipAuto()) return Promise.resolve(false)
    return fetch('/api/auth/session', { credentials: 'include', cache: 'no-store' })
      .then(function (r) { return r.json() })
      .then(function (s) {
        if (s && s.user) {
          window.location.href = '/dashboard'
          return true
        }
        return signIn().then(function () { return true })
      })
      .catch(function () { return false })
  }

  return { signIn: signIn, tryAutoSignIn: tryAutoSignIn, shouldSkipAuto: shouldSkipAuto }
})()
