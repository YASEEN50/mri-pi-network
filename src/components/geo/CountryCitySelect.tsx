'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

interface GeoCountry {
  code: string
  name: string
  nameAr: string
  flag: string
}

interface Props {
  country: string
  city: string
  onCountryChange: (code: string) => void
  onCityChange: (city: string) => void
  inputClassName?: string
  labelClassName?: string
  defaultCountry?: string
  required?: boolean
  disabled?: boolean
}

const DEFAULT_INPUT =
  'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-blue-500/50 transition-all'

export default function CountrySelect({
  country,
  onCountryChange,
  inputClassName = DEFAULT_INPUT,
  labelClassName = 'block text-sm text-slate-300 mb-2',
  defaultCountry = 'SA',
  required,
  disabled,
}: Omit<Props, 'city' | 'onCityChange'>) {
  const [countries, setCountries] = useState<GeoCountry[]>([])
  const [filter, setFilter] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/geo/countries')
        const json = await res.json()
        if (!cancelled) setCountries(json.data ?? [])
      } catch {
        if (!cancelled) setCountries([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!country && defaultCountry && countries.length > 0) {
      onCountryChange(defaultCountry)
    }
  }, [country, defaultCountry, countries.length, onCountryChange])

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return countries
    return countries.filter(
      c =>
        c.nameAr.includes(filter.trim()) ||
        c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q),
    )
  }, [countries, filter])

  return (
    <div>
      <label className={labelClassName}>
        الدولة {required && <span className="text-red-400">*</span>}
      </label>
      <input
        type="text"
        value={filter}
        onChange={e => setFilter(e.target.value)}
        placeholder="ابحث عن دولة..."
        disabled={disabled || loading}
        className={inputClassName + ' mb-2'}
      />
      <select
        value={country}
        onChange={e => onCountryChange(e.target.value)}
        disabled={disabled || loading}
        className={inputClassName}
      >
        <option value="" className="bg-slate-900">
          {loading ? 'جاري التحميل...' : 'اختر الدولة'}
        </option>
        {filtered.map(c => (
          <option key={c.code} value={c.code} className="bg-slate-900">
            {c.flag} {c.nameAr} ({c.code})
          </option>
        ))}
      </select>
    </div>
  )
}

export function CountryCitySelect({
  country,
  city,
  onCountryChange,
  onCityChange,
  inputClassName = DEFAULT_INPUT,
  labelClassName = 'block text-sm text-slate-300 mb-2',
  defaultCountry = 'SA',
  required,
  disabled,
}: Props) {
  const [countries, setCountries] = useState<GeoCountry[]>([])
  const [cities, setCities] = useState<{ name: string }[]>([])
  const [countryFilter, setCountryFilter] = useState('')
  const [cityFilter, setCityFilter] = useState('')
  const [customCity, setCustomCity] = useState(false)
  const [loadingCountries, setLoadingCountries] = useState(true)
  const [loadingCities, setLoadingCities] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/geo/countries')
        const json = await res.json()
        if (!cancelled) setCountries(json.data ?? [])
      } catch {
        if (!cancelled) setCountries([])
      } finally {
        if (!cancelled) setLoadingCountries(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!country && defaultCountry && countries.length > 0) {
      onCountryChange(defaultCountry)
    }
  }, [country, defaultCountry, countries.length, onCountryChange])

  const loadCities = useCallback(async (code: string, q?: string) => {
    if (!code) { setCities([]); return }
    setLoadingCities(true)
    try {
      const params = new URLSearchParams({ country: code, limit: '500' })
      if (q?.trim()) params.set('q', q.trim())
      const res = await fetch(`/api/geo/cities?${params}`)
      const json = await res.json()
      setCities(json.data ?? [])
    } catch {
      setCities([])
    } finally {
      setLoadingCities(false)
    }
  }, [])

  useEffect(() => {
    if (!country || customCity) return
    const t = setTimeout(() => void loadCities(country, cityFilter), 300)
    return () => clearTimeout(t)
  }, [country, cityFilter, customCity, loadCities])

  const filteredCountries = useMemo(() => {
    const q = countryFilter.trim().toLowerCase()
    if (!q) return countries
    return countries.filter(
      c =>
        c.nameAr.includes(countryFilter.trim()) ||
        c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q),
    )
  }, [countries, countryFilter])

  function handleCountryChange(code: string) {
    onCountryChange(code)
    onCityChange('')
    setCityFilter('')
    setCustomCity(false)
  }

  return (
    <div className="space-y-4">
      <div>
        <label className={labelClassName}>
          الدولة {required && <span className="text-red-400">*</span>}
        </label>
        <input
          type="text"
          value={countryFilter}
          onChange={e => setCountryFilter(e.target.value)}
          placeholder="ابحث عن دولة..."
          disabled={disabled || loadingCountries}
          className={inputClassName + ' mb-2'}
        />
        <select
          value={country}
          onChange={e => handleCountryChange(e.target.value)}
          disabled={disabled || loadingCountries}
          className={inputClassName}
        >
          <option value="" className="bg-slate-900">
            {loadingCountries ? 'جاري التحميل...' : 'اختر الدولة'}
          </option>
          {filteredCountries.map(c => (
            <option key={c.code} value={c.code} className="bg-slate-900">
              {c.flag} {c.nameAr}
            </option>
          ))}
        </select>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className={labelClassName + ' mb-0'}>
            المدينة {required && <span className="text-red-400">*</span>}
          </label>
          <button
            type="button"
            onClick={() => {
              setCustomCity(v => !v)
              if (!customCity) onCityChange('')
            }}
            className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            {customCity ? '← اختر من القائمة' : 'مدينة غير موجودة؟'}
          </button>
        </div>

        {customCity ? (
          <input
            type="text"
            value={city}
            onChange={e => onCityChange(e.target.value)}
            placeholder="اكتب اسم المدينة"
            disabled={disabled}
            className={inputClassName}
          />
        ) : (
          <>
            <input
              type="text"
              value={cityFilter}
              onChange={e => setCityFilter(e.target.value)}
              placeholder={country ? 'ابحث عن مدينة...' : 'اختر الدولة أولاً'}
              disabled={disabled || !country}
              className={inputClassName + ' mb-2'}
            />
            <select
              value={city}
              onChange={e => onCityChange(e.target.value)}
              disabled={disabled || !country || loadingCities}
              className={inputClassName}
              size={Math.min(cities.length, 8) || undefined}
            >
              <option value="" className="bg-slate-900">
                {!country
                  ? 'اختر الدولة أولاً'
                  : loadingCities
                    ? 'جاري تحميل المدن...'
                    : cities.length === 0
                      ? 'لا توجد نتائج — استخدم «مدينة غير موجودة»'
                      : 'اختر المدينة'}
              </option>
              {cities.map(c => (
                <option key={c.name} value={c.name} className="bg-slate-900">
                  {c.name}
                </option>
              ))}
            </select>
            {!loadingCities && country && cities.length >= 500 && (
              <p className="text-slate-500 text-xs mt-1">
                عرض أول 500 نتيجة — استخدم البحث لتضييق النتائج
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
