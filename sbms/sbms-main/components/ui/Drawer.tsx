'use client'
import { cn } from '@/lib/utils'
import { X } from 'lucide-react'
import { useEffect } from 'react'

interface DrawerProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  width?: string
}

export function Drawer({ open, onClose, title, children, width = 'max-w-lg' }: DrawerProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      )}
      <div className={cn(
        'fixed top-0 right-0 h-full z-50 bg-[#1A1D27] border-l border-white/5 shadow-2xl transition-transform duration-300 w-full',
        width,
        open ? 'translate-x-0' : 'translate-x-full'
      )}>
        <div className="flex items-center justify-between p-5 border-b border-white/5">
          <h2 className="text-base font-semibold text-white">{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 overflow-y-auto h-[calc(100%-65px)]">{children}</div>
      </div>
    </>
  )
}
