import { NextRequest } from 'next/server'
import { ok, serverError } from '@/lib/api-response'
import { listAvailableInstantDoctors } from '@/lib/instant-consult/service'

export async function GET(req: NextRequest) {
  try {
    const specialization = req.nextUrl.searchParams.get('specialization')
    const doctors = await listAvailableInstantDoctors(specialization)
    return ok(doctors)
  } catch (err) {
    console.error('[GET /api/instant-consult/doctors]', err)
    return serverError()
  }
}
