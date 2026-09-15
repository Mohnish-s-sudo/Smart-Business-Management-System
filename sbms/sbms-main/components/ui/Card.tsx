import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'

interface CardProps {
  className?: string
  children: React.ReactNode
  hover?: boolean
  glow?: boolean
}

export function Card({ className, children, hover = false, glow = false }: CardProps) {
  if (hover) {
    return (
      <motion.div
        whileHover={{ y: -3, boxShadow: '0 20px 40px rgba(0,0,0,0.3)' }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className={cn(
          'bg-[#0E1220] border border-white/6 rounded-2xl p-5 transition-all duration-200',
          glow && 'hover:border-violet-500/25',
          className
        )}
      >
        {children}
      </motion.div>
    )
  }

  return (
    <div className={cn('bg-[#0E1220] border border-white/6 rounded-2xl p-5', className)}>
      {children}
    </div>
  )
}

export function CardHeader({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn('flex items-center justify-between mb-4', className)}>
      {children}
    </div>
  )
}

export function CardTitle({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <h3 className={cn('text-sm font-semibold text-white flex items-center gap-2', className)}>
      {children}
    </h3>
  )
}
