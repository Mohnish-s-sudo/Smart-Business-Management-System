'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth'
import { motion } from 'framer-motion'
import { Zap, LogOut } from 'lucide-react'

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { user, token } = useAuthStore()

  useEffect(() => {
    if (!token || !user) { router.replace('/login'); return }
    if (user.role !== 'staff') router.replace('/dashboard')
  }, [token, user, router])

  if (!user || user.role !== 'staff') return null

  return (
    <div className="min-h-screen bg-[#080B12] text-white grid-bg">
      <header className="border-b border-white/5 px-6 py-4 flex items-center justify-between sticky top-0 z-20"
        style={{ background: 'rgba(8,11,18,0.92)', backdropFilter: 'blur(16px)' }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-violet-500/20">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-white tracking-tight">SBMS</p>
            <p className="text-[10px] text-slate-500">Staff Portal</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-violet-500/15 border border-violet-500/20 flex items-center justify-center text-xs font-bold text-violet-300">
              {user.name?.[0]?.toUpperCase()}
            </div>
            <div>
              <p className="text-xs font-semibold text-white">{user.name}</p>
              <p className="text-[10px] text-slate-500 capitalize">{user.role}</p>
            </div>
          </div>
          <button
            onClick={() => { useAuthStore.getState().clearAuth(); router.replace('/login') }}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-red-400 transition-colors px-3 py-2 rounded-xl hover:bg-red-400/5"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign out
          </button>
        </div>
      </header>
      <motion.main
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="p-6"
      >
        {children}
      </motion.main>
    </div>
  )
}
