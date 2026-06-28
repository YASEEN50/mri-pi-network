import { redirect } from 'next/navigation'

export default function AdminDashboardRoot() {
  redirect('/dashboard/admin/verification')
}
