'use client'
// src/components/common/SearchBar.tsx
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/cn'

interface SearchResult {
  doctors:      any[]
  facilities:   any[]
  publications: any[]
}

interface SearchBarProps {
  variant?: 'default' | 'hero'
}

export default function SearchBar({ variant = 'default' }: SearchBarProps) {
  const [query,   setQuery]   = useState('')
  const [results, setResults] = useState<SearchResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [open,    setOpen]    = useState(false)
  const ref   = useRef<HTMLDivElement>(null)
  const timer = useRef<any>(null)

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [])

  useEffect(() => {
    if (!query.trim() || query.length < 2) { setResults(null); setOpen(false); return }
    clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res  = await fetch(`/api/search?q=${encodeURIComponent(query)}&limit=10`)
        const data = await res.json()
        setResults(data.data)
        setOpen(true)
      } catch {}
      finally { setLoading(false) }
    }, 350)
  }, [query])

  const hasResults = results && (
    results.doctors.length > 0 || results.facilities.length > 0 || results.publications.length > 0
  )

  const isHero = variant === 'hero'

  return (
    <div className={cn('relative', isHero && 'w-full')} ref={ref}>
      <div className="relative">
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => query.length >= 2 && setOpen(true)}
          placeholder="ابحث عن طبيب، تخصص..."
          className={cn(
            'bg-surface/80 border border-white/10 rounded-xl px-4 py-2 text-white text-sm placeholder-slate-500',
            'focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all',
            isHero ? 'w-full py-3.5 text-base shadow-card' : 'w-56 focus:w-72',
          )}
          dir="rtl"
        />
        {loading && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2">
            <div className="animate-spin w-3.5 h-3.5 border border-primary border-t-transparent rounded-full" />
          </div>
        )}
      </div>

      {open && (
        <div className={cn(
          'absolute top-full mt-2 bg-surface-elevated border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50',
          isHero ? 'left-0 right-0 w-full' : 'left-0 w-80',
        )}>
          {!hasResults ? (
            <div className="text-center py-6 text-slate-500 text-sm">{`لا توجد نتائج لـ "${query}"`}</div>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              {/* أطباء */}
              {results!.doctors.length > 0 && (
                <div>
                  <div className="px-4 py-2 text-xs text-slate-400 font-medium border-b border-white/5">الأطباء</div>
                  {results!.doctors.map(d => (
                    <Link key={d.id} href={`/doctors/${d.id}`} onClick={() => setOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-all">
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary-400 text-xs font-medium flex-shrink-0">
                        {d.name?.[0] ?? '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate">{d.name}</p>
                        <p className="text-slate-400 text-xs">{d.specialty} · {d.city ?? ''}</p>
                      </div>
                      {d.rating > 0 && <span className="text-yellow-400 text-xs">⭐ {d.rating.toFixed(1)}</span>}
                    </Link>
                  ))}
                </div>
              )}

              {/* منشآت */}
              {results!.facilities.length > 0 && (
                <div>
                  <div className="px-4 py-2 text-xs text-slate-400 font-medium border-b border-white/5 border-t border-t-white/5">المنشآت</div>
                  {results!.facilities.map(f => (
                    <Link key={f.id} href={`/facilities/${f.id}`} onClick={() => setOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-all">
                      <div className="w-8 h-8 rounded-full bg-accent/15 flex items-center justify-center text-accent text-xs font-medium flex-shrink-0">
                        🏥
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate">{f.name}</p>
                        <p className="text-slate-400 text-xs">{f.city ?? ''}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}

              {/* منشورات */}
              {results!.publications.length > 0 && (
                <div>
                  <div className="px-4 py-2 text-xs text-slate-400 font-medium border-b border-white/5 border-t border-t-white/5">المنشورات</div>
                  {results!.publications.map(p => (
                    <Link key={p.id} href={`/publications/${p.id}`} onClick={() => setOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-all">
                      <span className="text-lg flex-shrink-0">📝</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm truncate">{p.title}</p>
                        {p.author && <p className="text-slate-400 text-xs">{p.author}</p>}
                      </div>
                    </Link>
                  ))}
                </div>
              )}

              {(results!.doctors.length > 0 || results!.facilities.length > 0) && (
                <Link
                  href={`/doctors?search=${encodeURIComponent(query)}`}
                  onClick={() => setOpen(false)}
                  className="block px-4 py-3 text-center text-sm text-accent hover:bg-white/5 border-t border-white/5"
                >
                  عرض كل الأطباء ←
                </Link>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
