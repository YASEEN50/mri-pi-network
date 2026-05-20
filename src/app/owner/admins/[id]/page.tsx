'use client'
// src/app/owner/admins/[id]/page.tsx — إدارة أدمن محدد: مهامه وصلاحياته
import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import Navbar from '@/components/common/Navbar'
import Link from 'next/link'

const CATEGORY_COLORS: Record<string,string> = {
  'التحقق':      '#6366f1',
  'المحتوى':     '#f59e0b',
  'المستخدمون':  '#3b82f6',
  'الدعم':       '#10b981',
  'التقارير':    '#8b5cf6',
  'الإدارة':     '#f97316',
}

const PRIORITY_STYLES: Record<string,{bg:string,text:string,label:string}> = {
  LOW:    { bg:'rgba(100,116,139,0.15)', text:'#94a3b8', label:'منخفضة' },
  MEDIUM: { bg:'rgba(59,130,246,0.15)',  text:'#60a5fa', label:'متوسطة' },
  HIGH:   { bg:'rgba(245,158,11,0.15)',  text:'#fbbf24', label:'عالية' },
  URGENT: { bg:'rgba(239,68,68,0.15)',   text:'#f87171', label:'عاجلة' },
}

const TASK_STATUS: Record<string,string> = {
  PENDING:'⏳ معلق', IN_PROGRESS:'🔄 جاري', COMPLETED:'✅ مكتمل', CANCELLED:'❌ ملغي',
}

