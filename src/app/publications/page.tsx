'use client'
// src/app/publications/page.tsx
import { useState, useEffect, useCallback } from 'react'
import Navbar from '@/components/common/Navbar'
import Link from 'next/link'
import Image from 'next/image'
import { publicationTypeLabel, PUBLICATION_TYPE_COLORS } from '@/lib/publications/constants'

const TYPE_FILTER_KEYS = ['', 'ARTICLE', 'RESEARCH', 'CASE_STUDY', 'TIP', 'ANNOUNCEMENT'] as const

interface Pub {
  id: string; title: string; summary?: string; excerpt?: string; type: string
  author?: string; authorSpecialty?: string; tags: string[]
  viewCount: number; likeCount: number; publishedAt?: string; coverUrl?: string
}

export default function PublicationsPage() {
  const [pubs,    setPubs]    = useState<Pub[]>([])
  const [loading, setLoading] = useState(true)
  const [search,  setSearch]  = useState('')
  const [type,    setType]    = useState('')
  const [page,    setPage]    = useState(1)
  const [total,   setTotal]   = useState(0)

  const fetchPubs = useCallback(async () => {
    setLoading(true)
    try {
      const p = new URLSearchParams({ page: String(page), limit: '12' })
      if (search) p.set('search', search)
      if (type)   p.set('type', type)
      const res  = await fetch(`/api/publications?${p}`)
      const data = await res.json()
      setPubs(data.data ?? [])
      setTotal(data.meta?.total ?? 0)
    } catch {}
    finally { setLoading(false) }
  }, [search, type, page])

  useEffect(() => { void fetchPubs() }, [fetchPubs])

  return (
    <div className="min-h-screen bg-slate-950" dir="rtl">
      <Navbar locale="ar" />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-white mb-2">المنشورات الطبية</h1>
          <p className="text-slate-400">مقالات وأبحاث من أطباء موثوقين</p>
        </div>

        {/* بحث وفلتر */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <div className="flex-1 relative">
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              placeholder="ابحث في المنشورات..."
              className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-3 text-white text-sm focus:outline-none focus:border-emerald-500/50 placeholder-slate-500 pr-10"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">🔍</span>
          </div>
          <div className="flex gap-2 flex-wrap">
            {TYPE_FILTER_KEYS.map(t => (
              <button key={t} onClick={() => { setType(t); setPage(1) }}
                className={`px-4 py-2 rounded-xl text-xs font-medium border transition-all
                  ${type === t
                    ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400'
                    : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'}`}>
                {t === '' ? 'الكل' : publicationTypeLabel(t, 'ar')}
              </button>
            ))}
          </div>
        </div>

        {/* المنشورات */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
          </div>
        ) : pubs.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-4xl mb-3">📝</div>
            <p className="text-slate-400">لا توجد منشورات بعد</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
            {pubs.map(pub => (
              <Link key={pub.id} href={`/publications/${pub.id}`}
                className="bg-white/[0.03] border border-white/[0.08] rounded-2xl overflow-hidden hover:border-white/20 transition-all group">
                {pub.coverUrl && (
                  <div className="h-40 overflow-hidden">
                    <Image src={pub.coverUrl} alt={pub.title} width={400} height={160}
                      unoptimized
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  </div>
                )}
                <div className="p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${PUBLICATION_TYPE_COLORS[pub.type] ?? ''}`}>
                      {publicationTypeLabel(pub.type, 'ar')}
                    </span>
                    {pub.tags.slice(0, 2).map(tag => (
                      <span key={tag} className="text-xs text-slate-500 bg-white/5 px-2 py-0.5 rounded">#{tag}</span>
                    ))}
                  </div>
                  <h3 className="text-white font-semibold text-sm mb-2 line-clamp-2 group-hover:text-emerald-400 transition-colors">
                    {pub.title}
                  </h3>
                  {(pub.excerpt || pub.summary) && (
                    <p className="text-slate-400 text-sm line-clamp-3 leading-relaxed mb-2">
                      {pub.excerpt || pub.summary}
                    </p>
                  )}
                  <span className="inline-flex items-center gap-1 text-emerald-400 text-xs font-medium mb-3 group-hover:underline">
                    قراءة المزيد <span aria-hidden>←</span>
                  </span>
                  <div className="flex items-center justify-between mt-auto pt-3 border-t border-white/5">
                    <div>
                      {pub.author && <p className="text-slate-300 text-xs">{pub.author}</p>}
                      {pub.authorSpecialty && <p className="text-slate-500 text-xs">{pub.authorSpecialty}</p>}
                    </div>
                    <div className="flex items-center gap-3 text-slate-500 text-xs">
                      <span>👁 {pub.viewCount}</span>
                      <span>❤️ {pub.likeCount}</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Pagination */}
        {total > 12 && (
          <div className="flex justify-center gap-3">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="px-4 py-2 bg-white/5 border border-white/10 text-slate-300 rounded-xl text-sm disabled:opacity-40">
              ←
            </button>
            <span className="px-4 py-2 text-slate-400 text-sm">{page} / {Math.ceil(total / 12)}</span>
            <button onClick={() => setPage(p => p + 1)} disabled={page >= Math.ceil(total / 12)}
              className="px-4 py-2 bg-white/5 border border-white/10 text-slate-300 rounded-xl text-sm disabled:opacity-40">
              →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
