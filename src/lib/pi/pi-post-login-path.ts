/** Where to send the user after Pi sign-in (matches middleware onboarding rules). */
export function resolvePostLoginPath(session: {
  user?: {
    role?: string
    isProfileComplete?: boolean
  } | null
} | null | undefined): string {
  const user = session?.user
  if (!user) return '/pi-app.html'

  if (user.isProfileComplete === false) {
    switch (user.role) {
      case 'CLIENT':
        return '/onboarding/client'
      case 'DOCTOR':
        return '/onboarding/doctor'
      case 'FACILITY':
        return '/onboarding/facility'
      default:
        return '/select-role'
    }
  }

  switch (user.role) {
    case 'CLIENT':
      return '/dashboard/client/appointments'
    case 'DOCTOR':
      return '/dashboard/doctor/schedule'
    case 'FACILITY':
      return '/dashboard/facility/overview'
    case 'OWNER':
      return '/owner'
    case 'ADMIN':
      return '/dashboard/admin/verification'
    default:
      return '/dashboard'
  }
}
