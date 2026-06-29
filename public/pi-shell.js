/** Pi Browser app shell — routes point to Next.js (see docs/PI_ROUTES.md) */
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

  function dashboardPath(role) {
    if (role === 'OWNER') return '/owner'
    if (role === 'ADMIN') return '/dashboard/admin/verification'
    if (role === 'DOCTOR') return '/dashboard/doctor/schedule'
    if (role === 'FACILITY') return '/dashboard/facility/overview'
    return '/dashboard/client/appointments'
  }

  function adminPath(role) {
    if (role === 'OWNER') return '/owner'
    if (role === 'ADMIN') return '/dashboard/admin/verification'
    return '/dashboard'
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

  function navItems(role) {
    var chatHref = role === 'DOCTOR' ? '/dashboard/doctor/chat' : '/dashboard/client/chat'
    var items = [
      { id: 'home', href: '/', icon: '🏠', label: 'الرئيسية' },
      { id: 'consult', href: '/consult-now', icon: '⚡', label: 'فوري' },
      { id: 'doctors', href: '/doctors', icon: '👨‍⚕️', label: 'الأطباء' },
      { id: 'appointments', href: dashboardPath(role || 'CLIENT'), icon: '📅', label: 'المواعيد' },
      { id: 'chat', href: chatHref, icon: '💬', label: 'المحادثات' },
      { id: 'profile', href: '/profile', icon: '👤', label: 'الملف' },
    ]
    if (role === 'OWNER' || role === 'ADMIN') {
      items.splice(1, 0, { id: 'admin', href: adminPath(role), icon: '⚙️', label: 'الإدارة' })
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
    adminPath: adminPath,
    navItems: navItems,
    renderNav: renderNav,
    formatDate: formatDate,
    esc: esc,
  }
})()
