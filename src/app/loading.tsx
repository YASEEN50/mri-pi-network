// src/app/loading.tsx
export default function Loading() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="animate-spin w-10 h-10 border-2 border-emerald-500 border-t-transparent rounded-full" />
        <p className="text-slate-400 text-sm">جاري التحميل...</p>
      </div>
    </div>
  )
}
