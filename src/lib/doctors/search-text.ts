import { Prisma } from '@prisma/client'

/** Text search across doctor name, specialty, and bio — supports multi-word names. */
export function buildDoctorTextSearch(q: string): Prisma.DoctorProfileWhereInput {
  const trimmed = q.trim()
  if (!trimmed) return {}

  const parts = trimmed.split(/\s+/).filter(Boolean)
  const or: Prisma.DoctorProfileWhereInput[] = [
    { firstName: { contains: trimmed, mode: 'insensitive' } },
    { lastName: { contains: trimmed, mode: 'insensitive' } },
    { specialization: { contains: trimmed, mode: 'insensitive' } },
    { bio: { contains: trimmed, mode: 'insensitive' } },
  ]

  if (parts.length >= 2) {
    const [a, b] = parts
    or.push(
      {
        AND: [
          { firstName: { contains: a, mode: 'insensitive' } },
          { lastName: { contains: b, mode: 'insensitive' } },
        ],
      },
      {
        AND: [
          { firstName: { contains: b, mode: 'insensitive' } },
          { lastName: { contains: a, mode: 'insensitive' } },
        ],
      },
    )
    if (parts.length > 2) {
      const rest = parts.slice(1).join(' ')
      or.push(
        {
          AND: [
            { firstName: { contains: parts[0], mode: 'insensitive' } },
            { lastName: { contains: rest, mode: 'insensitive' } },
          ],
        },
      )
    }
  }

  return { OR: or }
}
