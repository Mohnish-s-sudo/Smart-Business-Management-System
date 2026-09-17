/**
 * LTheme.tsx — Light-theme design tokens + shared primitives for all Owner pages.
 * Every Owner page imports from here. No dark classes used here.
 */
'use client'
import React from 'react'
import { X } from 'lucide-react'
import { useEffect } from 'react'

// ─── Design tokens ────────────────────────────────────────────────────────────
export const L = {
  bg:          '#F8FAFC',
  card:        '#FFFFFF',
  cardHover:   '#F8FAFC',
  border:      '#E2E8F0',
  borderFocus: '#2563EB',
  text:        '#0F172A',
  textSub:     '#475569',
  textMuted:   '#94A3B8',
  // primary blue
  blue:        '#2563EB',
  blueDark:    '#1D4ED8',
  blueLt:      '#EFF6FF',
  blueMid:     '#BFDBFE',
  // green
  green:       '#16A34A',
  greenLt:     '#F0FDF4',
  greenMid:    '#BBF7D0',
  // amber
  amber:       '#D97706',
  amberLt:     '#FFFBEB',
  amberMid:    '#FDE68A',
  // red
  red:         '#DC2626',
  redLt:       '#FEF2F2',
  redMid:      '#FECACA',
  // purple (AI only)
  purple:      '#7C3AED',
  purpleLt:    '#F5F3FF',
  purpleMid:   '#DDD6FE',
  // shadows
  shadow:      '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
  shadowMd:    '0 4px 16px rgba(0,0,0,0.07)',
  shadowLg:    '0 8px 32px rgba(0,0,0,0.10)',
}

// ─── LCard ────────────────────────────────────────────────────────────────────
interface LCardProps {
  children: React.ReactNode
  style?: React.CSSProperties
  className?: string
  padding?: number
}
export function LCard({ children, style = {}, padding = 20 }: LCardProps) {
  return (
    <div style={{
      background: L.card, border: `1px solid ${L.border}`,
      borderRadius: 16, padding,
      boxShadow: L.shadow,
      ...style,
    }}>
      {children}
    </div>
  )
}

// ─── LCardHead ────────────────────────────────────────────────────────────────
export function LCardHead({
  title, subtitle, icon, right, style = {},
}: {
  title: string
  subtitle?: string
  icon?: React.ReactNode
  right?: React.ReactNode
  style?: React.CSSProperties
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16, gap: 12, ...style }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {icon}
        <div>
          <p style={{ fontSize: 14, fontWeight: 700, color: L.text, margin: 0 }}>{title}</p>
          {subtitle && <p style={{ fontSize: 11, color: L.textMuted, margin: 0 }}>{subtitle}</p>}
        </div>
      </div>
      {right && <div style={{ flexShrink: 0 }}>{right}</div>}
    </div>
  )
}

// ─── LPageHeader ──────────────────────────────────────────────────────────────
export function LPageHeader({
  title, subtitle, right,
}: {
  title: string; subtitle?: string; right?: React.ReactNode
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, gap: 16, flexWrap: 'wrap' }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: L.text, margin: 0, letterSpacing: '-0.4px' }}>{title}</h1>
        {subtitle && <p style={{ fontSize: 13, color: L.textMuted, margin: '3px 0 0' }}>{subtitle}</p>}
      </div>
      {right && <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>{right}</div>}
    </div>
  )
}

