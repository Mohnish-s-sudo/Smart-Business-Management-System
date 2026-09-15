import { cn } from '@/lib/utils'
import { forwardRef } from 'react'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({ label, error, className, ...props }, ref) => {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-xs font-medium text-slate-400">{label}</label>}
      <input
        ref={ref}
        {...props}
        className={cn(
          'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500',
          'focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20',
          'transition-colors',
          error && 'border-red-500/50',
          className
        )}
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
})
Input.displayName = 'Input'
