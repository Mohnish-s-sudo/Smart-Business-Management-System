'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useApi } from '@/hooks/useApi'
import { useAuthStore } from '@/store/auth'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import {
  ShoppingCart, PackagePlus, SlidersHorizontal, ClipboardCheck,
  AlertTriangle, PlusCircle, Bell, LogOut, Play, Square,
  ChevronRight, Clock, X, Check, User
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────
interface DashboardData {
  todayStockAdded: number
  todayExpenses: number
  lowStockCount: number
  recentActivities: { _id: string; action: string; detail: string; createdAt: string }[]
  shiftActive: boolean
}
interface Product { _id: string; name: string; stockQuantity: number }
interface Alert { _id: string; severity: string; message: string; createdAt: string }
type Panel = 'billing' | 'addStock' | 'adjustStock' | 'verify' | 'damage' | 'expense' | 'alerts' | null

// ─── Color palette ────────────────────────────────────────────────────────────
const C = {
  bg: '#F8FAFC',
  card: '#FFFFFF',
  primary: '#6366F1',
  primaryLight: '#EEF2FF',
  success: '#22C55E',
  successLight: '#F0FDF4',
  warning: '#F59E0B',
  warningLight: '#FFFBEB',
  danger: '#EF4444',
  dangerLight: '#FEF2F2',
  border: '#E2E8F0',
  text: '#0F172A',
  muted: '#64748B',
  subtle: '#94A3B8',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function getActionDot(action: string) {
  if (action?.includes('SHIFT')) return C.primary
  if (action?.includes('STOCK') || action?.includes('ADD')) return C.success
  if (action?.includes('EXPENSE')) return C.warning
  if (action?.includes('DAMAGE')) return C.danger
  return C.muted
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label style={{ fontSize: 12, fontWeight: 500, color: C.muted, display: 'block', marginBottom: 6 }}>
      {children}
    </label>
  )
}

function StyledInput({
  value, onChange, type = 'text', placeholder = '', min,
}: {
  value: string; onChange: (v: string) => void; type?: string; placeholder?: string; min?: string
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      min={min}
      style={{
        width: '100%', padding: '10px 12px', borderRadius: 10,
        border: `1.5px solid ${C.border}`, background: C.bg,
        fontSize: 14, color: C.text, outline: 'none',
        transition: 'border-color 0.15s',
      }}
      onFocus={e => (e.target.style.borderColor = C.primary)}
      onBlur={e => (e.target.style.borderColor = C.border)}
    />
  )
}

function StyledSelect({
  value, onChange, children,
}: {
  value: string; onChange: (v: string) => void; children: React.ReactNode
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        width: '100%', padding: '10px 12px', borderRadius: 10,
        border: `1.5px solid ${C.border}`, background: C.bg,
        fontSize: 14, color: C.text, outline: 'none', cursor: 'pointer',
        appearance: 'none',
      }}
      onFocus={e => (e.target.style.borderColor = C.primary)}
      onBlur={e => (e.target.style.borderColor = C.border)}
    >
      {children}
    </select>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function StaffPortal() {
  const { apiFetch } = useApi()
  const router = useRouter()
  const user = useAuthStore(s => s.user)
  const clearAuth = useAuthStore(s => s.clearAuth)

  // State
  const [dash, setDash] = useState<DashboardData | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [panel, setPanel] = useState<Panel>(null)
  const [shiftActive, setShiftActive] = useState(false)
  const [shiftLoading, setShiftLoading] = useState(false)
  const [time, setTime] = useState(new Date())

  // Form state
  const [selectedProduct, setSelectedProduct] = useState('')
  const [quantity, setQuantity] = useState('')
  const [adjustment, setAdjustment] = useState('')
  const [actualStock, setActualStock] = useState('')
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const [expCategory, setExpCategory] = useState('Supplies')
  const [expAmount, setExpAmount] = useState('')
  const [expNote, setExpNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Clock
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  // Data loading
  const loadDash = useCallback(() => {
    apiFetch<DashboardData>('/api/staff/dashboard')
      .then(d => { setDash(d); setShiftActive(d.shiftActive ?? false) })
      .catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const loadProducts = useCallback(() => {
    apiFetch<Product[]>('/api/products').then(setProducts).catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadDash(); loadProducts() }, [loadDash, loadProducts])

  // Panel open
  function openPanel(p: Panel) {
    setPanel(p)
    setSelectedProduct(''); setQuantity(''); setAdjustment('')
    setActualStock(''); setReason(''); setNote('')
    setExpAmount(''); setExpNote('')
    if (p === 'alerts') apiFetch<Alert[]>('/api/staff/alerts').then(setAlerts).catch(() => {})
    if (p === 'addStock' || p === 'adjustStock' || p === 'damage' || p === 'verify') loadProducts()
  }

  // Shift toggle
  async function toggleShift() {
    setShiftLoading(true)
    try {
      if (!shiftActive) {
        await apiFetch('/api/staff/shift/start', { method: 'POST' })
        toast.success('Shift started — have a great day!')
        setShiftActive(true)
      } else {
        await apiFetch('/api/staff/shift/end', { method: 'POST' })
        toast.success('Shift ended — great work!')
        setShiftActive(false)
      }
      loadDash()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    } finally {
      setShiftLoading(false)
    }
  }

  // Action handlers
  async function handleAddStock() {
    if (!selectedProduct || !quantity) return
    setSubmitting(true)
    try {
      await apiFetch('/api/staff/stock/add', {
        method: 'POST',
        body: JSON.stringify({ productId: selectedProduct, quantity: parseInt(quantity), note }),
      })
      toast.success('Stock added successfully')
      loadDash(); loadProducts(); setPanel(null)
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Failed') }
    finally { setSubmitting(false) }
  }

  async function handleAdjust() {
    if (!selectedProduct || !adjustment) return
    setSubmitting(true)
    try {
      await apiFetch('/api/staff/stock/adjust', {
        method: 'POST',
        body: JSON.stringify({ productId: selectedProduct, adjustment: parseInt(adjustment), reason }),
      })
      toast.success('Stock adjusted')
      loadDash(); loadProducts(); setPanel(null)
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Failed') }
    finally { setSubmitting(false) }
  }

  async function handleDamage() {
    if (!selectedProduct || !quantity) return
    setSubmitting(true)
    try {
      await apiFetch('/api/staff/stock/damage', {
        method: 'POST',
        body: JSON.stringify({ productId: selectedProduct, quantity: parseInt(quantity), reason }),
      })
      toast.success('Damage recorded')
      loadDash(); loadProducts(); setPanel(null)
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Failed') }
    finally { setSubmitting(false) }
  }

  async function handleVerify() {
    if (!selectedProduct || !actualStock) return
    setSubmitting(true)
    try {
      const res = await apiFetch<{ difference: number }>('/api/staff/stock/verify', {
        method: 'POST',
        body: JSON.stringify({ productId: selectedProduct, actualStock: parseInt(actualStock) }),
      })
      if (res.difference > 0) toast.error(`⚠️ ${res.difference} units missing`)
      else toast.success('✓ Stock verified — no discrepancy')
      loadDash(); setPanel(null)
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Failed') }
    finally { setSubmitting(false) }
  }

  async function handleExpense() {
    if (!expAmount) return
    setSubmitting(true)
    try {
      await apiFetch('/api/staff/expenses', {
        method: 'POST',
        body: JSON.stringify({ category: expCategory, amount: parseFloat(expAmount), note: expNote }),
      })
      toast.success('Expense recorded')
      loadDash(); setPanel(null)
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Failed') }
    finally { setSubmitting(false) }
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
    clearAuth()
    router.replace('/login')
  }

  // Date/time formatting
  const dateStr = time.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const timeStr = time.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
  const firstName = user?.name?.split(' ')[0] ?? 'Staff'
  const initials = user?.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) ?? 'ST'

  // Quick actions grid
  const actions = [
    {
      id: 'billing', label: 'Billing', desc: 'Record a sale',
      icon: ShoppingCart, iconColor: C.primary, bg: C.primaryLight, border: '#C7D2FE',
      href: '/staff/billing',
    },
    {
      id: 'addStock', label: 'Add Stock', desc: 'Receive inventory',
      icon: PackagePlus, iconColor: C.success, bg: C.successLight, border: '#BBF7D0',
    },
    {
      id: 'adjustStock', label: 'Adjust Stock', desc: 'Correct quantity',
      icon: SlidersHorizontal, iconColor: '#0EA5E9', bg: '#F0F9FF', border: '#BAE6FD',
    },
    {
      id: 'verify', label: 'Stock Verify', desc: 'Physical count check',
      icon: ClipboardCheck, iconColor: C.warning, bg: C.warningLight, border: '#FDE68A',
    },
    {
      id: 'damage', label: 'Record Damage', desc: 'Log damaged items',
      icon: AlertTriangle, iconColor: C.danger, bg: C.dangerLight, border: '#FECACA',
    },
    {
      id: 'expense', label: 'Add Expense', desc: 'Log business cost',
      icon: PlusCircle, iconColor: '#8B5CF6', bg: '#F5F3FF', border: '#DDD6FE',
    },
    {
      id: 'alerts', label: 'View Alerts', desc: `${dash?.lowStockCount ?? 0} active`,
      icon: Bell, iconColor: '#F97316', bg: '#FFF7ED', border: '#FED7AA',
    },
  ] as const

  const ProductSelect = (
    <div>
      <FieldLabel>Product</FieldLabel>
      <StyledSelect value={selectedProduct} onChange={setSelectedProduct}>
        <option value="">— Select a product —</option>
        {products.map(p => (
          <option key={p._id} value={p._id}>
            {p.name} · {p.stockQuantity} in stock
          </option>
        ))}
      </StyledSelect>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: C.bg, padding: '0 0 40px' }}>
      {/* ── Header ─────────────────────────────────────────────── */}
      <header
        style={{
          position: 'sticky', top: 0, zIndex: 50,
          background: 'rgba(248,250,252,0.92)',
          backdropFilter: 'blur(12px)',
          borderBottom: `1px solid ${C.border}`,
          padding: '0 24px',
        }}
      >
        <div style={{ maxWidth: 820, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64 }}>
          {/* Left: greeting */}
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 18, fontWeight: 700, color: C.text, letterSpacing: '-0.3px' }}>
                Hey {firstName} 👋
              </span>
            </div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 1 }}>
              {dateStr} · <span style={{ fontVariantNumeric: 'tabular-nums', color: C.subtle }}>{timeStr}</span>
            </div>
          </div>

          {/* Right: shift button + avatar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Shift status badge */}
            <div
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '3px 10px', borderRadius: 20,
                background: shiftActive ? C.successLight : '#F1F5F9',
                border: `1px solid ${shiftActive ? '#BBF7D0' : C.border}`,
                fontSize: 11, fontWeight: 600,
                color: shiftActive ? '#15803D' : C.muted,
              }}
            >
              <span
                style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: shiftActive ? C.success : C.subtle,
                  display: 'inline-block',
                  ...(shiftActive ? { animation: 'pulse 2s infinite' } : {}),
                }}
              />
              {shiftActive ? 'On Shift' : 'Off Shift'}
            </div>

            {/* Shift toggle button */}
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={toggleShift}
              disabled={shiftLoading}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 16px', borderRadius: 10, border: 'none',
                background: shiftActive ? C.danger : C.success,
                color: '#fff', fontSize: 13, fontWeight: 600,
                cursor: shiftLoading ? 'not-allowed' : 'pointer',
                opacity: shiftLoading ? 0.7 : 1,
                transition: 'background 0.2s',
                boxShadow: shiftActive
                  ? '0 2px 8px rgba(239,68,68,0.25)'
                  : '0 2px 8px rgba(34,197,94,0.25)',
              }}
            >
              {shiftActive
                ? <><Square style={{ width: 13, height: 13 }} /> Stop Shift</>
                : <><Play style={{ width: 13, height: 13 }} /> Start Shift</>
              }
            </motion.button>

            {/* Avatar */}
            <div style={{ position: 'relative' }}>
              <div
                style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: `linear-gradient(135deg, ${C.primary} 0%, #818CF8 100%)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 700, color: '#fff',
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
                title={user?.name}
              >
                {initials}
              </div>
            </div>

            {/* Logout */}
            <button
              onClick={logout}
              title="Sign out"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 34, height: 34, borderRadius: 8,
                border: `1px solid ${C.border}`, background: C.card,
                cursor: 'pointer', color: C.muted,
                transition: 'color 0.15s, border-color 0.15s',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.color = C.danger
                ;(e.currentTarget as HTMLButtonElement).style.borderColor = '#FECACA'
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.color = C.muted
                ;(e.currentTarget as HTMLButtonElement).style.borderColor = C.border
              }}
            >
              <LogOut style={{ width: 14, height: 14 }} />
            </button>
          </div>
        </div>
      </header>

      {/* ── Main content ───────────────────────────────────────── */}
      <main style={{ maxWidth: 820, margin: '0 auto', padding: '28px 24px 0' }}>

        {/* ── Quick Actions Grid ─────────────────────────────── */}
        <section>
          <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ fontSize: 13, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Quick Actions
            </h2>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: 12,
            }}
          >
            {actions.map((action) => {
              const Icon = action.icon
              const isActive = panel === action.id
              const hasHref = 'href' in action
              return (
                <motion.button
                  key={action.id}
                  onClick={() => {
                    if (hasHref) { router.push((action as typeof action & { href: string }).href); return }
                    openPanel(panel === action.id ? null : action.id as Panel)
                  }}
                  whileHover={{ y: -2, boxShadow: '0 8px 24px rgba(0,0,0,0.07)' }}
                  whileTap={{ scale: 0.98 }}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                    padding: '18px 18px 16px',
                    borderRadius: 20,
                    background: isActive ? action.bg : C.card,
                    border: `1.5px solid ${isActive ? action.border : C.border}`,
                    cursor: 'pointer', textAlign: 'left',
                    transition: 'border-color 0.15s, background 0.15s',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                  }}
                >
                  {/* Icon */}
                  <div
                    style={{
                      width: 44, height: 44, borderRadius: 12,
                      background: action.bg,
                      border: `1px solid ${action.border}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      marginBottom: 12,
                    }}
                  >
                    <Icon style={{ width: 20, height: 20, color: action.iconColor }} />
                  </div>
                  {/* Text */}
                  <p style={{ fontSize: 14, fontWeight: 600, color: C.text, margin: 0 }}>{action.label}</p>
                  <p style={{ fontSize: 12, color: C.subtle, marginTop: 3 }}>{action.desc}</p>
                  {/* Arrow */}
                  <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 3 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: action.iconColor }}>Open</span>
                    <ChevronRight style={{ width: 12, height: 12, color: action.iconColor }} />
                  </div>
                </motion.button>
              )
            })}
          </div>
        </section>

        {/* ── Action Panel ──────────────────────────────────────── */}
        <AnimatePresence>
          {panel && (
            <motion.div
              key={panel}
              initial={{ opacity: 0, y: 10, scale: 0.99 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.99 }}
              transition={{ duration: 0.2 }}
              style={{
                marginTop: 16,
                background: C.card,
                border: `1.5px solid ${C.border}`,
                borderRadius: 20,
                padding: '24px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
              }}
            >
              {/* Panel header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: C.text, margin: 0 }}>
                  {panel === 'billing' && 'Record Sale'}
                  {panel === 'addStock' && 'Add Stock'}
                  {panel === 'adjustStock' && 'Adjust Stock'}
                  {panel === 'verify' && 'Stock Verification'}
                  {panel === 'damage' && 'Record Damage'}
                  {panel === 'expense' && 'Add Expense'}
                  {panel === 'alerts' && 'Active Alerts'}
                </h3>
                <button
                  onClick={() => setPanel(null)}
                  style={{
                    width: 28, height: 28, borderRadius: 8,
                    border: `1px solid ${C.border}`,
                    background: C.bg, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', cursor: 'pointer', color: C.muted,
                  }}
                >
                  <X style={{ width: 13, height: 13 }} />
                </button>
              </div>

              {/* Billing panel → redirect to sale route */}
              {panel === 'billing' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <p style={{ fontSize: 13, color: C.muted, margin: 0 }}>
                    Record a new sale transaction for a customer.
                  </p>
                  <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => router.push('/staff-ops/sale')}
                    style={{
                      width: '100%', padding: '12px 16px', borderRadius: 12,
                      background: C.primary, border: 'none',
                      color: '#fff', fontSize: 14, fontWeight: 600,
                      cursor: 'pointer', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', gap: 8,
                      boxShadow: '0 4px 12px rgba(99,102,241,0.3)',
                    }}
                  >
                    <ShoppingCart style={{ width: 16, height: 16 }} />
                    Go to Billing
                  </motion.button>
                </div>
              )}

              {/* Add Stock */}
              {panel === 'addStock' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {ProductSelect}
                  <div>
                    <FieldLabel>Quantity to Add</FieldLabel>
                    <StyledInput value={quantity} onChange={setQuantity} type="number" min="1" placeholder="e.g. 50" />
                  </div>
                  <div>
                    <FieldLabel>Note (optional)</FieldLabel>
                    <StyledInput value={note} onChange={setNote} placeholder="e.g. Received from supplier" />
                  </div>
                  <PanelActions
                    onConfirm={handleAddStock}
                    onCancel={() => setPanel(null)}
                    disabled={!selectedProduct || !quantity}
                    loading={submitting}
                    confirmColor={C.success}
                  />
                </div>
              )}

              {/* Adjust Stock */}
              {panel === 'adjustStock' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {ProductSelect}
                  <div>
                    <FieldLabel>Adjustment Amount (negative to reduce)</FieldLabel>
                    <StyledInput value={adjustment} onChange={setAdjustment} type="number" placeholder="e.g. -5 or +10" />
                  </div>
                  <div>
                    <FieldLabel>Reason</FieldLabel>
                    <StyledInput value={reason} onChange={setReason} placeholder="e.g. Counting correction" />
                  </div>
                  <PanelActions
                    onConfirm={handleAdjust}
                    onCancel={() => setPanel(null)}
                    disabled={!selectedProduct || !adjustment}
                    loading={submitting}
                    confirmColor="#0EA5E9"
                  />
                </div>
              )}

              {/* Stock Verification */}
              {panel === 'verify' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div
                    style={{
                      padding: '10px 14px', borderRadius: 10,
                      background: C.warningLight, border: `1px solid #FDE68A`,
                      fontSize: 12, color: '#92400E', display: 'flex', alignItems: 'center', gap: 8,
                    }}
                  >
                    <ClipboardCheck style={{ width: 14, height: 14, flexShrink: 0 }} />
                    Count the physical stock and enter the actual number below.
                  </div>
                  {ProductSelect}
                  <div>
                    <FieldLabel>Actual Physical Count</FieldLabel>
                    <StyledInput value={actualStock} onChange={setActualStock} type="number" min="0" placeholder="e.g. 42" />
                  </div>
                  <PanelActions
                    onConfirm={handleVerify}
                    onCancel={() => setPanel(null)}
                    disabled={!selectedProduct || !actualStock}
                    loading={submitting}
                    confirmColor={C.warning}
                    confirmLabel="Verify"
                  />
                </div>
              )}

              {/* Record Damage */}
              {panel === 'damage' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {ProductSelect}
                  <div>
                    <FieldLabel>Damaged Quantity</FieldLabel>
                    <StyledInput value={quantity} onChange={setQuantity} type="number" min="1" placeholder="e.g. 3" />
                  </div>
                  <div>
                    <FieldLabel>Reason / Description</FieldLabel>
                    <StyledInput value={reason} onChange={setReason} placeholder="e.g. Dropped during handling" />
                  </div>
                  <PanelActions
                    onConfirm={handleDamage}
                    onCancel={() => setPanel(null)}
                    disabled={!selectedProduct || !quantity}
                    loading={submitting}
                    confirmColor={C.danger}
                    confirmLabel="Record Damage"
                  />
                </div>
              )}

              {/* Add Expense */}
              {panel === 'expense' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <FieldLabel>Category</FieldLabel>
                    <StyledSelect value={expCategory} onChange={setExpCategory}>
                      {['Supplies', 'Utilities', 'Logistics', 'Maintenance', 'Miscellaneous'].map(c => (
                        <option key={c}>{c}</option>
                      ))}
                    </StyledSelect>
                  </div>
                  <div>
                    <FieldLabel>Amount (₹)</FieldLabel>
                    <StyledInput value={expAmount} onChange={setExpAmount} type="number" min="0" placeholder="e.g. 500" />
                  </div>
                  <div>
                    <FieldLabel>Note (optional)</FieldLabel>
                    <StyledInput value={expNote} onChange={setExpNote} placeholder="e.g. Monthly stationery" />
                  </div>
                  <PanelActions
                    onConfirm={handleExpense}
                    onCancel={() => setPanel(null)}
                    disabled={!expAmount}
                    loading={submitting}
                    confirmColor="#8B5CF6"
                    confirmLabel="Record Expense"
                  />
                </div>
              )}

              {/* Alerts */}
              {panel === 'alerts' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {alerts.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '24px 0', color: C.subtle, fontSize: 13 }}>
                      <Check style={{ width: 32, height: 32, margin: '0 auto 8px', color: C.success }} />
                      No active alerts — all clear!
                    </div>
                  )}
                  {alerts.map(a => (
                    <div
                      key={a._id}
                      style={{
                        padding: '12px 14px', borderRadius: 12,
                        background: a.severity === 'critical' ? C.dangerLight : a.severity === 'warning' ? C.warningLight : '#F0F9FF',
                        border: `1px solid ${a.severity === 'critical' ? '#FECACA' : a.severity === 'warning' ? '#FDE68A' : '#BAE6FD'}`,
                        display: 'flex', gap: 10, alignItems: 'flex-start',
                      }}
                    >
                      <AlertTriangle
                        style={{
                          width: 15, height: 15, flexShrink: 0, marginTop: 1,
                          color: a.severity === 'critical' ? C.danger : a.severity === 'warning' ? C.warning : '#0EA5E9',
                        }}
                      />
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 500, color: C.text, margin: 0 }}>{a.message}</p>
                        <p style={{ fontSize: 11, color: C.subtle, marginTop: 3 }}>{timeAgo(a.createdAt)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Bottom grid: Recent Activity + Low Stock ─────────── */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: 16,
            marginTop: 20,
          }}
        >
          {/* Recent Activity */}
          <div
            style={{
              background: C.card, borderRadius: 20,
              border: `1.5px solid ${C.border}`,
              padding: '20px 20px 4px',
              boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <Clock style={{ width: 14, height: 14, color: C.muted }} />
              <h3 style={{ fontSize: 13, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
                Recent Activity
              </h3>
            </div>

            {(!dash?.recentActivities || dash.recentActivities.length === 0) && (
              <p style={{ fontSize: 12, color: C.subtle, paddingBottom: 16 }}>No recent activity</p>
            )}

            <div style={{ paddingBottom: 8 }}>
              {dash?.recentActivities?.map((a, i) => (
                <div
                  key={a._id}
                  style={{
                    display: 'flex', gap: 12, paddingBottom: 14,
                    borderLeft: `2px solid ${C.border}`,
                    marginLeft: 6, paddingLeft: 14,
                    position: 'relative',
                  }}
                >
                  {/* Dot */}
                  <span
                    style={{
                      position: 'absolute', left: -5, top: 4,
                      width: 8, height: 8, borderRadius: '50%',
                      background: getActionDot(a.action),
                      border: `2px solid ${C.card}`,
                    }}
                  />
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 13, color: C.text, margin: 0, lineHeight: 1.45 }}>{a.detail}</p>
                    <p style={{ fontSize: 11, color: C.subtle, marginTop: 3 }}>{timeAgo(a.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Low Stock Alerts */}
          <div
            style={{
              background: C.card, borderRadius: 20,
              border: `1.5px solid ${C.border}`,
              padding: '20px',
              boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertTriangle style={{ width: 14, height: 14, color: C.warning }} />
                <h3 style={{ fontSize: 13, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
                  Low Stock
                </h3>
              </div>
              {(dash?.lowStockCount ?? 0) > 0 && (
                <span
                  style={{
                    padding: '2px 8px', borderRadius: 20,
                    background: C.warningLight, border: `1px solid #FDE68A`,
                    fontSize: 11, fontWeight: 700, color: '#92400E',
                  }}
                >
                  {dash?.lowStockCount} items
                </span>
              )}
            </div>

            {(dash?.lowStockCount ?? 0) === 0 ? (
              <div style={{ textAlign: 'center', padding: '12px 0 4px', color: C.subtle, fontSize: 12 }}>
                <Check style={{ width: 24, height: 24, margin: '0 auto 6px', color: C.success }} />
                All stock levels are healthy
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {products
                  .filter(p => p.stockQuantity <= 10)
                  .slice(0, 6)
                  .map(p => (
                    <div
                      key={p._id}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '8px 12px', borderRadius: 10,
                        background: p.stockQuantity === 0 ? C.dangerLight : C.warningLight,
                        border: `1px solid ${p.stockQuantity === 0 ? '#FECACA' : '#FDE68A'}`,
                      }}
                    >
                      <span style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{p.name}</span>
                      <span
                        style={{
                          fontSize: 12, fontWeight: 700,
                          color: p.stockQuantity === 0 ? C.danger : C.warning,
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {p.stockQuantity === 0 ? 'Out' : `${p.stockQuantity} left`}
                      </span>
                    </div>
                  ))
                }
                {(dash?.lowStockCount ?? 0) > 6 && (
                  <p style={{ fontSize: 11, color: C.subtle, textAlign: 'center', marginTop: 4 }}>
                    +{(dash?.lowStockCount ?? 0) - 6} more items
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Pulse animation */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        * { box-sizing: border-box; }
        @media (max-width: 600px) {
          header > div { flex-wrap: wrap; height: auto !important; padding: 12px 0; gap: 8px; }
        }
      `}</style>
    </div>
  )
}

// ─── Reusable panel action buttons ───────────────────────────────────────────
function PanelActions({
  onConfirm, onCancel, disabled, loading, confirmColor, confirmLabel = 'Confirm',
}: {
  onConfirm: () => void
  onCancel: () => void
  disabled: boolean
  loading: boolean
  confirmColor: string
  confirmLabel?: string
}) {
  return (
    <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
      <motion.button
        whileHover={!disabled ? { scale: 1.01 } : {}}
        whileTap={!disabled ? { scale: 0.99 } : {}}
        onClick={onConfirm}
        disabled={disabled || loading}
        style={{
          flex: 1, padding: '11px 0', borderRadius: 10, border: 'none',
          background: disabled || loading ? '#E2E8F0' : confirmColor,
          color: disabled || loading ? C.subtle : '#fff',
          fontSize: 13, fontWeight: 600, cursor: disabled || loading ? 'not-allowed' : 'pointer',
          transition: 'background 0.15s',
        }}
      >
        {loading ? 'Saving…' : confirmLabel}
      </motion.button>
      <button
        onClick={onCancel}
        style={{
          padding: '11px 20px', borderRadius: 10,
          border: `1.5px solid ${C.border}`, background: C.bg,
          color: C.muted, fontSize: 13, fontWeight: 500, cursor: 'pointer',
        }}
      >
        Cancel
      </button>
    </div>
  )
}
