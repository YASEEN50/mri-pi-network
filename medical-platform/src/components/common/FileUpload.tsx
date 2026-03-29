'use client'
// src/components/common/FileUpload.tsx

import { useState, useRef, useCallback } from 'react'
import { useTranslations } from 'next-intl'

interface FileUploadProps {
  onFileSelect: (file: File) => void
  accept?: string
  maxSizeMB?: number
  label?: string
  currentUrl?: string
}

export default function FileUpload({
  onFileSelect,
  accept = '.pdf,.jpg,.jpeg,.png',
  maxSizeMB = 10,
  label,
  currentUrl,
}: FileUploadProps) {
  const t = useTranslations('upload')
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [selected, setSelected] = useState<File | null>(null)
  const [error, setError] = useState('')

  const validate = (file: File): boolean => {
    setError('')
    if (file.size > maxSizeMB * 1024 * 1024) {
      setError(`حجم الملف يتجاوز ${maxSizeMB}MB`)
      return false
    }
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
    if (!allowed.includes(file.type)) {
      setError('نوع الملف غير مدعوم')
      return false
    }
    return true
  }

  const handleFile = useCallback((file: File) => {
    if (validate(file)) {
      setSelected(file)
      onFileSelect(file)
    }
  }, [onFileSelect, maxSizeMB])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  return (
    <div className="space-y-2">
      {label && <label className="block text-sm font-medium text-slate-300">{label}</label>}

      <div
        onDragEnter={() => setIsDragging(true)}
        onDragLeave={() => setIsDragging(false)}
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`relative flex flex-col items-center justify-center gap-3 p-6 rounded-xl border-2 border-dashed cursor-pointer transition-all ${
          isDragging
            ? 'border-emerald-400 bg-emerald-500/10'
            : selected
            ? 'border-emerald-500/50 bg-emerald-500/5'
            : 'border-white/10 hover:border-white/20 bg-white/[0.02] hover:bg-white/[0.04]'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
        />

        {selected ? (
          <>
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-emerald-400">{selected.name}</p>
              <p className="text-xs text-slate-500 mt-0.5">{(selected.size / 1024).toFixed(1)} KB</p>
            </div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setSelected(null) }}
              className="absolute top-2 end-2 p-1 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-all"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </>
        ) : (
          <>
            <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center">
              <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            </div>
            <p className="text-sm text-slate-400 text-center">
              {t('drag_drop')}{' '}
              <span className="text-emerald-400 underline">{t('browse')}</span>
            </p>
            <p className="text-xs text-slate-600">{t('allowed_types')}</p>
          </>
        )}

        {currentUrl && !selected && (
          <a href={currentUrl} target="_blank" rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-xs text-teal-400 hover:underline">
            عرض الملف الحالي
          </a>
        )}
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}