// ─── LStatCard ────────────────────────────────────────────────────────────────
export function LStatCard({
  label, value, sub, icon, accent, accentLt, accentMid, loading = false,
}: {
  label: string; value: string; sub?: string
  icon: React.ReactNode
  accent: string; accentLt: string; accentMid: string
  loading?: boolean
}) {
  return (
    <div style={{
      background: L.card, border: `1px solid ${L.border}`,
      borderRadius: 14, padding: '16px 18px', boxShadow: L.shadow,
      transition: 'border-color 0.15s, box-shadow 0.15s',
    }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = accentMid; (e.currentTarget as HTMLDivElement).style.boxShadow = L.shadowMd }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = L.border; (e.currentTarget as HTMLDivElement).style.boxShadow = L.shadow }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: L.textSub, margin: 0 }}>{label}</p>
        <div style={{ width: 34, height: 34, borderRadius: 9, background: accentLt, border: `1px solid ${accentMid}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: accent }}>
          {icon}
        </div>
      </div>
      {loading ? (
        <><LBone h={22} w="65%" /><div style={{ height: 6 }} /><LBone h={12} w="40%" /></>
      ) : (
        <>
          <p style={{ fontSize: 22, fontWeight: 800, color: L.text, margin: '0 0 4px', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.4px' }}>{value}</p>
          {sub && <p style={{ fontSize: 11, color: L.textMuted, margin: 0 }}>{sub}</p>}
        </>
      )}
    </div>
  )
}

// ─── LBadge ──────────────────────────────────────────────────────────────────
type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple' | 'muted'
const BADGE_STYLES: Record<BadgeVariant, { bg: string; color: string; border: string }> = {
  default:  { bg: '#F1F5F9', color: L.textSub,  border: L.border },
  muted:    { bg: '#F8FAFC', color: L.textMuted, border: L.border },
  success:  { bg: '#F0FDF4', color: '#15803D',   border: '#BBF7D0' },
  warning:  { bg: '#FFFBEB', color: '#92400E',   border: '#FDE68A' },
  danger:   { bg: '#FEF2F2', color: '#991B1B',   border: '#FECACA' },
  info:     { bg: '#EFF6FF', color: '#1E40AF',   border: '#BFDBFE' },
  purple:   { bg: '#F5F3FF', color: '#5B21B6',   border: '#DDD6FE' },
}

export function LBadge({ variant = 'default', children }: { variant?: BadgeVariant; children: React.ReactNode }) {
  const s = BADGE_STYLES[variant]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      padding: '2px 8px', borderRadius: 6,
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em',
    }}>
      {children}
    </span>
  )
}

// ─── LButton ──────────────────────────────────────────────────────────────────
interface LBtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md'
  loading?: boolean
  children: React.ReactNode
}
export function LButton({ variant = 'primary', size = 'md', loading, children, style = {}, disabled, ...props }: LBtnProps) {
  const base: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    borderRadius: 9, fontWeight: 600, cursor: disabled || loading ? 'not-allowed' : 'pointer',
    transition: 'all 0.12s', border: 'none', opacity: disabled || loading ? 0.6 : 1,
    fontSize: size === 'sm' ? 12 : 13,
    padding: size === 'sm' ? '6px 12px' : '9px 16px',
  }
  const vs: Record<string, React.CSSProperties> = {
    primary:   { background: L.blue, color: '#fff', boxShadow: '0 2px 8px rgba(37,99,235,0.25)' },
    secondary: { background: '#F1F5F9', color: L.textSub, border: `1px solid ${L.border}` },
    ghost:     { background: 'transparent', color: L.textSub },
    danger:    { background: L.redLt, color: L.red, border: `1px solid ${L.redMid}` },
  }
  return (
    <button {...props} disabled={disabled || loading} style={{ ...base, ...vs[variant], ...style }}>
      {loading && <span style={{ width: 12, height: 12, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', animation: 'lSpin 0.7s linear infinite', display: 'inline-block' }} />}
      {children}
    </button>
  )
}

// ─── LInput ──────────────────────────────────────────────────────────────────
interface LInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}
export function LInput({ label, error, style = {}, ...props }: LInputProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      {label && <label style={{ fontSize: 12, fontWeight: 600, color: L.textSub }}>{label}</label>}
      <input
        {...props}
        style={{
          width: '100%', padding: '8px 12px',
          background: '#F8FAFC', border: `1.5px solid ${error ? L.red : L.border}`,
          borderRadius: 9, fontSize: 13, color: L.text, outline: 'none',
          transition: 'border-color 0.15s',
          ...style,
        }}
        onFocus={e => { e.target.style.borderColor = L.blue; props.onFocus?.(e) }}
        onBlur={e => { e.target.style.borderColor = error ? L.red : L.border; props.onBlur?.(e) }}
      />
      {error && <p style={{ fontSize: 11, color: L.red, margin: 0 }}>{error}</p>}
    </div>
  )
}

// ─── LSelect ─────────────────────────────────────────────────────────────────
interface LSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
}
export function LSelect({ label, children, style = {}, ...props }: LSelectProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      {label && <label style={{ fontSize: 12, fontWeight: 600, color: L.textSub }}>{label}</label>}
      <select
        {...props}
        style={{
          width: '100%', padding: '8px 12px',
          background: '#F8FAFC', border: `1.5px solid ${L.border}`,
          borderRadius: 9, fontSize: 13, color: L.text, outline: 'none',
          cursor: 'pointer', appearance: 'none', transition: 'border-color 0.15s',
          ...style,
        }}
        onFocus={e => { e.target.style.borderColor = L.blue }}
        onBlur={e => { e.target.style.borderColor = L.border }}
      >
        {children}
      </select>
    </div>
  )
}

// ─── LDrawer ─────────────────────────────────────────────────────────────────
interface LDrawerProps {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode
}
export function LDrawer({ open, onClose, title, children }: LDrawerProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <>
      {open && <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 40, background: 'rgba(15,23,42,0.35)', backdropFilter: 'blur(2px)' }} />}
      <div style={{
        position: 'fixed', top: 0, right: 0, height: '100%', zIndex: 50,
        width: '100%', maxWidth: 480,
        background: '#FFFFFF', borderLeft: `1px solid ${L.border}`,
        boxShadow: L.shadowLg,
        transform: open ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.25s ease',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px', borderBottom: `1px solid ${L.border}` }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: L.text, margin: 0 }}>{title}</h2>
          <button onClick={onClose} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 8, border: `1px solid ${L.border}`, background: '#F8FAFC', cursor: 'pointer', color: L.textMuted }}>
            <X style={{ width: 14, height: 14 }} />
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>{children}</div>
      </div>
      <style>{`@keyframes lSpin { to { transform: rotate(360deg); } }`}</style>
    </>
  )
}

// ─── LTable ──────────────────────────────────────────────────────────────────
export function LTable({ headers, children, loading = false, emptyMsg = 'No records found.' }: {
  headers: string[]; children: React.ReactNode; loading?: boolean; emptyMsg?: string
}) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: `1.5px solid ${L.border}` }}>
            {headers.map(h => (
              <th key={h} style={{ textAlign: 'left', padding: '9px 14px', fontSize: 11, fontWeight: 700, color: L.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', background: '#F8FAFC', whiteSpace: 'nowrap' }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
      {loading && <LBone h={200} style={{ margin: '8px 0' }} />}
    </div>
  )
}

export function LTR({ children, onClick, danger = false }: { children: React.ReactNode; onClick?: () => void; danger?: boolean }) {
  return (
    <tr
      onClick={onClick}
      style={{ borderBottom: `1px solid ${L.border}`, cursor: onClick ? 'pointer' : 'default', background: danger ? L.redLt : 'transparent', transition: 'background 0.1s' }}
      onMouseEnter={e => { if (!danger) (e.currentTarget as HTMLTableRowElement).style.background = '#F8FAFC' }}
      onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = danger ? L.redLt : 'transparent' }}
    >
      {children}
    </tr>
  )
}

export function LTD({ children, style = {}, muted = false }: { children: React.ReactNode; style?: React.CSSProperties; muted?: boolean }) {
  return (
    <td style={{ padding: '11px 14px', color: muted ? L.textMuted : L.text, whiteSpace: 'nowrap', ...style }}>
      {children}
    </td>
  )
}

// ─── LBone (skeleton) ────────────────────────────────────────────────────────
export function LBone({ h = 16, w = '100%', style = {} }: { h?: number; w?: string | number; style?: React.CSSProperties }) {
  return (
    <div style={{
      height: h, width: w, borderRadius: 8,
      background: 'linear-gradient(90deg, #F1F5F9 25%, #E2E8F0 50%, #F1F5F9 75%)',
      backgroundSize: '400px 100%', animation: 'lShimmer 1.4s infinite',
      ...style,
    }} />
  )
}

// ─── LEmpty ──────────────────────────────────────────────────────────────────
export function LEmpty({ icon, message }: { icon?: React.ReactNode; message: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '40px 20px', color: L.textMuted }}>
      {icon && <div style={{ marginBottom: 10, opacity: 0.4 }}>{icon}</div>}
      <p style={{ fontSize: 13, margin: 0 }}>{message}</p>
    </div>
  )
}

// ─── LTabBar ─────────────────────────────────────────────────────────────────
export function LTabBar({ tabs, active, onChange }: { tabs: string[]; active: string; onChange: (t: string) => void }) {
  return (
    <div style={{ display: 'flex', gap: 4, background: '#F1F5F9', borderRadius: 10, padding: 4, width: 'fit-content', marginBottom: 20 }}>
      {tabs.map(t => (
        <button key={t} onClick={() => onChange(t)} style={{
          padding: '6px 16px', borderRadius: 8, border: 'none',
          background: active === t ? L.blue : 'transparent',
          color: active === t ? '#fff' : L.textSub,
          fontSize: 12, fontWeight: 600, cursor: 'pointer',
          transition: 'all 0.12s', textTransform: 'capitalize',
        }}>
          {t}
        </button>
      ))}
    </div>
  )
}

// ─── LFilterBar ──────────────────────────────────────────────────────────────
export function LFilterChips({ options, active, onChange }: { options: { value: string; label: string }[]; active: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
      {options.map(o => (
        <button key={o.value} onClick={() => onChange(o.value)} style={{
          padding: '5px 12px', borderRadius: 20,
          border: `1.5px solid ${active === o.value ? L.blue : L.border}`,
          background: active === o.value ? L.blueLt : '#fff',
          color: active === o.value ? L.blue : L.textSub,
          fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.12s',
        }}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

// ─── Global light-theme CSS (injected once per owner layout) ──────────────────
export function LGlobalStyles() {
  return (
    <style>{`
      @keyframes lShimmer { 0% { background-position: -400px 0; } 100% { background-position: 400px 0; } }
      @keyframes lSpin { to { transform: rotate(360deg); } }
      @keyframes lPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
    `}</style>
  )
}
