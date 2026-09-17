'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, ShoppingCart, Package, Receipt, Wallet,
  Bell, BarChart3, Settings, LogOut, Zap, Brain,
  ChevronRight, Menu, X, TrendingUp,
} from 'lucide-react'

// ─── Nav definition (same routes as existing Sidebar) ─────────────────────────
const NAV = [
  {
    label: 'Overview',
    items: [
      { href: '/dashboard',  label: 'Dashboard',   icon: LayoutDashboard },
      { href: '/sales',      label: 'Sales Track',  icon: ShoppingCart },
      { href: '/inventory',  label: 'Inventory',    icon: Package },
    ],
  },
  {
    label: 'Finance',
    items: [
      { href: '/expenses',   label: 'Expenses',     icon: Receipt },
      { href: '/cashflow',   label: 'Cash Flow',    icon: Wallet },
    ],
  },
  {
    label: 'AI & Reports',
    items: [
      { href: '/profit-pulse', label: 'Profit Pulse AI', icon: Brain,    badge: 'AI' },
      { href: '/reports',      label: 'Reports',          icon: BarChart3 },
      { href: '/insights',     label: 'Analytics',        icon: TrendingUp },
    ],
  },
  {
    label: 'Operations',
    items: [
      { href: '/alerts',    label: 'Alerts',   icon: Bell },
      { href: '/settings',  label: 'Settings', icon: Settings },
    ],
  },
]

// ─── Design tokens ─────────────────────────────────────────────────────────────
const T = {
  sidebar:     '#0F172A',       // dark navy sidebar bg
  sidebarBdr:  '#1E293B',       // sidebar border
  active:      '#2563EB',       // blue-600
  activeBg:    'rgba(37,99,235,0.12)',
  activeBdr:   'rgba(37,99,235,0.30)',
  hoverBg:     'rgba(255,255,255,0.06)',
  text:        '#94A3B8',       // inactive text
  activeText:  '#FFFFFF',
  groupLabel:  '#475569',
  brand:       '#FFFFFF',
  badgeBg:     'rgba(99,102,241,0.18)',
  badgeText:   '#A5B4FC',
  badgeBdr:    'rgba(99,102,241,0.35)',
  userBg:      'rgba(255,255,255,0.05)',
  userBdr:     'rgba(255,255,255,0.08)',
  logoutHover: 'rgba(239,68,68,0.10)',
}

function SidebarContent({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname()
  const router   = useRouter()
  const { user, clearAuth } = useAuthStore()

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    clearAuth()
    router.push('/login')
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: T.sidebar, borderRight: `1px solid ${T.sidebarBdr}`,
    }}>
      {/* Brand */}
      <div style={{ padding: '20px 20px 16px', borderBottom: `1px solid ${T.sidebarBdr}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'linear-gradient(135deg, #2563EB 0%, #4F46E5 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(37,99,235,0.35)',
          }}>
            <Zap style={{ width: 17, height: 17, color: '#fff' }} />
          </div>
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, color: T.brand, letterSpacing: '-0.3px', margin: 0 }}>SBMS</p>
            <p style={{ fontSize: 10, color: '#64748B', margin: 0 }}>Smart Business Monitor</p>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.text, padding: 4 }}>
            <X style={{ width: 16, height: 16 }} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '12px 12px' }}>
        {NAV.map(group => (
          <div key={group.label} style={{ marginBottom: 20 }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: T.groupLabel, textTransform: 'uppercase', letterSpacing: '0.08em', padding: '0 10px', marginBottom: 4 }}>
              {group.label}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {group.items.map(({ href, label, icon: Icon, badge }) => {
                const active = pathname === href || pathname.startsWith(href + '/')
                return (
                  <Link key={href} href={href} onClick={onClose} style={{ textDecoration: 'none' }}>
                    <div
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '8px 10px', borderRadius: 8,
                        background: active ? T.activeBg : 'transparent',
                        border: `1px solid ${active ? T.activeBdr : 'transparent'}`,
                        cursor: 'pointer', transition: 'all 0.12s',
                        color: active ? T.activeText : T.text,
                        fontWeight: active ? 600 : 500,
                        fontSize: 13,
                      }}
                      onMouseEnter={e => { if (!active) (e.currentTarget as HTMLDivElement).style.background = T.hoverBg }}
                      onMouseLeave={e => { if (!active) (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
                    >
                      <Icon style={{ width: 15, height: 15, flexShrink: 0, color: active ? T.active : T.text }} />
                      <span style={{ flex: 1 }}>{label}</span>
                      {badge && (
                        <span style={{
                          fontSize: 9, fontWeight: 700, color: T.badgeText,
                          background: T.badgeBg, border: `1px solid ${T.badgeBdr}`,
                          padding: '1px 5px', borderRadius: 4,
                        }}>
                          {badge}
                        </span>
                      )}
                      {active && <ChevronRight style={{ width: 12, height: 12, color: T.active, flexShrink: 0 }} />}
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User + logout */}
      <div style={{ padding: '12px', borderTop: `1px solid ${T.sidebarBdr}` }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 12px', borderRadius: 8,
          background: T.userBg, border: `1px solid ${T.userBdr}`,
          marginBottom: 6,
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'linear-gradient(135deg, rgba(37,99,235,0.4), rgba(79,70,229,0.4))',
            border: '1px solid rgba(37,99,235,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 700, color: '#93C5FD', flexShrink: 0,
          }}>
            {user?.name?.[0]?.toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: '#F1F5F9', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.name}
            </p>
            <p style={{ fontSize: 10, color: '#64748B', margin: 0, textTransform: 'capitalize' }}>
              {user?.role}
            </p>
          </div>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#22C55E', flexShrink: 0 }} title="Online" />
        </div>
        <button
          onClick={handleLogout}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 12px', borderRadius: 8, border: 'none',
            background: 'transparent', cursor: 'pointer',
            color: '#64748B', fontSize: 13, fontWeight: 500,
            transition: 'all 0.12s',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.background = T.logoutHover
            ;(e.currentTarget as HTMLButtonElement).style.color = '#FCA5A5'
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
            ;(e.currentTarget as HTMLButtonElement).style.color = '#64748B'
          }}
        >
          <LogOut style={{ width: 14, height: 14 }} />
          Sign out
        </button>
      </div>
    </div>
  )
}

// ─── Desktop sidebar ──────────────────────────────────────────────────────────
export function OwnerSidebar() {
  return (
    <aside style={{ position: 'fixed', left: 0, top: 0, width: 240, height: '100%', zIndex: 30 }}>
      <SidebarContent />
    </aside>
  )
}

// ─── Mobile sidebar drawer ────────────────────────────────────────────────────
export function MobileSidebarTrigger() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 36, height: 36, borderRadius: 8,
          border: '1px solid #E2E8F0', background: '#FFF',
          cursor: 'pointer', color: '#475569',
        }}
        aria-label="Open navigation menu"
      >
        <Menu style={{ width: 16, height: 16 }} />
      </button>

      {/* Overlay */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 40,
            background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)',
          }}
          aria-hidden="true"
        />
      )}

      {/* Drawer */}
      <div style={{
        position: 'fixed', left: 0, top: 0, bottom: 0, width: 260, zIndex: 50,
        transform: open ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 0.25s ease',
      }}>
        <SidebarContent onClose={() => setOpen(false)} />
      </div>
    </>
  )
}
