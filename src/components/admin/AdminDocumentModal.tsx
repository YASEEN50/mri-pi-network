'use client'

import { useEffect } from 'react'

interface AdminDocumentModalProps {
  url: string
  mimeType?: string | null
  label: string
  open: boolean
  onClose: () => void
}

export default function AdminDocumentModal({
  url,
  mimeType,
  label,
  open,
  onClose,
}: AdminDocumentModalProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!open) return null

  const isPdf = mimeType === 'application/pdf' || url.split('?')[0].toLowerCase().endsWith('.pdf')

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={label}
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/70"
        aria-label="إغلاق"
        onClick={onClose}
      />
      <div className="relative z-10 w-full sm:max-w-4xl max-h-[92vh] sm:max-h-[88vh] flex flex-col rounded-t-2xl sm:rounded-2xl overflow-hidden bg-[#0f172a] border border-white/10 shadow-2xl">
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/10 shrink-0">
          <p className="text-white text-sm font-medium truncate">{label}</p>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 px-3 py-1.5 rounded-lg text-sm text-slate-300 bg-white/10 hover:bg-white/15 border border-white/10"
          >
            إغلاق
          </button>
        </div>
        <div className="flex-1 overflow-auto p-3 sm:p-4">
          {isPdf ? (
            <iframe
              src={url}
              title={label}
              className="w-full h-[75vh] sm:h-[70vh] rounded-xl border border-white/10 bg-white"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url}
              alt={label}
              className="w-full max-h-[75vh] object-contain rounded-xl border border-white/10 bg-black/30 mx-auto"
            />
          )}
        </div>
      </div>
    </div>
  )
}
