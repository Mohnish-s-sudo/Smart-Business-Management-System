'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth'
import { Zap, LogOut } from 'lucide-react'

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { user, clearAuth } = useAuthStore()

  useEffect(() => {
    if (!user) router.push('/login')
  }, [user, router])

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    clearAuth()
    router.push('/login')
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-[#0F1117] flex flex-col">
      <header className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-[#1A1D27]">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center">
            <Zap className="w-3.5 h-3.5 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-white">SBMS</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs font-medium text-white">{user.name}</p>
            <p className="text-[10px] text-slate-500 capitalize">{user.role}</p>
          </div>
          <button onClick={logout} className="p-1.5 rounded-lg hover:bg-white/5 text-slate-400 hover:text-red-400 transition-colors">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>
      <main className="flex-1 p-4 max-w-lg mx-auto w-full">
        {children}
      </main>
    </div>
  )
}
