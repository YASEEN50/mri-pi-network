/** Shared Pi Browser app shell — lightweight, no React */
window.PiApp = (function () {
  var ROLE_LABELS = {
    CLIENT: 'مريض',
    DOCTOR: 'طبيب',
    FACILITY: 'منشأة',
    ADMIN: 'أدمن',
    OWNER: 'مؤسس',
  }

  var STATUS_LABELS = {
    PENDING: 'قيد الانتظار',
    CONFIRMED: 'مؤكد',
    COMPLETED: 'مكتمل',
    CANCELLED: 'ملغي',
    NO_SHOW: 'لم يحضر',
  }

  function requestCookieAccess() {
    if (document.requestStorageAccess) {
      return document.requestStorageAccess().catch(function () {})
    }
    return Promise.resolve()
  }

  function getSession() {
    return requestCookieAccess().then(function () {
      return fetch('/api/auth/session', { credentials: 'include', cache: 'no-store' })
        .then(function (r) { return r.json() })
    })
  }

  function requireSession() {
    return getSession().then(function (s) {
      if (!s || !s.user) {
        window.location.href = '/'
        return null
      }
      return s
    })
  }

  function api(path, options) {
    var opts = options || {}
    opts.credentials = 'include'
    if (opts.body && typeof opts.body === 'object' && !(opts.body instanceof FormData)) {
      opts.headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {})
      opts.body = JSON.stringify(opts.body)
    }
    return fetch(path, opts).then(function (r) {
      return r.json().then(function (data) {
        if (!r.ok && !data.error) {
          throw new Error(data.message || ('خطأ ' + r.status))
        }
        return data
      })
    })
  }

  function roleLabel(role) {
    return ROLE_LABELS[role] || role
  }

  function statusLabel(s) {
    return STATUS_LABELS[s] || s
  }

  function dashboardPath(role) {
    if (role === 'OWNER' || role === 'ADMIN') return '/pi-owner.html'
    if (role === 'DOCTOR') return '/pi-appointments.html'
    if (role === 'FACILITY') return '/pi-appointments.html'
    return '/pi-appointments.html'
  }

  function navItems(role) {
    var items = [
      { id: 'home', href: '/pi-app.html', icon: '🏠', label: 'الرئيسية' },
      { id: 'doctors', href: '/pi-doctors.html', icon: '👨‍⚕️', label: 'الأطباء' },
      { id: 'profile', href: '/pi-profile.html', icon: '👤', label: 'الملف' },
    ]
    if (role === 'OWNER' || role === 'ADMIN') {
      items.splice(1, 0, { id: 'admin', href: '/pi-owner.html', icon: '⚙️', label: 'الإدارة' })
    } else {
      items.splice(1, 0, { id: 'appointments', href: '/pi-appointments.html', icon: '📅', label: 'المواعيد' })
    }
    return items
  }

  function renderNav(activeId, role) {
    var nav = document.getElementById('pi-nav')
    if (!nav) return
    var items = navItems(role || 'CLIENT')
    nav.innerHTML = items.map(function (item) {
      var cls = item.id === activeId ? ' class="active"' : ''
      return '<a href="' + item.href + '"' + cls + '><span>' + item.icon + '</span>' + item.label + '</a>'
    }).join('')
  }

  function formatDate(iso) {
    if (!iso) return '—'
    try {
      return new Date(iso).toLocaleString('ar-SA', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    } catch (e) {
      return iso
    }
  }

  function esc(text) {
    var d = document.createElement('div')
    d.textContent = text == null ? '' : String(text)
    return d.innerHTML
  }

  return {
    ROLE_LABELS: ROLE_LABELS,
    requestCookieAccess: requestCookieAccess,
    getSession: getSession,
    requireSession: requireSession,
    api: api,
    roleLabel: roleLabel,
    statusLabel: statusLabel,
    dashboardPath: dashboardPath,
    navItems: navItems,
    renderNav: renderNav,
    formatDate: formatDate,
    esc: esc,
  }
})()
