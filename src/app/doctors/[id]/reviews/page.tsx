'use client'
// src/app/doctors/[id]/reviews/page.tsx — صفحة تقييمات الطبيب (نجوم ومراجعات)

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/common/Navbar'
import StarRating from '@/components/reviews/StarRating'

interface Review {
  id: string
  rating: number
  comment: string | null
  createdAt: string
  client: { name: string }
}

interface DoctorSummary {
  id: string
  fullName: string
  specialization: string
  averageRating: number
  totalReviews: number
}

export default function DoctorReviewsPage() {
  const params = useParams()
  const doctorId = params.id as string

  const [doctor, setDoctor]     = useState<DoctorSummary | null>(null)
  const [reviews, setReviews] = useState<Review[]>([])
  const [page, setPage]       = useState(1)
  const [total, setTotal]     = useState(0)
  const [loading, setLoading] = useState(true)
  const limit = 10

  const loadDoctor = useCallback(async () => {
    const res  = await fetch(`/api/doctors/${doctorId}`)
    const data = await res.json()
    if (data.success && data.data) {
      setDoctor({
        id:              data.data.id,
        fullName:        data.data.fullName,
        specialization:  data.data.specialization,
        averageRating:   data.data.averageRating ?? 0,
        totalReviews:    data.data.totalReviews ?? 0,
      })
    }
  }, [doctorId])

  const loadReviews = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch(`/api/doctors/${doctorId}/reviews?page=${page}&limit=${limit}`)
      const data = await res.json()
      if (data.success) {
        setReviews(data.data ?? [])
        setTotal(data.meta?.total ?? 0)
      }
    } finally {
      setLoading(false)
    }
  }, [doctorId, page])

  useEffect(() => { void loadDoctor() }, [loadDoctor])
  useEffect(() => { void loadReviews() }, [loadReviews])

  const totalPages = Math.max(1, Math.ceil(total / limit))
  const dist = [5, 4, 3, 2, 1].map(star => ({
    star,
    count: reviews.filter(r => r.rating === star).length,
  }))

  return (
    <div className="min-h-screen bg-slate-950" dir="rtl">
      <Navbar locale="ar" />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <Link href={`/doctors/${doctorId}`} className="text-slate-400 hover:text-white text-sm mb-6 inline-block">
          ← العودة لملف الطبيب
        </Link>

        {doctor && (
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-white">تقييمات {doctor.fullName}</h1>
            <p className="text-emerald-400 text-sm mt-1">{doctor.specialization}</p>
          </div>
        )}

        <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6 mb-8">
          <div className="flex flex-col sm:flex-row items-center gap-8">
            <div className="text-center">
              <p className="text-5xl font-bold text-amber-400">
                {(doctor?.averageRating ?? 0).toFixed(1)}
              </p>
              <StarRating value={Math.round(doctor?.averageRating ?? 0)} size="md" />
              <p className="text-slate-500 text-xs mt-2">{doctor?.totalReviews ?? 0} تقييم</p>
            </div>
            <div className="flex-1 w-full space-y-2">
              {dist.map(d => (
                <div key={d.star} className="flex items-center gap-2 text-sm">
                  <span className="text-slate-400 w-4">{d.star}</span>
                  <span className="text-amber-400">★</span>
                  <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-400 rounded-full"
                      style={{
                        width: `${reviews.length ? (d.count / reviews.length) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  <span className="text-slate-500 w-6">{d.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
          </div>
        ) : reviews.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <p className="text-4xl mb-3">⭐</p>
            <p>لا توجد تقييمات بعد</p>
          </div>
        ) : (
          <div className="space-y-4">
            {reviews.map(r => (
              <article
                key={r.id}
                className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-white font-medium">{r.client.name}</p>
                    <p className="text-slate-500 text-xs mt-1">
                      {new Date(r.createdAt).toLocaleDateString('ar-SA', {
                        year: 'numeric', month: 'long', day: 'numeric',
                      })}
                    </p>
                  </div>
                  <StarRating value={r.rating} size="sm" />
                </div>
                {r.comment && (
                  <p className="text-slate-300 text-sm mt-3 leading-relaxed">{r.comment}</p>
                )}
              </article>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex justify-center gap-2 mt-8">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="px-4 py-2 rounded-lg bg-white/5 text-slate-300 disabled:opacity-40"
            >
              السابق
            </button>
            <span className="px-4 py-2 text-slate-400 text-sm">
              {page} / {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
              className="px-4 py-2 rounded-lg bg-white/5 text-slate-300 disabled:opacity-40"
            >
              التالي
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
