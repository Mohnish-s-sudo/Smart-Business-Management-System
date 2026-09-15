'use client'
import { Bell, Search } from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import Link from 'next/link'
import { motion } from 'framer-motion'

interface TopBarProps {
  title: string
  subtitle?: string
  actions?: React.ReactNode
}

export function TopBar({ title, subtitle, actions }: TopBarProps) {
  const user = useAuthStore(s => s.user)

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="flex items-center justify-between mb-7"
    >
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2">
        {actions}

        {/* Search pill */}
        <div className="hidden md:flex items-center gap-2 px-3 py-2 bg-white/4 border border-white/8 rounded-xl text-sm text-slate-500 cursor-pointer hover:bg-white/6 transition-all duration-150 gap-2 min-w-[160px]">
          <Search className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="text-xs">Quick search…</span>
          <kbd className="ml-auto text-[10px] bg-white/8 px-1.5 py-0.5 rounded-md font-mono">⌘K</kbd>
        </div>

        {user?.role === 'owner' && (
          <Link href="/alerts">
            <motion.div
              whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              className="relative p-2.5 rounded-xl bg-white/4 border border-white/8 text-slate-400 hover:text-white hover:bg-white/7 hover:border-violet-500/30 transition-all duration-150 cursor-pointer"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-[#080B12]" />
            </motion.div>
          </Link>
        )}
      </div>
    </motion.div>
  )
}
