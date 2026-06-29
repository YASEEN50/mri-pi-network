import { ok, serverError } from '@/lib/api-response'
import { getAllCountries } from '@/lib/geo/countries-cities'

export async function GET() {
  try {
    return ok(getAllCountries())
  } catch (err) {
    console.error('[GET /api/geo/countries]', err)
    return serverError()
  }
}
