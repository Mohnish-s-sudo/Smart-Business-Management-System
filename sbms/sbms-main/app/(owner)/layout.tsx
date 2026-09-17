'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth'
import { OwnerSidebar } from '@/components/layout/OwnerSidebar'

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const user   = useAuthStore(s => s.user)

  useEffect(() => {
    if (!user) { router.push('/login'); return }
    if (user.role !== 'owner') router.push('/staff-ops')
  }, [user, router])

  if (!user || user.role !== 'owner') return null

  return (
    // Scoped light-theme wrapper — does NOT affect staff portal or login pages
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F8FAFC', color: '#0F172A' }}>
      {/* Desktop sidebar — hidden on mobile via CSS inside OwnerSidebar */}
      <div className="owner-sidebar-desktop">
        <OwnerSidebar />
      </div>

      {/* Main content shifts right on desktop */}
      <main style={{ flex: 1, minHeight: '100vh', overflowX: 'hidden' }} className="owner-main-content">
        {children}
      </main>

      <style>{`
        /* Desktop: sidebar is 240px fixed, push main content */
        .owner-sidebar-desktop { display: block; }
        .owner-main-content { margin-left: 240px; }

        /* Mobile: hide fixed sidebar, let mobile drawer handle it */
        @media (max-width: 768px) {
          .owner-sidebar-desktop { display: none; }
          .owner-main-content { margin-left: 0 !important; }
        }
      `}</style>
    </div>
  )
}
