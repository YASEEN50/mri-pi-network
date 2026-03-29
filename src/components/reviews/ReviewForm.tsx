'use client'
// src/components/reviews/ReviewForm.tsx

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { useTranslations } from 'next-intl'

interface ReviewFormProps {
  doctorId: string
  appointmentId: string
  onSuccess?: () => void
}

export default function ReviewForm({ doctorId, appointmentId, onSuccess }: ReviewFormProps) {
  const t = useTranslations('review')
  const { data: session } = useSession()
  const [rating, setRating] = useState(0)
  const [hovered, setHovered] = useState(0)
  const [comment, setComment] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  if (!session) return (
    <p className="text-slate-400 text-sm text-center py-4">{t('login_required')}</p>
  )

  if (done) return (
    <div className="text-center py-6">
      <div className="text-4xl mb-2">🌟</div>
      <p className="text-emerald-400 font-medium">شكراً على تقييمك!</p>
    </div>
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (rating === 0) { setError('يرجى اختيار تقييم'); return }
    setIsLoading(true); setError('')

    try {
      const res = await fetch(`/api/doctors/${doctorId}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointmentId, rating, comment }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error?.message ?? 'حدث خطأ'); return }
      setDone(true)
      onSuccess?.()
    } catch {
      setError('حدث خطأ')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <p className="text-red-400 text-sm">{error}</p>}

      {/* Stars */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-3">{t('rating')}</label>
        <div className="flex gap-2">
          {[1,2,3,4,5].map((star) => (
            <button key={star} type="button"
              onMouseEnter={() => setHovered(star)}
              onMouseLeave={() => setHovered(0)}
              onClick={() => setRating(star)}
              className="transition-transform hover:scale-110">
              <svg className={`w-8 h-8 transition-colors ${star <= (hovered || rating) ? 'text-amber-400' : 'text-slate-600'}`}
                fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            </button>
          ))}
        </div>
      </div>

      {/* Comment */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">{t('comment')}</label>
        <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={4}
          placeholder={t('comment_placeholder')}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-emerald-500/60 transition-all resize-none" />
      </div>

      <button type="submit" disabled={isLoading || rating === 0}
        className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-all">
        {isLoading ? '...' : t('submit')}
      </button>
    </form>
  )
}
