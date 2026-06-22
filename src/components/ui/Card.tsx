import { cn } from '@/lib/cn'

interface CardProps {
  children: React.ReactNode
  className?: string
  hover?: boolean
  padding?: 'none' | 'sm' | 'md' | 'lg'
}

const paddingMap = {
  none: '',
  sm:   'p-4',
  md:   'p-5',
  lg:   'p-6',
}

export default function Card({ children, className, hover = false, padding = 'md' }: CardProps) {
  return (
    <div className={cn(hover ? 'mpi-card-hover' : 'mpi-card', paddingMap[padding], className)}>
      {children}
    </div>
  )
}
