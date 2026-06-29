'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import type { Map as LeafletMap, Marker as LeafletMarker } from 'leaflet'
import { coordsForCity, MAP_DEFAULT_CENTER, MAP_DEFAULT_ZOOM } from '@/lib/maps/city-coords'

interface MapDoctor {
  id: string
  fullName: string
  specialization: string
  city: string | null
  averageRating: number
  totalReviews: number
  consultationFee: number | null
  lat: number
  lng: number
}

export default function DoctorsMapView() {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<LeafletMap | null>(null)
  const markersRef = useRef<LeafletMarker[]>([])
  const [doctors, setDoctors] = useState<MapDoctor[]>([])
  const [filtered, setFiltered] = useState<MapDoctor[]>([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<MapDoctor | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadDoctors = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/doctors?limit=100')
      const json = await res.json()
      if (!res.ok) throw new Error(json?.message ?? 'فشل تحميل الأطباء')

      const list: MapDoctor[] = (json.data ?? []).map((d: {
        id: string
        fullName: string
        specialization: string
        city: string | null
        country?: string
        averageRating: number
        totalReviews: number
        consultationFee: number | null
        lat?: number | null
        lng?: number | null
      }, i: number) => {
        const fallback = coordsForCity(d.city, i)
        return {
          ...d,
          lat: d.lat ?? fallback[0],
          lng: d.lng ?? fallback[1],
        }
      })
      setDoctors(list)
      setFiltered(list)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطأ غير متوقع')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadDoctors() }, [loadDoctors])

  useEffect(() => {
    const q = search.trim().toLowerCase()
    if (!q) { setFiltered(doctors); return }
    setFiltered(
      doctors.filter(d =>
        d.fullName.toLowerCase().includes(q) ||
        d.specialization.toLowerCase().includes(q) ||
        (d.city ?? '').toLowerCase().includes(q),
      ),
    )
  }, [search, doctors])

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return

    let cancelled = false

    ;(async () => {
      const L = (await import('leaflet')).default
      await import('leaflet/dist/leaflet.css')

      if (cancelled || !mapRef.current) return

      const map = L.map(mapRef.current, {
        center: MAP_DEFAULT_CENTER,
        zoom: MAP_DEFAULT_ZOOM,
        scrollWheelZoom: true,
      })

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
        maxZoom: 18,
      }).addTo(map)

      mapInstance.current = map
    })()

    return () => {
      cancelled = true
      mapInstance.current?.remove()
      mapInstance.current = null
    }
  }, [])

  useEffect(() => {
    if (!mapInstance.current) return

    ;(async () => {
      const L = (await import('leaflet')).default

      markersRef.current.forEach(m => m.remove())
      markersRef.current = []

      const icon = L.divIcon({
        className: '',
        html: `<div style="width:14px;height:14px;background:#10b981;border:2px solid #fff;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,.35)"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      })

      filtered.forEach(doc => {
        const marker = L.marker([doc.lat, doc.lng], { icon })
          .addTo(mapInstance.current!)
          .on('click', () => setSelected(doc))
        markersRef.current.push(marker)
      })

      if (filtered.length === 1) {
        mapInstance.current!.setView([filtered[0].lat, filtered[0].lng], 11)
      } else if (filtered.length > 1) {
        const bounds = L.latLngBounds(filtered.map(d => [d.lat, d.lng] as [number, number]))
        mapInstance.current!.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 })
      }
    })()
  }, [filtered])

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-180px)] min-h-[480px]">
      {/* شريط البحث + القائمة */}
      <aside className="lg:w-80 shrink-0 flex flex-col gap-3">
        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="ابحث بالاسم أو التخصص أو المدينة..."
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-emerald-500/60"
        />

        {loading && (
          <p className="text-slate-400 text-sm text-center py-4">جاري تحميل الأطباء...</p>
        )}
        {error && (
          <p className="text-red-400 text-sm text-center py-2">{error}</p>
        )}

        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {!loading && filtered.length === 0 && (
            <p className="text-slate-500 text-sm text-center py-6">لا توجد نتائج</p>
          )}
          {filtered.map(doc => (
            <button
              key={doc.id}
              type="button"
              onClick={() => setSelected(doc)}
              className={`w-full text-right p-3 rounded-xl border transition-all
                ${selected?.id === doc.id
                  ? 'bg-emerald-500/15 border-emerald-500/40'
                  : 'bg-white/[0.03] border-white/[0.08] hover:bg-white/[0.06]'}`}
            >
              <p className="text-white font-medium text-sm">{doc.fullName}</p>
              <p className="text-slate-400 text-xs mt-0.5">{doc.specialization}</p>
              <p className="text-slate-500 text-xs">{doc.city ?? '—'}</p>
            </button>
          ))}
        </div>

        <p className="text-slate-600 text-xs text-center">
          {filtered.length} طبيب على الخريطة
        </p>
      </aside>

      {/* الخريطة + بطاقة الطبيب */}
      <div className="flex-1 relative rounded-2xl overflow-hidden border border-white/[0.08]">
        <div ref={mapRef} className="absolute inset-0 z-0 bg-slate-900" />

        {selected && (
          <div className="absolute bottom-4 right-4 left-4 sm:left-auto sm:w-80 z-[1000]
            bg-slate-900/95 backdrop-blur border border-white/10 rounded-2xl p-4 shadow-xl">
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="absolute top-2 left-2 text-slate-500 hover:text-white text-lg leading-none"
              aria-label="إغلاق"
            >
              ×
            </button>
            <h3 className="text-white font-bold pr-6">{selected.fullName}</h3>
            <p className="text-emerald-400 text-sm mt-1">{selected.specialization}</p>
            <p className="text-slate-400 text-xs mt-2">
              {selected.city ?? '—'} · ⭐ {selected.averageRating.toFixed(1)} ({selected.totalReviews})
            </p>
            {selected.consultationFee != null && (
              <p className="text-slate-300 text-sm mt-1">{selected.consultationFee} π</p>
            )}
            <div className="flex gap-2 mt-4">
              <Link
                href={`/doctors/${selected.id}`}
                className="flex-1 text-center py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 rounded-xl text-xs font-medium transition-all"
              >
                عرض الملف
              </Link>
              <Link
                href={`/doctors/${selected.id}#booking`}
                className="flex-1 text-center py-2 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-400 rounded-xl text-xs font-medium transition-all"
              >
                حجز موعد
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
