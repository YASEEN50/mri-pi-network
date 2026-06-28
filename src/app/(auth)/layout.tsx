import AuthPageBackNav from '@/components/auth/AuthPageBackNav'

export default function AuthRouteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-css-tags */}
      <link rel="stylesheet" href="/pi-login.css?v=2" />
      <AuthPageBackNav />
      {children}
    </>
  )
}
