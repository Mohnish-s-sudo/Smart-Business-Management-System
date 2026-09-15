'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, ShoppingCart, Package, Receipt, Wallet,
  Bell, BarChart3, Settings, LogOut, Zap, Brain, ChevronRight
} from 'lucide-react'

const ownerNav = [
  { href: '/dashboard',    label: 'Dashboard',       icon: LayoutDashboard, group: 'main' },
  { href: '/sales',        label: 'Sales Track',     icon: ShoppingCart,    group: 'main' },
  { href: '/inventory',    label: 'Inventory',       icon: Package,         group: 'main' },
  { href: '/expenses',     label: 'Expenses',        icon: Receipt,         group: 'finance' },
  { href: '/cashflow',     label: 'Cash Flow',       icon: Wallet,          group: 'finance' },
  { href: '/profit-pulse', label: 'Profit Pulse AI', icon: Brain,           group: 'ai', badge: 'AI' },
  { href: '/alerts',       label: 'Alerts',          icon: Bell,            group: 'ops' },
  { href: '/reports',      label: 'Reports',         icon: BarChart3,       group: 'ops' },
  { href: '/settings',     label: 'Settings',        icon: Settings,        group: 'ops' },
]

const groups = [
  { key: 'main',    label: 'Overview' },
  { key: 'finance', label: 'Finance' },
  { key: 'ai',      label: 'Intelligence' },
  { key: 'ops',     label: 'Operations' },
]

export function Sidebar() {
  const pathname = usePathname()
  const router   = useRouter()
  const { user, clearAuth } = useAuthStore()

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    clearAuth()
    router.push('/login')
  }

  return (
    <aside className="fixed left-0 top-0 h-full w-64 flex flex-col z-30 border-r border-white/5"
      style={{ background: 'rgba(8,11,18,0.95)', backdropFilter: 'blur(20px)' }}>

      {/* Brand */}
      <div className="p-5 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-violet-500/30 flex-shrink-0">
            <Zap className="w-4.5 h-4.5 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-white tracking-tight">SBMS</p>
            <p className="text-[10px] text-slate-500">Smart Business Monitor</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-4">
        {groups.map(group => {
          const items = ownerNav.filter(n => n.group === group.key)
          if (items.length === 0) return null
          return (
            <div key={group.key}>
              <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest px-3 mb-1.5">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {items.map(({ href, label, icon: Icon, badge }) => {
                  const active = pathname === href || pathname.startsWith(href + '/')
                  return (
                    <Link key={href} href={href}>
                      <motion.div
                        whileHover={{ x: 2 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                        className={cn(
                          'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-150 relative group cursor-pointer',
                          active
                            ? 'bg-violet-500/12 text-violet-300 border border-violet-500/20'
                            : 'text-slate-500 hover:text-slate-200 hover:bg-white/4'
                        )}
                      >
                        {active && (
                          <motion.div
                            layoutId="activeNav"
                            className="absolute inset-0 bg-violet-500/8 rounded-xl border border-violet-500/20"
                            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                          />
                        )}
                        <Icon className={cn('w-4 h-4 flex-shrink-0 relative z-10', active ? 'text-violet-400' : '')} />
                        <span className="flex-1 relative z-10 font-medium">{label}</span>
                        {badge === 'AI' && (
                          <span className="relative z-10 text-[9px] font-bold bg-violet-500/20 text-violet-400 border border-violet-500/30 px-1.5 py-0.5 rounded-md">
                            AI
                          </span>
                        )}
                        {active && <ChevronRight className="w-3 h-3 text-violet-500 relative z-10 flex-shrink-0" />}
                      </motion.div>
                    </Link>
                  )
                })}
              </div>
            </div>
          )
        })}
      </nav>

      {/* User section */}
      <div className="p-3 border-t border-white/5">
        <div className="flex items-center gap-3 px-3 py-2.5 mb-1 rounded-xl bg-white/3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-600/40 to-indigo-600/40 border border-violet-500/20 flex items-center justify-center text-xs font-bold text-violet-300 flex-shrink-0">
            {user?.name?.[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-white truncate">{user?.name}</p>
            <p className="text-[10px] text-slate-500 capitalize">{user?.role}</p>
          </div>
          <div className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-500 hover:text-red-400 hover:bg-red-400/5 transition-all duration-150"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </aside>
  )
}
