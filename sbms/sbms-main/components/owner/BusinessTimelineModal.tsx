'use client'
import { useState, useCallback, useEffect } from 'react'
import { useApi } from '@/hooks/useApi'
import { useAuthStore } from '@/store/auth'
import { formatCurrency } from '@/lib/utils'
import {
  X, TrendingUp, TrendingDown, Calendar, ChevronLeft, ChevronRight,
  ShoppingCart, Package, Receipt, Activity, BarChart3,
  AlertCircle, Loader2, History, ArrowLeft, ArrowRight as ArrowRightIcon,
  Users, Tag, Banknote,
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, BarChart, Bar,
} from 'recharts'

// ─── Types ────────────────────────────────────────────────────────────────────
interface TimelineSnapshot {
  snapshotDate: string
  cumulative: {
    totalRevenue: number; totalExpenses: number; totalProfit: number
    totalTransactions: number; profitMargin: number
  }
  dayActivity: {
    revenue: number; expenses: number; transactions: number; margin: number
    itemsSold: number; avgBill: number; profitMargin: number
    topProducts: { name: string; revenue: number; quantity: number }[]
    recentSales: {
      transactionRef: string; totalAmount: number; paymentMethod: string
      saleDate: string; staffName: string
    }[]
    stockActivity: {
      type: string; quantity: number; productName: string
      note?: string; createdAt: string
    }[]
  }
  revenueTrend: { date: string; revenue: number }[]
  expenseBreakdown: { category: string; amount: number }[]
}

// ─── Design tokens ────────────────────────────────────────────────────────────
const T = {
  bg: '#F8FAFC', card: '#FFFFFF', border: '#E2E8F0',
  text: '#0F172A', textSub: '#475569', textMuted: '#94A3B8',
  blue: '#2563EB', blueLt: '#EFF6FF', blueMid: '#BFDBFE',
  green: '#16A34A', greenLt: '#F0FDF4', greenMid: '#BBF7D0',
  amber: '#D97706', amberLt: '#FFFBEB', amberMid: '#FDE68A',
  red: '#DC2626', redLt: '#FEF2F2', redMid: '#FECACA',
  purple: '#7C3AED', purpleLt: '#F5F3FF', purpleMid: '#DDD6FE',
  teal: '#0D9488', tealLt: '#F0FDFA', tealMid: '#99F6E4',
  orange: '#EA580C', orangeLt: '#FFF7ED', orangeMid: '#FED7AA',
  shadow: '0 1px 3px rgba(0,0,0,0.06)',
  shadowLg: '0 24px 64px rgba(0,0,0,0.20)',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = formatCurrency

function todayStr() { return new Date().toISOString().split('T')[0] }

function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

function fmtLong(d: string) {
  return new Date(d).toLocaleDateString('en-IN', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  })
}

function fmtTime(d: string | Date) {
  return new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
}

// ─── StatCard ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, icon, accent, accentLt, accentMid, loading }: {
  label: string; value: string; sub?: string; icon: React.ReactNode
  accent: string; accentLt: string; accentMid: string; loading?: boolean
}) {
  return (
    <div style={{
      background: T.card, border: `1px solid ${T.border}`, borderRadius: 14,
      padding: '14px 16px', boxShadow: T.shadow,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: T.textSub, margin: 0 }}>{label}</p>
        <div style={{
          width: 28, height: 28, borderRadius: 8, background: accentLt,
          border: `1px solid ${accentMid}`, display: 'flex', alignItems: 'center',
          justifyContent: 'center', color: accent,
        }}>
          {icon}
        </div>
      </div>
      {loading ? (
        <div style={{ height: 20, width: '65%', background: '#F1F5F9', borderRadius: 6, animation: 'tlShimmer 1.4s infinite' }} />
      ) : (
        <>
          <p style={{ fontSize: 20, fontWeight: 800, color: accent, margin: '0 0 3px', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.3px' }}>
            {value}
          </p>
          {sub && <p style={{ fontSize: 10, color: T.textMuted, margin: 0 }}>{sub}</p>}
        </>
      )}
    </div>
  )
}

// ─── SectionHead ──────────────────────────────────────────────────────────────
function SHead({ title, icon }: { title: string; icon: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, margin: '22px 0 12px' }}>
      <span style={{ color: T.blue }}>{icon}</span>
      <span style={{ fontSize: 12, fontWeight: 700, color: T.text, textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>{title}</span>
      <div style={{ flex: 1, height: 1, background: T.border }} />
    </div>
  )
}

// ─── Chart tooltip ────────────────────────────────────────────────────────────
function ChartTip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 9, padding: '8px 12px', fontSize: 12 }}>
      <p style={{ color: T.textMuted, margin: '0 0 3px', fontWeight: 600 }}>{label}</p>
      <p style={{ color: T.blue, fontWeight: 700, margin: 0, fontVariantNumeric: 'tabular-nums' }}>{fmt(payload[0]?.value ?? 0)}</p>
    </div>
  )
}

