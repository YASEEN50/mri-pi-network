export default function AuthRouteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-css-tags */}
      <link rel="stylesheet" href="/pi-login.css" />
      {children}
    </>
  )
}
