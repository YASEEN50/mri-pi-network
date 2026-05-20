// src/app/(auth)/register/page.tsx
import RegisterForm from '@/components/auth/RegisterForm'

export const metadata = {
  title: 'إنشاء حساب | المنصة الطبية',
  description: 'إنشاء حساب جديد في المنصة الطبية',
}

export default function RegisterPage() {
  return <RegisterForm />
}
