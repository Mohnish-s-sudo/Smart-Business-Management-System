/** Light-theme card — used across all owner pages. */
import { cn } from '@/lib/utils'

interface LightCardProps {
  className?: string
  style?: React.CSSProperties
  children: React.ReactNode
  onClick?: () => void
}

export function LightCard({ className, style, children, onClick }: LightCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn('light-card', className)}
      style={{
        background: '#FFFFFF',
        border: '1px solid #E2E8F0',
        borderRadius: 16,
        padding: 20,
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        ...(onClick ? { cursor: 'pointer' } : {}),
        ...style,
      }}
    >
      {children}
    </div>
  )
}

export function LightCardHead({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
      <h3 style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', margin: 0 }}>{title}</h3>
      {action}
    </div>
  )
}
