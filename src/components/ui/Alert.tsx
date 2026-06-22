import { cn } from '@/lib/cn'

const variants = {
  success: { wrap: 'bg-success/10 border-success/25', text: 'text-success', icon: '✅' },
  error:   { wrap: 'bg-danger/10 border-danger/25', text: 'text-red-400', icon: '⚠️' },
  warning: { wrap: 'bg-warning/10 border-warning/25', text: 'text-warning', icon: '⏳' },
  info:    { wrap: 'bg-primary/10 border-primary/25', text: 'text-primary-400', icon: 'ℹ️' },
} as const

interface AlertProps {
  variant?: keyof typeof variants
  children: React.ReactNode
  className?: string
  title?: string
}

export default function Alert({ variant = 'info', children, className, title }: AlertProps) {
  const v = variants[variant]
  return (
    <div className={cn('flex items-start gap-3 border rounded-xl px-4 py-3', v.wrap, className)}>
      <span className="text-base flex-shrink-0 mt-0.5">{v.icon}</span>
      <div className="min-w-0">
        {title && <p className={cn('text-sm font-semibold mb-0.5', v.text)}>{title}</p>}
        <div className={cn('text-sm leading-relaxed', v.text, !title && 'font-medium')}>{children}</div>
      </div>
    </div>
  )
}
