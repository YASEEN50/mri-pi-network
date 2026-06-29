'use client'
// src/app/onboarding/doctor/page.tsx
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import CountrySelect, { CountryCitySelect } from '@/components/geo/CountryCitySelect'

const SPECIALIZATIONS = [
  'طب القلب والأوعية الدموية','طب الأطفال','طب العيون','طب الأسنان',
  'الجراحة العامة','طب النساء والتوليد','طب الأعصاب','الطب الباطني',
  'طب العظام والمفاصل','طب الجلدية','طب الأنف والأذن والحنجرة',
  'طب المسالك البولية','طب الأورام','طب الطوارئ','الطب النفسي',
  'طب الغدد الصماء','طب الكلى','طب الجهاز الهضمي','طب الرئة والصدر',
  'الطب العام','طب الأسرة','التخدير والإنعاش','طب الأشعة',
]

interface Credential {
  title:       string
  institution: string
  country:     string
  year:        string
  level:       string
}

const STEPS = ['البيانات الشخصية', 'المعلومات المهنية', 'الشهادات والمؤهلات', 'المراجعة']

export default function DoctorOnboardingPage() {
  const router  = useRouter()
  const { update } = useSession()

  const [step,      setStep]      = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [error,     setError]     = useState('')

  // الخطوة 1 - بيانات شخصية
  const [personal, setPersonal] = useState({
    firstName: '', lastName: '', phone: '', gender: '', country: 'SA', city: '', bio: '',
  })

  // الخطوة 2 - مهنية
  const [professional, setProfessional] = useState({
    specialization: '', subSpecialization: '', licenseNumber: '',
    yearsOfExperience: '', consultationFee: '',
  })

  // الخطوة 3 - شهادات
  const [credentials, setCredentials] = useState<Credential[]>([
    { title: '', institution: '', country: 'SA', year: String(new Date().getFullYear()), level: 'BACHELOR' },
  ])

  function addCredential() {
    setCredentials(p => [...p, { title: '', institution: '', country: 'SA', year: String(new Date().getFullYear()), level: 'BACHELOR' }])
  }

  function removeCredential(i: number) {
    setCredentials(p => p.filter((_, idx) => idx !== i))
  }

  function updateCredential(i: number, field: string, value: string) {
    setCredentials(p => p.map((c, idx) => idx === i ? { ...c, [field]: value } : c))
  }

  // التحقق من كل خطوة
  function validateStep(): boolean {
    setError('')
    if (step === 0) {
      if (!personal.firstName) { setError('الاسم الأول مطلوب'); return false }
      if (!personal.phone)     { setError('رقم الهاتف مطلوب'); return false }
      if (!personal.gender)    { setError('الجنس مطلوب'); return false }
    }
    if (step === 1) {
      if (!professional.specialization) { setError('التخصص مطلوب'); return false }
      if (!professional.licenseNumber)  { setError('رقم الترخيص مطلوب'); return false }
    }
    if (step === 2) {
      const empty = credentials.find(c => !c.title || !c.institution)
      if (empty) { setError('يرجى إكمال بيانات كل الشهادات أو حذف الفارغة'); return false }
    }
    return true
  }

  function nextStep() {
    if (validateStep()) setStep(s => s + 1)
  }

  async function handleSubmit() {
    if (!validateStep()) return
    setIsLoading(true)
    setError('')
    try {
      const res = await fetch('/api/onboarding/doctor', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          firstName:         personal.firstName,
          lastName:          personal.lastName,
          phone:             personal.phone,
          gender:            personal.gender,
          city:              personal.city,
          country:           personal.country,
          bio:               personal.bio,
          specialization:    professional.specialization,
          subSpecialization: professional.subSpecialization,
          licenseNumber:     professional.licenseNumber,
          yearsOfExperience: professional.yearsOfExperience ? parseInt(professional.yearsOfExperience) : 0,
          consultationFee:   professional.consultationFee ? parseFloat(professional.consultationFee) : undefined,
          credentials:       credentials.filter(c => c.title && c.institution),
        }),
      })
      const data = await res.json()
      if (!res.ok || data.data?.error) { setError(data.data?.message || 'حدث خطأ'); return }
      await update({ isProfileComplete: true })
      router.push('/profile?tab=info')
    } catch { setError('حدث خطأ في الاتصال') }
    finally { setIsLoading(false) }
  }

  const inputCls = "w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-blue-500/50 transition-all"
  const labelCls = "block text-sm text-slate-300 mb-2"

  return (
    <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center p-4" dir="rtl">
      <div className="fixed inset-0 opacity-30"
        style={{backgroundImage:'radial-gradient(circle at 20% 50%, rgba(59,130,246,0.1) 0%, transparent 50%),'+'radial-gradient(circle at 80% 20%, rgba(16,185,129,0.08) 0%, transparent 50%)'}} />

      <div className="relative w-full max-w-xl">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">👨‍⚕️</div>
          <h1 className="text-2xl font-bold text-white">تسجيل طبيب</h1>
          <p className="text-slate-400 text-sm mt-1">أدخل بياناتك المهنية للمراجعة والاعتماد</p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center mb-8">
          {STEPS.map((label, i) => (
            <div key={i} className="flex-1 flex flex-col items-center">
              <div className="flex items-center w-full">
                {i > 0 && <div className="flex-1 h-0.5 transition-all" style={{background: i <= step ? '#3b82f6' : 'rgba(255,255,255,0.1)'}} />}
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all"
                  style={{
                    background: i < step ? '#10b981' : i === step ? '#3b82f6' : 'rgba(255,255,255,0.1)',
                    color: i <= step ? 'white' : '#64748b',
                    border: i === step ? '2px solid rgba(59,130,246,0.5)' : 'none',
                  }}>
                  {i < step ? '✓' : i + 1}
                </div>
                {i < STEPS.length - 1 && <div className="flex-1 h-0.5 transition-all" style={{background: i < step ? '#3b82f6' : 'rgba(255,255,255,0.1)'}} />}
              </div>
              <span className="text-xs mt-1.5 text-center" style={{color: i === step ? '#60a5fa' : '#475569'}}>{label}</span>
            </div>
          ))}
        </div>

        <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6">

          {/* ═══ الخطوة 0: البيانات الشخصية ═══ */}
          {step === 0 && (
            <div className="space-y-4">
              <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
                <span className="w-1 h-5 rounded-full bg-blue-500 inline-block" />
                البيانات الشخصية
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>الاسم الأول <span className="text-red-400">*</span></label>
                  <input value={personal.firstName} onChange={e => setPersonal(p=>({...p,firstName:e.target.value}))}
                    placeholder="محمد" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>الاسم الأخير</label>
                  <input value={personal.lastName} onChange={e => setPersonal(p=>({...p,lastName:e.target.value}))}
                    placeholder="العلي" className={inputCls} />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className={labelCls}>الجنس <span className="text-red-400">*</span></label>
                  <select value={personal.gender} onChange={e => setPersonal(p=>({...p,gender:e.target.value}))}
                    className={inputCls}>
                    <option value="" className="bg-slate-900">اختر</option>
                    <option value="MALE" className="bg-slate-900">ذكر</option>
                    <option value="FEMALE" className="bg-slate-900">أنثى</option>
                  </select>
                </div>
                <CountryCitySelect
                  country={personal.country}
                  city={personal.city}
                  onCountryChange={code => setPersonal(p => ({ ...p, country: code, city: '' }))}
                  onCityChange={city => setPersonal(p => ({ ...p, city }))}
                  inputClassName={inputCls}
                  labelClassName={labelCls}
                />
              </div>
              <div>
                <label className={labelCls}>رقم الهاتف <span className="text-red-400">*</span></label>
                <input value={personal.phone} onChange={e => setPersonal(p=>({...p,phone:e.target.value}))}
                  placeholder="+966 5XX XXX XXX" dir="ltr" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>نبذة مختصرة عنك</label>
                <textarea value={personal.bio} onChange={e => setPersonal(p=>({...p,bio:e.target.value}))}
                  placeholder="اكتب نبذة عن خبرتك وتخصصك واهتماماتك الطبية..."
                  rows={3} className={inputCls + ' resize-none'} />
              </div>
            </div>
          )}

          {/* ═══ الخطوة 1: المعلومات المهنية ═══ */}
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
                <span className="w-1 h-5 rounded-full bg-blue-500 inline-block" />
                المعلومات المهنية
              </h2>
              <div>
                <label className={labelCls}>التخصص الرئيسي <span className="text-red-400">*</span></label>
                <select value={professional.specialization}
                  onChange={e => setProfessional(p=>({...p,specialization:e.target.value}))}
                  className={inputCls}>
                  <option value="" className="bg-slate-900">اختر تخصصك</option>
                  {SPECIALIZATIONS.map(s => <option key={s} value={s} className="bg-slate-900">{s}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>التخصص الفرعي (اختياري)</label>
                <input value={professional.subSpecialization}
                  onChange={e => setProfessional(p=>({...p,subSpecialization:e.target.value}))}
                  placeholder="مثال: طب قلب الأطفال" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>رقم ترخيص مزاولة المهنة <span className="text-red-400">*</span></label>
                <input value={professional.licenseNumber}
                  onChange={e => setProfessional(p=>({...p,licenseNumber:e.target.value}))}
                  placeholder="رقم الترخيص الصادر من الجهة المختصة" dir="ltr" className={inputCls} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>سنوات الخبرة</label>
                  <input type="number" min="0" max="60" value={professional.yearsOfExperience}
                    onChange={e => setProfessional(p=>({...p,yearsOfExperience:e.target.value}))}
                    placeholder="0" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>رسوم الاستشارة (π Pi)</label>
                  <input type="number" min="0" value={professional.consultationFee}
                    onChange={e => setProfessional(p=>({...p,consultationFee:e.target.value}))}
                    placeholder="200" className={inputCls} />
                </div>
              </div>
            </div>
          )}

          {/* ═══ الخطوة 2: الشهادات ═══ */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-white font-semibold flex items-center gap-2">
                  <span className="w-1 h-5 rounded-full bg-blue-500 inline-block" />
                  الشهادات والمؤهلات العلمية
                </h2>
                <button onClick={addCredential}
                  className="text-xs px-3 py-1.5 rounded-lg transition-all"
                  style={{background:'rgba(59,130,246,0.15)',color:'#60a5fa',border:'1px solid rgba(59,130,246,0.25)'}}>
                  + إضافة شهادة
                </button>
              </div>
              <p className="text-slate-400 text-xs mb-4">
                أدخل بيانات الشهادة هنا (اسم، جهة الإصدار). <strong className="text-accent">رفع صور المستندات</strong> يكون في الخطوة التالية: شهادة، رخصة، Dataflow، هوية، وسيلفي.
              </p>

              {credentials.map((c, i) => (
                <div key={i} className="rounded-xl p-4 space-y-3"
                  style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.08)'}}>
                  <div className="flex items-center justify-between">
                    <span className="text-blue-400 text-sm font-medium">شهادة {i + 1}</span>
                    {credentials.length > 1 && (
                      <button onClick={() => removeCredential(i)}
                        className="text-red-400/60 hover:text-red-400 text-xs transition-colors">
                        🗑 حذف
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-slate-400 mb-1 block">المسمى / الدرجة <span className="text-red-400">*</span></label>
                      <input value={c.title} onChange={e => updateCredential(i,'title',e.target.value)}
                        placeholder="مثال: بكالوريوس طب وجراحة"
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500/50" />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 mb-1 block">الدرجة العلمية</label>
                      <select value={c.level} onChange={e => updateCredential(i,'level',e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none">
                        <option value="BACHELOR" className="bg-slate-900">بكالوريوس</option>
                        <option value="MASTER"   className="bg-slate-900">ماجستير</option>
                        <option value="PHD"      className="bg-slate-900">دكتوراه</option>
                        <option value="DIPLOMA"  className="bg-slate-900">دبلوم</option>
                        <option value="BOARD"    className="bg-slate-900">بورد</option>
                        <option value="FELLOWSHIP" className="bg-slate-900">زمالة</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">الجامعة / المؤسسة <span className="text-red-400">*</span></label>
                    <input value={c.institution} onChange={e => updateCredential(i,'institution',e.target.value)}
                      placeholder="مثال: جامعة الملك سعود"
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500/50" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <CountrySelect
                        country={c.country}
                        onCountryChange={v => updateCredential(i, 'country', v)}
                        labelClassName="text-xs text-slate-400 mb-1 block"
                        inputClassName="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 mb-1 block">سنة التخرج</label>
                      <input type="number" value={c.year} onChange={e => updateCredential(i,'year',e.target.value)}
                        min="1970" max={new Date().getFullYear()}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ═══ الخطوة 3: المراجعة ═══ */}
          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
                <span className="w-1 h-5 rounded-full bg-emerald-500 inline-block" />
                مراجعة البيانات
              </h2>

              {/* ملخص البيانات */}
              {[
                { title: 'البيانات الشخصية', items: [
                  { label: 'الاسم', value: `${personal.firstName} ${personal.lastName}` },
                  { label: 'الجنس', value: personal.gender === 'MALE' ? 'ذكر' : 'أنثى' },
                  { label: 'الهاتف', value: personal.phone },
                  { label: 'المدينة', value: personal.city || '—' },
                  { label: 'الدولة', value: personal.country || '—' },
                ]},
                { title: 'المعلومات المهنية', items: [
                  { label: 'التخصص', value: professional.specialization },
                  { label: 'التخصص الفرعي', value: professional.subSpecialization || '—' },
                  { label: 'رقم الترخيص', value: professional.licenseNumber },
                  { label: 'سنوات الخبرة', value: professional.yearsOfExperience || '0' },
                  { label: 'رسوم الاستشارة', value: professional.consultationFee ? `${professional.consultationFee} π` : '—' },
                ]},
              ].map(section => (
                <div key={section.title} className="rounded-xl p-4"
                  style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.08)'}}>
                  <p className="text-blue-400 text-sm font-medium mb-3">{section.title}</p>
                  <div className="space-y-2">
                    {section.items.map(item => (
                      <div key={item.label} className="flex justify-between">
                        <span className="text-slate-400 text-sm">{item.label}</span>
                        <span className="text-white text-sm">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              <div className="rounded-xl p-4"
                style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.08)'}}>
                <p className="text-blue-400 text-sm font-medium mb-2">الشهادات ({credentials.filter(c=>c.title).length})</p>
                {credentials.filter(c=>c.title).map((c,i) => (
                  <div key={i} className="text-sm text-slate-300 py-1">
                    🎓 {c.title} — {c.institution} ({c.year})
                  </div>
                ))}
              </div>

              <div className="rounded-xl p-4"
                style={{background:'rgba(245,158,11,0.08)',border:'1px solid rgba(245,158,11,0.2)'}}>
                <p className="text-amber-400 text-xs">
                  ⚠️ بعد الإرسال ستُوجَّه إلى الملف الشخصي لرفع الشهادات والوثائق من الشريط الجانبي.
                </p>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mt-4 px-4 py-3 rounded-xl text-sm"
              style={{background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.2)',color:'#f87171'}}>
              {error}
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex gap-3 mt-6">
            {step > 0 && (
              <button onClick={() => setStep(s => s - 1)}
                className="flex-1 py-3 rounded-xl text-sm font-medium transition-all"
                style={{background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',color:'#94a3b8'}}>
                ← السابق
              </button>
            )}
            {step < 3 ? (
              <button onClick={nextStep}
                className="flex-1 py-3 rounded-xl text-white font-semibold text-sm transition-all"
                style={{background:'linear-gradient(135deg,#3b82f6,#6366f1)'}}>
                التالي →
              </button>
            ) : (
              <button onClick={handleSubmit} disabled={isLoading}
                className="flex-1 py-3 rounded-xl text-white font-semibold text-sm transition-all disabled:opacity-50"
                style={{background:'linear-gradient(135deg,#10b981,#0891b2)'}}>
                {isLoading ? 'جاري الإرسال...' : '✅ إرسال الطلب'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
