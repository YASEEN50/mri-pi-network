import { cn } from '@/lib/cn'

const variants = {
  primary:  'bg-primary/15 text-primary-400 border-primary/30',
  accent:   'bg-accent/10 text-accent border-accent/25',
  success:  'bg-success/15 text-success border-success/30',
  warning:  'bg-warning/15 text-warning border-warning/30',
  danger:   'bg-danger/15 text-red-400 border-danger/30',
  neutral:  'bg-white/5 text-slate-400 border-white/10',
} as const

interface BadgeProps {
  children: React.ReactNode
  variant?: keyof typeof variants
  className?: string
  dot?: boolean
}

export default function Badge({ children, variant = 'neutral', className, dot }: BadgeProps) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-medium rounded-full border',
      variants[variant],
      className,
    )}>
      {dot && <span className={cn('w-1.5 h-1.5 rounded-full', variant === 'success' ? 'bg-success' : variant === 'warning' ? 'bg-warning' : 'bg-accent animate-pulse-soft')} />}
      {children}
    </span>
  )
}
