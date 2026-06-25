import { OnCallShiftType } from '@prisma/client'

export function validateOnCallWindow(startsAt: Date, endsAt: Date): string | null {
  if (endsAt <= startsAt) {
    return 'وقت النهاية يجب أن يكون بعد وقت البداية'
  }
  const maxDays = 7
  const diffMs = endsAt.getTime() - startsAt.getTime()
  if (diffMs > maxDays * 24 * 60 * 60 * 1000) {
    return `مدة المناوبة لا تتجاوز ${maxDays} أيام`
  }
  return null
}

export function parseShiftType(value: string): OnCallShiftType | null {
  if (Object.values(OnCallShiftType).includes(value as OnCallShiftType)) {
    return value as OnCallShiftType
  }
  return null
}
