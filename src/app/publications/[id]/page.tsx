'use client'
// src/app/publications/[id]/page.tsx
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import Navbar from '@/components/common/Navbar'
import Link from 'next/link'

export default function PublicationDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [pub,     setPub]     = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/publications/${params.id}`)
      .then(r => r.json())
      .then(d => {
        if (d.data?.error) { router.push('/publications'); return }
        setPub(d.data)
      })
      .catch(() => router.push('/publications'))
      .finally(() => setLoading(false))
  }, [params.id, router])

  if (loading) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
    </div>
  )
  if (!pub) return null

  return (
    <div className="min-h-screen bg-slate-950" dir="rtl">
      <Navbar locale="ar" />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        {/* Back */}
        <Link href="/publications" className="text-slate-400 hover:text-white text-sm transition-colors mb-6 inline-block">
          ← المنشورات
        </Link>

        {/* Cover */}
        {pub.coverUrl && (
          <div className="h-64 rounded-2xl overflow-hidden mb-8">
            <Image src={pub.coverUrl} alt={pub.title} width={1200} height={256} unoptimized className="w-full h-full object-cover" />
          </div>
        )}

        {/* Tags */}
        <div className="flex flex-wrap gap-2 mb-4">
          {pub.tags?.map((tag: string) => (
            <span key={tag} className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full">
              #{tag}
            </span>
          ))}
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-white mb-4">{pub.title}</h1>

        {/* Meta */}
        <div className="flex items-center gap-4 mb-6 pb-6 border-b border-white/10">
          {pub.author && (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 font-medium text-sm">
                {pub.author[0]}
              </div>
              <div>
                <Link href={`/doctors/${pub.author?.id}`} className="text-white text-sm font-medium hover:text-emerald-400 transition-colors">
                  {pub.author.name ?? pub.author}
                </Link>
                {pub.authorSpecialty && <p className="text-slate-400 text-xs">{pub.author.specialization ?? pub.authorSpecialty}</p>}
              </div>
            </div>
          )}
          <div className="mr-auto flex items-center gap-4 text-slate-400 text-xs">
            <span>👁 {pub.viewCount} مشاهدة</span>
            <span>❤️ {pub.likeCount}</span>
            {pub.publishedAt && (
              <span>{new Date(pub.publishedAt).toLocaleDateString('ar-SA')}</span>
            )}
          </div>
        </div>

        {/* Summary */}
        {pub.summary && (
          <p className="text-slate-300 text-base leading-relaxed mb-6 p-4 bg-white/[0.03] border border-white/[0.08] rounded-xl">
            {pub.summary}
          </p>
        )}

        {/* Content */}
        <div className="prose prose-invert max-w-none">
          <div className="text-slate-300 leading-relaxed whitespace-pre-wrap text-sm">
            {pub.content}
          </div>
        </div>

        {/* Author Card */}
        {pub.author && typeof pub.author === 'object' && (
          <div className="mt-10 p-5 bg-white/[0.03] border border-white/[0.08] rounded-2xl">
            <h3 className="text-white font-semibold mb-3 text-sm">عن الطبيب</h3>
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 font-medium">
                {pub.author.name?.[0] ?? '?'}
              </div>
              <div className="flex-1">
                <p className="text-white font-medium">{pub.author.name}</p>
                <p className="text-slate-400 text-xs mb-1">{pub.author.specialization}</p>
                {pub.author.city && <p className="text-slate-500 text-xs">{pub.author.city}</p>}
                {pub.author.bio && <p className="text-slate-400 text-xs mt-2 line-clamp-2">{pub.author.bio}</p>}
                <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                  <span>⭐ {Number(pub.author.rating).toFixed(1)}</span>
                  <span>{pub.author.reviews} تقييم</span>
                </div>
                {pub.author.id && (
                  <Link href={`/doctors/${pub.author.id}`}
                    className="inline-block mt-3 px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-400 rounded-xl text-xs font-medium transition-all">
                    احجز موعداً
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
