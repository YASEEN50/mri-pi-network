'use client'

import Link from 'next/link'
import { cn } from '@/lib/cn'
import Spinner from './Spinner'

const variants = {
  primary: 'bg-gradient-to-r from-primary to-primary-600 hover:from-primary-400 hover:to-primary text-white shadow-glow-primary border border-primary/30',
  accent:  'bg-gradient-to-r from-accent/90 to-primary hover:from-accent hover:to-primary-400 text-background font-semibold shadow-glow border border-accent/30',
  outline: 'bg-transparent border border-white/15 text-slate-200 hover:border-primary/40 hover:text-white hover:bg-primary/10',
  ghost:   'bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 hover:text-white',
  danger:  'bg-danger/15 border border-danger/30 text-red-400 hover:bg-danger/25',
  success: 'bg-success/15 border border-success/30 text-success hover:bg-success/25',
} as const

const sizes = {
  sm: 'px-3 py-1.5 text-xs rounded-lg',
  md: 'px-5 py-2.5 text-sm rounded-xl',
  lg: 'px-8 py-3.5 text-sm rounded-xl',
} as const

type Variant = keyof typeof variants
type Size = keyof typeof sizes

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  href?: string
}

export default function Button({
  variant = 'primary',
  size = 'md',
  className,
  loading,
  children,
  href,
  disabled,
  ...props
}: ButtonProps) {
  const classes = cn(
    'inline-flex items-center justify-center gap-2 font-semibold transition-all duration-200',
    'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none',
    variants[variant],
    sizes[size],
    className,
  )

  const content = loading ? (<><Spinner size="sm" />{children}</>) : children

  if (href) {
    return <Link href={href} className={classes}>{content}</Link>
  }

  return (
    <button className={classes} disabled={disabled || loading} {...props}>
      {content}
    </button>
  )
}
