/** إحداثيات تقريبية للمدن السعودية — للتوافق مع البيانات القديمة (عميل فقط) */
export const SA_CITY_COORDS: Record<string, [number, number]> = {
  'الرياض':   [24.7136, 46.6753],
  'riyadh':   [24.7136, 46.6753],
  'جدة':      [21.4858, 39.1925],
  'jeddah':   [21.4858, 39.1925],
  'مكة':      [21.3891, 39.8579],
  'المدينة':  [24.5247, 39.5692],
  'الدمام':   [26.3927, 49.9777],
  'dammam':   [26.3927, 49.9777],
  'الخبر':    [26.2172, 50.1971],
  'تبوك':     [28.3838, 36.5550],
  'أبها':     [18.2164, 42.5053],
}

const DEFAULT_CENTER: [number, number] = [24.7136, 46.6753]

/** يُرجع إحداثيات المدينة مع jitter بسيط — fallback للعميل عند غياب lat/lng من API */
export function coordsForCity(city: string | null | undefined, index = 0): [number, number] {
  if (!city) return DEFAULT_CENTER
  const key = Object.keys(SA_CITY_COORDS).find(
    k => city.toLowerCase().includes(k.toLowerCase()) || k.toLowerCase().includes(city.toLowerCase()),
  )
  const base = key ? SA_CITY_COORDS[key] : DEFAULT_CENTER
  const jitter = 0.008 * (index % 5)
  return [base[0] + jitter * 0.3, base[1] + jitter * 0.7]
}

export const MAP_DEFAULT_CENTER = DEFAULT_CENTER
export const MAP_DEFAULT_ZOOM = 3
