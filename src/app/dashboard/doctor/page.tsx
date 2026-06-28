import { redirect } from 'next/navigation'

export default function DoctorDashboardRoot() {
  redirect('/dashboard/doctor/schedule')
}