// ─── Main Modal ───────────────────────────────────────────────────────────────
export function BusinessTimelineModal({ onClose }: { onClose: () => void }) {
  const { apiFetch } = useApi()
  const user = useAuthStore(s => s.user)

  // Auth — canonical SBMS role field is always 'owner' | 'staff'
  const isOwner = user?.role === 'owner'

  // Debug logs
  console.log('[BusinessTimeline] Current User:', user)
  console.log('[BusinessTimeline] Detected Role:', user?.role)
  console.log('[BusinessTimeline] Owner Access:', isOwner)

  const [selectedDate, setSelectedDate] = useState(todayStr())
  const [snapshot, setSnapshot] = useState<TimelineSnapshot | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Keyboard ESC to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  // Load data whenever date changes (auto-load)
  const loadSnapshot = useCallback(async (date: string) => {
    if (!isOwner) { setError('Owner access required'); return }
    setLoading(true); setError(null); setSnapshot(null)
    try {
      const data = await apiFetch<TimelineSnapshot>(`/api/business-timeline/snapshot?date=${date}`)
      setSnapshot(data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load timeline data')
    } finally {
      setLoading(false)
    }
  }, [isOwner]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-load on mount
  useEffect(() => { if (isOwner) loadSnapshot(selectedDate) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Date navigation
  function goDate(date: string) {
    if (date > todayStr()) return // no future
    setSelectedDate(date)
    loadSnapshot(date)
  }

  const canGoForward = selectedDate < todayStr()
  const isToday = selectedDate === todayStr()
  const hasSales = (snapshot?.dayActivity.transactions ?? 0) > 0

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(3px)' }} />

      {/* Modal panel */}
      <div style={{
        position: 'fixed', zIndex: 1001,
        top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        width: '94vw', maxWidth: 920, maxHeight: '92vh',
        background: T.bg, borderRadius: 20, boxShadow: T.shadowLg,
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        fontFamily: "'Inter', -apple-system, sans-serif",
      }}>

        {/* ── Modal header ── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', borderBottom: `1px solid ${T.border}`,
          background: T.card, flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: T.purpleLt, border: `1px solid ${T.purpleMid}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <History style={{ width: 17, height: 17, color: T.purple }} />
            </div>
            <div>
              <h2 style={{ fontSize: 15, fontWeight: 800, color: T.text, margin: 0 }}>Business Timeline</h2>
              <p style={{ fontSize: 11, color: T.textMuted, margin: 0 }}>Explore your business history across any date and time</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {!isToday && (
              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 9px', borderRadius: 20, background: T.purpleLt, color: T.purple, border: `1px solid ${T.purpleMid}`, textTransform: 'uppercase' }}>
                Timeline Mode
              </span>
            )}
            <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${T.border}`, background: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: T.textMuted }}>
              <X style={{ width: 14, height: 14 }} />
            </button>
          </div>
        </div>

        {/* ── Date navigation bar ── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '12px 20px',
          borderBottom: `1px solid ${T.border}`, background: T.card, flexShrink: 0, flexWrap: 'wrap',
        }}>
          {/* Prev */}
          <button
            onClick={() => goDate(shiftDate(selectedDate, -1))}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 8, border: `1px solid ${T.border}`, background: '#F8FAFC', color: T.textSub, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
          >
            <ChevronLeft style={{ width: 14, height: 14 }} /> Prev Day
          </button>

          {/* Date input */}
          <div style={{ position: 'relative', flex: 1, minWidth: 160, maxWidth: 220 }}>
            <Calendar style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', width: 13, height: 13, color: T.textMuted, pointerEvents: 'none' }} />
            <input
              type="date"
              value={selectedDate}
              max={todayStr()}
              onChange={e => goDate(e.target.value)}
              style={{
                width: '100%', padding: '7px 10px 7px 29px',
                background: '#F8FAFC', border: `1.5px solid ${T.border}`,
                borderRadius: 9, fontSize: 13, color: T.text, outline: 'none',
              }}
            />
          </div>

          {/* Today */}
          <button
            onClick={() => goDate(todayStr())}
            disabled={isToday}
            style={{
              padding: '7px 14px', borderRadius: 8, border: `1px solid ${isToday ? T.blueMid : T.border}`,
              background: isToday ? T.blueLt : '#F8FAFC',
              color: isToday ? T.blue : T.textSub,
              fontSize: 12, fontWeight: 700, cursor: isToday ? 'default' : 'pointer',
            }}
          >
            Today
          </button>

          {/* Next */}
          <button
            onClick={() => goDate(shiftDate(selectedDate, 1))}
            disabled={!canGoForward}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '7px 12px', borderRadius: 8, border: `1px solid ${T.border}`,
              background: '#F8FAFC', color: canGoForward ? T.textSub : T.textMuted,
              fontSize: 12, fontWeight: 600, cursor: canGoForward ? 'pointer' : 'not-allowed',
              opacity: canGoForward ? 1 : 0.5,
            }}
          >
            Next Day <ChevronRight style={{ width: 14, height: 14 }} />
          </button>

          {/* Selected date label */}
          {selectedDate && (
            <p style={{ fontSize: 12, fontWeight: 600, color: T.textSub, margin: '0 0 0 4px', flexShrink: 0 }}>
              {fmtLong(selectedDate)}
            </p>
          )}

          {/* Exit Timeline button */}
          {!isToday && (
            <button
              onClick={() => goDate(todayStr())}
              style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 8, border: `1px solid ${T.redMid}`, background: T.redLt, color: T.red, fontSize: 11, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}
            >
              <X style={{ width: 12, height: 12 }} /> Exit Timeline
            </button>
          )}
        </div>

        {/* ── Scrollable body ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 24px' }}>

          {/* Non-owner gate */}
          {!isOwner && (
            <div style={{ textAlign: 'center', padding: 32 }}>
              <AlertCircle style={{ width: 32, height: 32, color: T.red, margin: '0 auto 10px' }} />
              <p style={{ fontSize: 14, fontWeight: 600, color: T.red, margin: '0 0 4px' }}>Owner access required</p>
              <p style={{ fontSize: 12, color: T.textMuted }}>Only business owners can access Business Timeline.</p>
            </div>
          )}

          {isOwner && (
            <>
              {/* ── Snapshot banner (historical) ── */}
              {!isToday && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 14px', borderRadius: 10, background: T.purpleLt, border: `1px solid ${T.purpleMid}`, marginBottom: 16 }}>
                  <History style={{ width: 13, height: 13, color: T.purple, flexShrink: 0 }} />
                  <p style={{ fontSize: 12, fontWeight: 600, color: T.purple, margin: 0 }}>
                    Business Timeline Snapshot — {fmtLong(selectedDate)}
                  </p>
                </div>
              )}

              {/* ── Error ── */}
              {error && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '11px 14px', borderRadius: 10, background: T.redLt, border: `1px solid ${T.redMid}`, marginBottom: 16 }}>
                  <AlertCircle style={{ width: 14, height: 14, color: T.red, flexShrink: 0 }} />
                  <p style={{ fontSize: 12, color: T.red, fontWeight: 500, margin: 0 }}>{error}</p>
                </div>
              )}

              {/* ── Loading ── */}
              {loading && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
                    {[1,2,3,4,5,6].map(i => <div key={i} style={{ height: 88, borderRadius: 14, background: '#F1F5F9', animation: 'tlShimmer 1.4s infinite' }} />)}
                  </div>
                  <div style={{ height: 180, borderRadius: 14, background: '#F1F5F9', animation: 'tlShimmer 1.4s infinite' }} />
                </div>
              )}

              {/* ── No data ── */}
              {!loading && !error && snapshot && !hasSales && (
                <div style={{ textAlign: 'center', padding: '36px 20px', borderRadius: 14, background: T.card, border: `1px solid ${T.border}` }}>
                  <History style={{ width: 32, height: 32, color: T.textMuted, margin: '0 auto 10px', opacity: 0.4 }} />
                  <p style={{ fontSize: 14, fontWeight: 600, color: T.textSub, margin: '0 0 4px' }}>No data available for {fmtLong(selectedDate)}</p>
                  <p style={{ fontSize: 12, color: T.textMuted, margin: 0 }}>No sales or transactions were recorded on this date.</p>
                </div>
              )}

              {/* ── Snapshot data ── */}
              {!loading && !error && snapshot && (
                <>
                  {/* ── 6 KPI cards ── */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 4 }} className="tl-kpi-grid">
                    <StatCard
                      label="💰 Revenue"
                      value={hasSales ? fmt(snapshot.dayActivity.revenue) : '—'}
                      sub={hasSales ? `${snapshot.dayActivity.transactions} bill${snapshot.dayActivity.transactions !== 1 ? 's' : ''}` : 'No sales'}
                      icon={<TrendingUp style={{ width: 13, height: 13 }} />}
                      accent={T.blue} accentLt={T.blueLt} accentMid={T.blueMid}
                    />
                    <StatCard
                      label="📈 Profit"
                      value={hasSales ? fmt(snapshot.dayActivity.margin) : '—'}
                      sub={hasSales ? `${snapshot.dayActivity.profitMargin}% margin` : 'No sales'}
                      icon={<BarChart3 style={{ width: 13, height: 13 }} />}
                      accent={snapshot.dayActivity.margin >= 0 ? T.green : T.red}
                      accentLt={snapshot.dayActivity.margin >= 0 ? T.greenLt : T.redLt}
                      accentMid={snapshot.dayActivity.margin >= 0 ? T.greenMid : T.redMid}
                    />
                    <StatCard
                      label="🧾 Total Bills"
                      value={String(snapshot.dayActivity.transactions)}
                      sub="transactions"
                      icon={<Receipt style={{ width: 13, height: 13 }} />}
                      accent={T.purple} accentLt={T.purpleLt} accentMid={T.purpleMid}
                    />
                    <StatCard
                      label="📦 Items Sold"
                      value={hasSales ? String(snapshot.dayActivity.itemsSold) : '—'}
                      sub="total units"
                      icon={<Package style={{ width: 13, height: 13 }} />}
                      accent={T.teal} accentLt={T.tealLt} accentMid={T.tealMid}
                    />
                    <StatCard
                      label="📊 Avg. Bill"
                      value={hasSales ? fmt(snapshot.dayActivity.avgBill) : '—'}
                      sub="per transaction"
                      icon={<Tag style={{ width: 13, height: 13 }} />}
                      accent={T.amber} accentLt={T.amberLt} accentMid={T.amberMid}
                    />
                    <StatCard
                      label="💸 Expenses"
                      value={snapshot.dayActivity.expenses > 0 ? fmt(snapshot.dayActivity.expenses) : '₹0'}
                      sub="on this day"
                      icon={<TrendingDown style={{ width: 13, height: 13 }} />}
                      accent={T.red} accentLt={T.redLt} accentMid={T.redMid}
                    />
                  </div>

                  {/* ── Revenue trend chart ── */}
                  {snapshot.revenueTrend.some(p => p.revenue > 0) && (
                    <>
                      <SHead title="Sales Overview — 30-Day Trend" icon={<Activity style={{ width: 13, height: 13 }} />} />
                      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: '14px 16px' }}>
                        <ResponsiveContainer width="100%" height={160}>
                          <AreaChart data={snapshot.revenueTrend} margin={{ top: 4, right: 4, bottom: 0, left: -12 }}>
                            <defs>
                              <linearGradient id="tlGradBlue" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%"  stopColor={T.blue} stopOpacity={0.15} />
                                <stop offset="95%" stopColor={T.blue} stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                            <XAxis dataKey="date" tick={{ fill: T.textMuted, fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                            <YAxis tick={{ fill: T.textMuted, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                            <Tooltip content={<ChartTip />} />
                            <Area type="monotone" dataKey="revenue" stroke={T.blue} strokeWidth={2} fill="url(#tlGradBlue)" />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </>
                  )}

                  {/* ── Transactions table ── */}
                  {snapshot.dayActivity.recentSales.length > 0 && (
                    <>
                      <SHead title="Transactions" icon={<ShoppingCart style={{ width: 13, height: 13 }} />} />
                      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, overflow: 'hidden' }}>
                        <div style={{ overflowX: 'auto' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                            <thead>
                              <tr style={{ borderBottom: `1.5px solid ${T.border}`, background: '#F8FAFC' }}>
                                {['Bill ID', 'Time', 'Payment', 'Staff', 'Total'].map(h => (
                                  <th key={h} style={{ textAlign: 'left', padding: '9px 14px', fontSize: 10, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>
                                    {h}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {snapshot.dayActivity.recentSales.map((s, i) => (
                                <tr key={i} style={{ borderBottom: `1px solid ${T.border}` }}>
                                  <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 11, color: T.blue, fontWeight: 700 }}>{s.transactionRef}</td>
                                  <td style={{ padding: '10px 14px', color: T.textMuted, whiteSpace: 'nowrap' }}>{fmtTime(s.saleDate)}</td>
                                  <td style={{ padding: '10px 14px' }}>
                                    <span style={{
                                      padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700,
                                      background: s.paymentMethod === 'cash' ? T.greenLt : s.paymentMethod === 'upi' ? T.blueLt : s.paymentMethod === 'card' ? T.purpleLt : T.amberLt,
                                      color: s.paymentMethod === 'cash' ? T.green : s.paymentMethod === 'upi' ? T.blue : s.paymentMethod === 'card' ? T.purple : T.amber,
                                      border: `1px solid ${s.paymentMethod === 'cash' ? T.greenMid : s.paymentMethod === 'upi' ? T.blueMid : s.paymentMethod === 'card' ? T.purpleMid : T.amberMid}`,
                                      textTransform: 'uppercase',
                                    }}>
                                      {s.paymentMethod}
                                    </span>
                                  </td>
                                  <td style={{ padding: '10px 14px', color: T.textSub }}>{s.staffName}</td>
                                  <td style={{ padding: '10px 14px', fontWeight: 700, color: T.text, fontVariantNumeric: 'tabular-nums' }}>{fmt(s.totalAmount)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        {snapshot.dayActivity.transactions > snapshot.dayActivity.recentSales.length && (
                          <p style={{ fontSize: 11, color: T.textMuted, textAlign: 'center', padding: '8px 0', borderTop: `1px solid ${T.border}`, margin: 0 }}>
                            Showing {snapshot.dayActivity.recentSales.length} of {snapshot.dayActivity.transactions} transactions
                          </p>
                        )}
                      </div>
                    </>
                  )}

                  {/* ── Top Products ── */}
                  {snapshot.dayActivity.topProducts.length > 0 && (
                    <>
                      <SHead title="Top Products Sold" icon={<Package style={{ width: 13, height: 13 }} />} />
                      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, overflow: 'hidden' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                          <thead>
                            <tr style={{ borderBottom: `1.5px solid ${T.border}`, background: '#F8FAFC' }}>
                              {['#', 'Product', 'Qty Sold', 'Revenue'].map(h => (
                                <th key={h} style={{ textAlign: 'left', padding: '9px 14px', fontSize: 10, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {snapshot.dayActivity.topProducts.map((p, i) => (
                              <tr key={i} style={{ borderBottom: i < snapshot.dayActivity.topProducts.length - 1 ? `1px solid ${T.border}` : 'none' }}>
                                <td style={{ padding: '10px 14px' }}>
                                  <div style={{ width: 22, height: 22, borderRadius: 6, background: T.blueLt, border: `1px solid ${T.blueMid}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: T.blue }}>
                                    {i + 1}
                                  </div>
                                </td>
                                <td style={{ padding: '10px 14px', fontWeight: 600, color: T.text }}>{p.name}</td>
                                <td style={{ padding: '10px 14px', fontWeight: 700, color: T.teal, fontVariantNumeric: 'tabular-nums' }}>{p.quantity} units</td>
                                <td style={{ padding: '10px 14px', fontWeight: 700, color: T.blue, fontVariantNumeric: 'tabular-nums' }}>{fmt(p.revenue)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}

                  {/* ── Inventory Activity ── */}
                  <SHead title="Inventory Activity" icon={<Package style={{ width: 13, height: 13 }} />} />
                  {snapshot.dayActivity.stockActivity.length === 0 ? (
                    <div style={{ padding: '14px 16px', borderRadius: 12, background: T.card, border: `1px solid ${T.border}` }}>
                      <p style={{ fontSize: 12, color: T.textMuted, margin: 0 }}>Inventory history is unavailable for this date.</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {snapshot.dayActivity.stockActivity.map((t, i) => {
                        const isAdd    = t.type === 'add'
                        const isDamage = t.type === 'damage'
                        const acc = isAdd ? T.green : isDamage ? T.red : T.amber
                        const accLt = isAdd ? T.greenLt : isDamage ? T.redLt : T.amberLt
                        const accMid = isAdd ? T.greenMid : isDamage ? T.redMid : T.amberMid
                        return (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 10, background: T.card, border: `1px solid ${T.border}` }}>
                            <div style={{ width: 28, height: 28, borderRadius: 8, background: accLt, border: `1px solid ${accMid}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: acc, flexShrink: 0 }}>
                              {isAdd ? '+' : isDamage ? '✕' : '~'}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ fontSize: 12, fontWeight: 600, color: T.text, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.productName}</p>
                              <p style={{ fontSize: 10, color: T.textMuted, margin: '1px 0 0', textTransform: 'capitalize' }}>
                                {t.type}{t.note ? ` · ${t.note}` : ''} · {fmtTime(t.createdAt)}
                              </p>
                            </div>
                            <span style={{ fontSize: 12, fontWeight: 700, color: acc, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                              {isAdd ? '+' : isDamage ? '-' : '±'}{Math.abs(t.quantity)} units
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* ── Expense breakdown ── */}
                  {snapshot.expenseBreakdown.length > 0 && (
                    <>
                      <SHead title="Expense Breakdown (30-Day Window)" icon={<Receipt style={{ width: 13, height: 13 }} />} />
                      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, overflow: 'hidden' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                          <thead>
                            <tr style={{ borderBottom: `1.5px solid ${T.border}`, background: '#F8FAFC' }}>
                              {['Category', 'Amount'].map(h => (
                                <th key={h} style={{ textAlign: 'left', padding: '9px 14px', fontSize: 10, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {snapshot.expenseBreakdown.map((e, i) => (
                              <tr key={i} style={{ borderBottom: i < snapshot.expenseBreakdown.length - 1 ? `1px solid ${T.border}` : 'none' }}>
                                <td style={{ padding: '10px 14px', fontWeight: 500, color: T.text }}>{e.category}</td>
                                <td style={{ padding: '10px 14px', fontWeight: 700, color: T.red, fontVariantNumeric: 'tabular-nums' }}>{fmt(e.amount)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}

                  {/* ── Cumulative totals ── */}
                  <SHead title="Cumulative Totals (All-Time up to This Date)" icon={<BarChart3 style={{ width: 13, height: 13 }} />} />
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }} className="tl-kpi-grid">
                    <StatCard label="Total Revenue" value={fmt(snapshot.cumulative.totalRevenue)} sub="all-time to date" icon={<TrendingUp style={{ width: 13, height: 13 }} />} accent={T.blue} accentLt={T.blueLt} accentMid={T.blueMid} />
                    <StatCard label="Total Expenses" value={fmt(snapshot.cumulative.totalExpenses)} sub="all-time to date" icon={<TrendingDown style={{ width: 13, height: 13 }} />} accent={T.red} accentLt={T.redLt} accentMid={T.redMid} />
                    <StatCard
                      label={`Net Profit · ${snapshot.cumulative.profitMargin}%`}
                      value={fmt(snapshot.cumulative.totalProfit)}
                      sub="all-time to date"
                      icon={<Activity style={{ width: 13, height: 13 }} />}
                      accent={snapshot.cumulative.totalProfit >= 0 ? T.green : T.red}
                      accentLt={snapshot.cumulative.totalProfit >= 0 ? T.greenLt : T.redLt}
                      accentMid={snapshot.cumulative.totalProfit >= 0 ? T.greenMid : T.redMid}
                    />
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>

      <style>{`
        @keyframes tlShimmer {
          0%   { background-position: -400px 0; }
          100% { background-position:  400px 0; }
        }
        .tl-kpi-grid { grid-template-columns: repeat(3,1fr) !important; }
        @media (max-width: 600px) {
          .tl-kpi-grid { grid-template-columns: repeat(2,1fr) !important; }
        }
        @media (max-width: 400px) {
          .tl-kpi-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </>
  )
}
