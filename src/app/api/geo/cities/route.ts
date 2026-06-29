import { NextRequest } from 'next/server'
import { ok, serverError } from '@/lib/api-response'
import { getCitiesOfCountry } from '@/lib/geo/countries-cities'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const country = searchParams.get('country') ?? ''
    const q       = searchParams.get('q') ?? undefined
    const limit   = Math.min(Number(searchParams.get('limit') ?? 500), 2000)

    if (!country || country.length !== 2) {
      return ok([])
    }

    return ok(getCitiesOfCountry(country, q, limit))
  } catch (err) {
    console.error('[GET /api/geo/cities]', err)
    return serverError()
  }
}
