import Link from 'next/link'

export default function UnauthorizedPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#020617', display: 'flex', alignItems: 'center', justifyContent: 'center', direction: 'rtl' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🚫</div>
        <h1 style={{ color: 'white', fontSize: '1.5rem', marginBottom: '0.5rem' }}>غير مصرح</h1>
        <p style={{ color: '#94a3b8', marginBottom: '1.5rem' }}>ليس لديك صلاحية للوصول لهذه الصفحة</p>
        <Link href="/" style={{ padding: '0.75rem 1.5rem', background: '#10b981', color: 'white', borderRadius: '0.75rem', textDecoration: 'none', display: 'inline-block' }}>
          العودة للرئيسية
        </Link>
      </div>
    </div>
  )
}
