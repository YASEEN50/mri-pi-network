import { City, Country } from 'country-state-city'
import countriesI18n from 'i18n-iso-countries'
import arLocale from 'i18n-iso-countries/langs/ar.json'

countriesI18n.registerLocale(arLocale)

export interface GeoCountry {
  code: string
  name: string
  nameAr: string
  flag: string
}

export interface GeoCity {
  name: string
  stateCode: string
  latitude: string
  longitude: string
}

function localizedCountryName(code: string, fallback: string): string {
  return countriesI18n.getName(code, 'ar') ?? fallback
}

/** كل دول العالم مع الاسم بالعربية */
export function getAllCountries(): GeoCountry[] {
  return Country.getAllCountries()
    .map(c => ({
      code:   c.isoCode,
      name:   c.name,
      nameAr: localizedCountryName(c.isoCode, c.name),
      flag:   c.flag,
    }))
    .sort((a, b) => a.nameAr.localeCompare(b.nameAr, 'ar'))
}

/** مدن دولة معيّنة — مع فلترة اختيارية */
export function getCitiesOfCountry(
  countryCode: string,
  query?: string,
  limit = 500,
): GeoCity[] {
  const code = countryCode.toUpperCase()
  if (!Country.getCountryByCode(code)) return []

  let cities = City.getCitiesOfCountry(code) ?? []

  if (query?.trim()) {
    const q = query.trim().toLowerCase()
    cities = cities.filter(c => c.name.toLowerCase().includes(q))
  }

  cities.sort((a, b) => a.name.localeCompare(b.name))

  return cities.slice(0, limit).map(c => ({
    name:      c.name,
    stateCode: c.stateCode,
    latitude:  c.latitude ?? '',
    longitude: c.longitude ?? '',
  }))
}

/** إحداثيات تقريبية لمدينة */
export function resolveCityCoords(
  countryCode: string | null | undefined,
  cityName: string | null | undefined,
): [number, number] | null {
  if (!cityName?.trim()) return null

  const name = cityName.trim().toLowerCase()
  const code = countryCode?.toUpperCase()

  if (code) {
    const match = (City.getCitiesOfCountry(code) ?? []).find(
      c => c.name.toLowerCase() === name,
    )
    if (match?.latitude && match?.longitude) {
      return [parseFloat(match.latitude), parseFloat(match.longitude)]
    }
  }

  const partial = (code ? City.getCitiesOfCountry(code) ?? [] : City.getAllCities())
    .find(c =>
      c.name.toLowerCase().includes(name) || name.includes(c.name.toLowerCase()),
    )
  if (partial?.latitude && partial?.longitude) {
    return [parseFloat(partial.latitude), parseFloat(partial.longitude)]
  }

  return null
}

export function getCountryLabel(code: string): string {
  const c = Country.getCountryByCode(code.toUpperCase())
  if (!c) return code
  return localizedCountryName(c.isoCode, c.name)
}
