// src/app/dashboard/layout.tsx
// المصادقة تُدار عبر middleware — لا حاجة لـ getServerSession هنا

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