export default function AdminDetailPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const adminId = params.id as string

  const [admin,       setAdmin]       = useState<any>(null)
  const [permissions, setPermissions] = useState<string[]>([])
  const [allPerms,    setAllPerms]    = useState<any[]>([])
  const [tasks,       setTasks]       = useState<any[]>([])
  const [tab,         setTab]         = useState<'permissions'|'tasks'>('permissions')
  const [loading,     setLoading]     = useState(true)
  const [saving,      setSaving]      = useState(false)
  const [msg,         setMsg]         = useState('')

  // نموذج مهمة جديدة
  const [newTask, setNewTask] = useState({
    title: '', description: '', category: 'VERIFICATION',
    priority: 'MEDIUM', dueDate: '',
  })
  const [showTaskForm, setShowTaskForm] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [permRes, taskRes] = await Promise.all([
        fetch(`/api/admin/permissions?adminId=${adminId}`),
        fetch(`/api/admin/tasks?mine=false`),
      ])
      const [permData, taskData] = await Promise.all([permRes.json(), taskRes.json()])
      setPermissions(permData.data?.permissions ?? [])
      setAllPerms(permData.data?.allPermissions ?? [])
      // فلترة مهام هذا الأدمن
      setTasks((taskData.data ?? []).filter((t: any) => t.assignedTo === adminId))
    } catch {}
    finally { setLoading(false) }
  }, [adminId])

  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/login'); return }
    if (status === 'authenticated' && session?.user?.role !== 'OWNER') { router.push('/unauthorized'); return }
    if (status === 'authenticated') void fetchData()
  }, [status, session, router, fetchData])

  function togglePermission(key: string) {
    setPermissions(p =>
      p.includes(key) ? p.filter(x => x !== key) : [...p, key]
    )
  }

  async function savePermissions() {
    setSaving(true)
    try {
      const res  = await fetch('/api/admin/permissions', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ adminId, permissions }),
      })
      const data = await res.json()
      setMsg(data.data?.error ? '❌ ' + data.data.message : '✅ تم حفظ الصلاحيات')
      setTimeout(() => setMsg(''), 3000)
    } catch {}
    finally { setSaving(false) }
  }

  async function createTask() {
    if (!newTask.title) return
    setSaving(true)
    try {
      await fetch('/api/admin/tasks', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ ...newTask, assignedTo: adminId, dueDate: newTask.dueDate || undefined }),
      })
      setShowTaskForm(false)
      setNewTask({ title:'', description:'', category:'VERIFICATION', priority:'MEDIUM', dueDate:'' })
      setMsg('✅ تم إسناد المهمة')
      setTimeout(() => setMsg(''), 3000)
      fetchData()
    } catch {}
    finally { setSaving(false) }
  }

  async function updateTaskStatus(taskId: string, newStatus: string) {
    await fetch(`/api/admin/tasks/${taskId}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ status: newStatus }),
    })
    fetchData()
  }

  // تجميع الصلاحيات حسب الفئة
  const permsByCategory = allPerms.reduce((acc: any, p: any) => {
    if (!acc[p.category]) acc[p.category] = []
    acc[p.category].push(p)
    return acc
  }, {})

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{background:'#0a0d14'}}>
      <div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
    </div>
  )

  return (
    <div className="min-h-screen" style={{background:'#0a0d14'}} dir="rtl">
      <Navbar locale="ar" />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-6 text-sm">
          <Link href="/owner" className="text-slate-500 hover:text-slate-300 transition-colors">لوحة التحكم</Link>
          <span className="text-slate-600">/</span>
          <Link href="/owner/assign-admin" className="text-slate-500 hover:text-slate-300 transition-colors">المديرون</Link>
          <span className="text-slate-600">/</span>
          <span className="text-white">إدارة الأدمن</span>
        </div>

        {/* Header */}
        <div className="flex items-center gap-4 mb-6 p-5 rounded-2xl"
          style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.08)'}}>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl"
            style={{background:'rgba(99,102,241,0.15)',border:'1px solid rgba(99,102,241,0.25)'}}>
            🛡️
          </div>
          <div className="flex-1">
            <p className="text-white font-bold text-lg">مدير: {adminId.slice(0,8)}...</p>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-xs px-2 py-0.5 rounded-full"
                style={{background:'rgba(16,185,129,0.15)',color:'#34d399',border:'1px solid rgba(16,185,129,0.2)'}}>
                {permissions.length} صلاحية نشطة
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full"
                style={{background:'rgba(59,130,246,0.15)',color:'#60a5fa',border:'1px solid rgba(59,130,246,0.2)'}}>
                {tasks.filter(t => t.status !== 'COMPLETED').length} مهمة نشطة
              </span>
            </div>
          </div>
        </div>

        {msg && (
          <div className={`mb-4 px-4 py-3 rounded-xl text-sm border ${msg.startsWith('✅') ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
            {msg}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-3 mb-6">
          {[
            { k:'permissions', label:'🔑 الصلاحيات' },
            { k:'tasks',       label:'📋 المهام' },
          ].map(t => (
            <button key={t.k} onClick={() => setTab(t.k as any)}
              className={`px-5 py-2.5 rounded-xl text-sm font-medium border transition-all
                ${tab === t.k ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* الصلاحيات */}
        {tab === 'permissions' && (
          <div className="space-y-4">
            {Object.entries(permsByCategory).map(([cat, perms]: [string, any]) => (
              <div key={cat} className="rounded-2xl p-5"
                style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.07)'}}>
                <h3 className="font-semibold mb-3 text-sm flex items-center gap-2"
                  style={{color: CATEGORY_COLORS[cat] ?? '#94a3b8'}}>
                  <span className="w-1 h-4 rounded-full inline-block" style={{background: CATEGORY_COLORS[cat]}} />
                  {cat}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {perms.map((p: any) => {
                    const active = permissions.includes(p.key)
                    return (
                      <button key={p.key} onClick={() => togglePermission(p.key)}
                        className="flex items-center justify-between px-4 py-3 rounded-xl border transition-all text-right"
                        style={{
                          background: active ? `${CATEGORY_COLORS[cat]}15` : 'rgba(255,255,255,0.03)',
                          border:     active ? `1px solid ${CATEGORY_COLORS[cat]}40` : '1px solid rgba(255,255,255,0.07)',
                        }}>
                        <span className="text-sm" style={{color: active ? 'white' : '#64748b'}}>{p.label}</span>
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all flex-shrink-0`}
                          style={{
                            background:   active ? CATEGORY_COLORS[cat] : 'transparent',
                            borderColor:  active ? CATEGORY_COLORS[cat] : '#475569',
                          }}>
                          {active && <span className="text-white text-xs">✓</span>}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}

            <button onClick={savePermissions} disabled={saving}
              className="w-full py-3.5 rounded-xl text-white font-semibold text-sm transition-all disabled:opacity-50"
              style={{background:'linear-gradient(135deg,#6366f1,#8b5cf6)'}}>
              {saving ? 'جاري الحفظ...' : `حفظ الصلاحيات (${permissions.length} نشطة)`}
            </button>
          </div>
        )}

        {/* المهام */}
        {tab === 'tasks' && (
          <div className="space-y-4">
            {/* زر إضافة مهمة */}
            <button onClick={() => setShowTaskForm(!showTaskForm)}
              className="w-full py-3 rounded-2xl text-sm font-medium border-2 border-dashed transition-all"
              style={{borderColor:'rgba(16,185,129,0.3)',color:'#34d399',background:'rgba(16,185,129,0.05)'}}>
              + إسناد مهمة جديدة
            </button>

            {/* نموذج مهمة جديدة */}
            {showTaskForm && (
              <div className="rounded-2xl p-5 space-y-4"
                style={{background:'rgba(16,185,129,0.05)',border:'1px solid rgba(16,185,129,0.2)'}}>
                <h3 className="text-white font-semibold text-sm">مهمة جديدة</h3>
                <input value={newTask.title} onChange={e => setNewTask(p=>({...p,title:e.target.value}))}
                  placeholder="عنوان المهمة *"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500/50" />
                <textarea value={newTask.description} onChange={e => setNewTask(p=>({...p,description:e.target.value}))}
                  placeholder="وصف تفصيلي (اختياري)" rows={3}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500/50 resize-none" />
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-slate-400 text-xs mb-1 block">الفئة</label>
                    <select value={newTask.category} onChange={e => setNewTask(p=>({...p,category:e.target.value}))}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none">
                      {['VERIFICATION','MODERATION','SUPPORT','OTHER'].map(c => (
                        <option key={c} value={c} className="bg-slate-900">
                          {{VERIFICATION:'التحقق',MODERATION:'المحتوى',SUPPORT:'الدعم',OTHER:'أخرى'}[c]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-slate-400 text-xs mb-1 block">الأولوية</label>
                    <select value={newTask.priority} onChange={e => setNewTask(p=>({...p,priority:e.target.value}))}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none">
                      {Object.entries(PRIORITY_STYLES).map(([k,v]) => (
                        <option key={k} value={k} className="bg-slate-900">{v.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-slate-400 text-xs mb-1 block">الموعد النهائي</label>
                    <input type="date" value={newTask.dueDate} onChange={e => setNewTask(p=>({...p,dueDate:e.target.value}))}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none" />
                  </div>
                </div>
                <div className="flex gap-3">
                  <button onClick={createTask} disabled={saving || !newTask.title}
                    className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-50 transition-all"
                    style={{background:'linear-gradient(135deg,#10b981,#0891b2)'}}>
                    {saving ? 'جاري الحفظ...' : 'إسناد المهمة'}
                  </button>
                  <button onClick={() => setShowTaskForm(false)}
                    className="flex-1 py-2.5 rounded-xl text-sm font-medium text-slate-300 border border-white/10 bg-white/5">
                    إلغاء
                  </button>
                </div>
              </div>
            )}

            {/* قائمة المهام */}
            {tasks.length === 0 ? (
              <div className="text-center py-12 rounded-2xl" style={{background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.06)'}}>
                <div className="text-3xl mb-2">📋</div>
                <p className="text-slate-500 text-sm">لا توجد مهام مسندة</p>
              </div>
            ) : tasks.map(task => (
              <div key={task.id} className="rounded-2xl p-4"
                style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.07)'}}>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs px-2 py-0.5 rounded-full"
                        style={{background: PRIORITY_STYLES[task.priority]?.bg, color: PRIORITY_STYLES[task.priority]?.text}}>
                        {PRIORITY_STYLES[task.priority]?.label}
                      </span>
                      <span className="text-slate-500 text-xs">{task.category}</span>
                    </div>
                    <p className="text-white font-medium text-sm">{task.title}</p>
                    {task.description && <p className="text-slate-400 text-xs mt-1 line-clamp-2">{task.description}</p>}
                    {task.dueDate && (
                      <p className="text-slate-500 text-xs mt-1">
                        📅 {new Date(task.dueDate).toLocaleDateString('ar-SA')}
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-slate-400 flex-shrink-0">{TASK_STATUS[task.status]}</span>
                </div>
                {task.status !== 'COMPLETED' && task.status !== 'CANCELLED' && (
                  <div className="flex gap-2 mt-3 pt-3 border-t border-white/5">
                    {task.status === 'PENDING' && (
                      <button onClick={() => updateTaskStatus(task.id,'IN_PROGRESS')}
                        className="text-xs px-3 py-1.5 rounded-lg border transition-all"
                        style={{background:'rgba(59,130,246,0.1)',border:'1px solid rgba(59,130,246,0.2)',color:'#60a5fa'}}>
                        تحويل لـ جاري
                      </button>
                    )}
                    <button onClick={() => updateTaskStatus(task.id,'COMPLETED')}
                      className="text-xs px-3 py-1.5 rounded-lg border transition-all"
                      style={{background:'rgba(16,185,129,0.1)',border:'1px solid rgba(16,185,129,0.2)',color:'#34d399'}}>
                      ✓ إكمال
                    </button>
                    <button onClick={() => updateTaskStatus(task.id,'CANCELLED')}
                      className="text-xs px-3 py-1.5 rounded-lg border transition-all"
                      style={{background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.2)',color:'#f87171'}}>
                      إلغاء
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
