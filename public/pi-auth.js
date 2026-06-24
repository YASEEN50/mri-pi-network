/** Pi Network auth — init → authenticate → backend /v2/me via NextAuth */
window.PiAuth = (function () {
  var SKIP_KEY = 'pi_skip_auto_login'
  var initSandbox = null

  function shouldSkipAuto() {
    try { return sessionStorage.getItem(SKIP_KEY) === '1' } catch (e) { return false }
  }

  function markSkipAuto() {
    try { sessionStorage.setItem(SKIP_KEY, '1') } catch (e) {}
  }

  function clearSkipAuto() {
    try { sessionStorage.removeItem(SKIP_KEY) } catch (e) {}
  }

  var PENDING_INCOMPLETE_KEY = 'pi_pending_incomplete'

  function storePendingIncomplete(payment) {
    try { sessionStorage.setItem(PENDING_INCOMPLETE_KEY, JSON.stringify(payment)) } catch (e) {}
  }

  function takePendingIncomplete() {
    try {
      var raw = sessionStorage.getItem(PENDING_INCOMPLETE_KEY)
      if (!raw) return null
      sessionStorage.removeItem(PENDING_INCOMPLETE_KEY)
      return JSON.parse(raw)
    } catch (e) { return null }
  }

  function postIncompletePayment(payment, accessToken) {
    var body = { payment: payment }
    if (accessToken) body.accessToken = accessToken
    return fetch('/api/payment/pi/incomplete', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(function (r) { return r.json() })
  }

  function onIncompletePaymentFound(payment) {
    postIncompletePayment(payment)
      .then(function (data) {
        if (data.success && !(data.data && data.data.error)) return
        if (data.data && data.data.code === 'AUTH_REQUIRED') storePendingIncomplete(payment)
      })
      .catch(function (e) {
        console.error('[PiAuth] incomplete payment', e)
        storePendingIncomplete(payment)
      })
  }

  function flushPendingIncomplete(accessToken) {
    var pending = takePendingIncomplete()
    if (!pending) return Promise.resolve()
    return postIncompletePayment(pending, accessToken)
      .catch(function (e) {
        console.error('[PiAuth] flush incomplete', e)
        storePendingIncomplete(pending)
      })
  }

  var PI_SCOPES = ['username', 'payments']

  function withTimeout(promise, ms, code) {
    return new Promise(function (resolve, reject) {
      var done = false
      var timer = setTimeout(function () {
        if (done) return
        done = true
        reject(new Error(code || 'timeout'))
      }, ms)
      Promise.resolve(promise).then(
        function (v) {
          if (done) return
          done = true
          clearTimeout(timer)
          resolve(v)
        },
        function (e) {
          if (done) return
          done = true
          clearTimeout(timer)
          reject(e)
        }
      )
    })
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

  /** Pi Desktop App Studio preview runs in sandbox even on production URLs */
  function detectSandboxClient() {
    try {
      var hostRef = location.hostname + ' ' + (document.referrer || '')
      if (/sandbox\.minepi/i.test(hostRef)) return true
      if (/\.pinet\.com$/i.test(location.hostname)) return false
    } catch (e) {}

    var mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '')
    var embedded = false
    try { embedded = window.self !== window.top } catch (e) { embedded = true }

    if (embedded && !mobile) return true
    return false
  }

  function resolveSandbox() {
    var client = detectSandboxClient()
    return fetch('/api/pi-config', { cache: 'no-store' })
      .then(function (r) { return r.json() })
      .then(function (d) {
        if (d.sandbox === true) return true
        return client
      })
      .catch(function () { return client })
  }

  function requestCookieAccess() {
    if (document.requestStorageAccess) {
      return document.requestStorageAccess().catch(function () {})
    }
    return Promise.resolve()
  }

  function initPi(forcedSandbox) {
    var headInit = window.__piInitPromise ? window.__piInitPromise.catch(function () {}) : Promise.resolve()
    return headInit.then(loadSdk).then(function () {
      if (!window.Pi) throw new Error('Pi Browser غير متوفر')
      var sandboxSource = forcedSandbox !== undefined && forcedSandbox !== null
        ? Promise.resolve(!!forcedSandbox)
        : resolveSandbox()
      return sandboxSource.then(function (sandbox) {
        if (initSandbox === sandbox) return
        initSandbox = sandbox
        return Promise.resolve(window.Pi.init({ version: '2.0', sandbox: sandbox }))
      })
    })
  }

  function callAuthenticate() {
    return withTimeout(
      Promise.resolve(window.Pi.authenticate(PI_SCOPES, onIncompletePaymentFound)),
      30000,
      'PI_AUTH_TIMEOUT'
    )
  }

  /** Always await init then authenticate — required for Pi App Studio verification */
  function authenticatePi() {
    return initPi()
      .then(callAuthenticate)
      .catch(function (err) {
        if (err && err.message === 'PI_AUTH_TIMEOUT' && initSandbox === false) {
          initSandbox = null
          return initPi(true).then(callAuthenticate)
        }
        throw err
      })
  }

  function verifySessionThenGo() {
    return fetch('/api/auth/session', { credentials: 'include', cache: 'no-store' })
      .then(function (r) { return r.json() })
      .then(function (s) {
        if (s && s.user) {
          clearSkipAuto()
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
        return flushPendingIncomplete(accessToken).then(function () {
          return verifySessionThenGo()
        })
      })
  }

  function signIn() {
    clearSkipAuto()
    return requestCookieAccess()
      .then(authenticatePi)
      .then(function (auth) {
        if (!auth || !auth.accessToken) throw new Error('لم يتم استلام رمز Pi')
        return establishSession(auth.accessToken)
      })
  }

  /** On load: resume session on Pi entry pages only */
  function isEntryPath() {
    var p = location.pathname
    return p === '/' || p === '/login' || p === '/register' ||
      p === '/pi.html' || p === '/pi-login.html' || p === '/pi-email.html'
  }

  function runOnLoad() {
    if (!isEntryPath()) return Promise.resolve({ mode: 'idle' })
    if (shouldSkipAuto()) return Promise.resolve({ mode: 'idle' })
    return fetch('/api/auth/session', { credentials: 'include', cache: 'no-store' })
      .then(function (r) { return r.json() })
      .then(function (s) {
        if (s && s.user) {
          window.location.href = '/dashboard'
          return { mode: 'redirecting' }
        }
        return { mode: 'idle' }
      })
      .catch(function (err) {
        console.warn('[PiAuth] runOnLoad', err)
        return { mode: 'idle' }
      })
  }

  function tryAutoSignIn() {
    return runOnLoad().then(function (auth) { return !!auth })
  }

  function signOut(redirectTo) {
    markSkipAuto()
    var target = redirectTo || '/'
    return fetchCsrf()
      .then(function (csrf) {
        return fetch('/api/auth/signout', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            csrfToken: csrf.csrfToken,
            callbackUrl: target,
            json: 'true',
          }).toString(),
        })
      })
      .then(function (r) { return r.json() })
      .then(function (data) {
        window.location.href = (data && data.url) ? data.url : target
      })
      .catch(function () {
        window.location.href = target
      })
  }

  return {
    signIn: signIn,
    runOnLoad: runOnLoad,
    tryAutoSignIn: tryAutoSignIn,
    authenticatePi: authenticatePi,
    shouldSkipAuto: shouldSkipAuto,
    markSkipAuto: markSkipAuto,
    clearSkipAuto: clearSkipAuto,
    signOut: signOut,
  }
})()
