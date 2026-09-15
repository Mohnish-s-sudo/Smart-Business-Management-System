import { cn } from '@/lib/utils'

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  options: { value: string; label: string }[]
}

export function Select({ label, options, className, ...props }: SelectProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-xs font-medium text-slate-400">{label}</label>}
      <select
        {...props}
        className={cn(
          'w-full bg-[#0F1117] border border-white/10 rounded-lg px-3 py-2 text-sm text-white',
          'focus:outline-none focus:border-indigo-500/50',
          className
        )}
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  )
}
