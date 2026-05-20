// src/app/doctors/signup/page.tsx
// هذه الصفحة تُعيد توجيه لـ /onboarding/doctor لتوحيد المسار
import { redirect } from 'next/navigation'
export default function DoctorSignupRedirect() {
  redirect('/onboarding/doctor')
}
