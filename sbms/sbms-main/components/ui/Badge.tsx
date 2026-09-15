import { cn } from '@/lib/utils'

const variants = {
  default:  'bg-slate-500/15 text-slate-400 border-slate-500/20',
  critical: 'bg-red-500/15 text-red-400 border-red-500/25',
  warning:  'bg-amber-500/15 text-amber-400 border-amber-500/25',
  info:     'bg-blue-500/15 text-blue-400 border-blue-500/25',
  success:  'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  ai:       'bg-violet-500/15 text-violet-400 border-violet-500/25',
}

interface BadgeProps {
  variant?: keyof typeof variants
  className?: string
  children: React.ReactNode
}

export function Badge({ variant = 'default', className, children }: BadgeProps) {
  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-semibold border uppercase tracking-wider',
      variants[variant],
      className
    )}>
      {children}
    </span>
  )
}
