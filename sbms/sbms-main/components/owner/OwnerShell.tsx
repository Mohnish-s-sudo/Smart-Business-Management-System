/**
 * OwnerShell — shared light-theme page wrapper for all owner pages.
 * Provides: page title, subtitle, optional action buttons, consistent
 * spacing, and the OwnerTopBar header.  Every owner page renders inside
 * this shell so the chrome is always identical.
 */
'use client'
import { OwnerTopBar } from '@/components/layout/OwnerTopBar'

interface Props {
  title: string
  subtitle?: string
  actions?: React.ReactNode
  children: React.ReactNode
  alertCount?: number
}

export function OwnerShell({ title, subtitle, actions, children, alertCount = 0 }: Props) {
  return (
    <div style={{ background: '#F8FAFC', minHeight: '100vh', color: '#0F172A', fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}>
      <OwnerTopBar alertCount={alertCount} />
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '24px 24px 48px' }}>
        {/* Page header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: '#0F172A', margin: 0, letterSpacing: '-0.4px' }}>{title}</h1>
            {subtitle && <p style={{ fontSize: 13, color: '#64748B', margin: '3px 0 0' }}>{subtitle}</p>}
          </div>
          {actions && <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>{actions}</div>}
        </div>
        {children}
      </div>
    </div>
  )
}
