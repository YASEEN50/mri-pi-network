import { redirect } from 'next/navigation'

export default function ClientDashboardRoot() {
  redirect('/dashboard/client/appointments')
}
