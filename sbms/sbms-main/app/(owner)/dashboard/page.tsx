'use client'
import { useEffect, useState, useCallback } from 'react'
import { useApi } from '@/hooks/useApi'
import { useAuthStore } from '@/store/auth'
import { formatCurrency, formatPercent } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import {
  TrendingUp, TrendingDown, Package, Wallet, Bell,
  Sparkles, ArrowRight, AlertTriangle, ArrowUpRight,
  ArrowDownRight, Plus, FileText, LayoutGrid, Brain,
  ShoppingCart, RefreshCw, CheckCircle, Activity,
  Zap, ChevronRight, Receipt, History,
} from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { OwnerTopBar } from '@/components/layout/OwnerTopBar'
import { BusinessTimelineModal } from '@/components/owner/BusinessTimelineModal'

// ─── Design tokens ─────────────────────────────────────────────────────────────
const T = {
  bg:          '#F8FAFC',
  card:        '#FFFFFF',
  border:      '#E2E8F0',
  borderHover: '#CBD5E1',
  text:        '#0F172A',
  textSub:     '#475569',
  textMuted:   '#94A3B8',
  blue:        '#2563EB',
  blueLt:      '#EFF6FF',
  blueMid:     '#BFDBFE',
  green:       '#16A34A',
  greenLt:     '#F0FDF4',
  greenMid:    '#BBF7D0',
  amber:       '#D97706',
  amberLt:     '#FFFBEB',
  amberMid:    '#FDE68A',
  red:         '#DC2626',
  redLt:       '#FEF2F2',
  redMid:      '#FECACA',
  purple:      '#7C3AED',
  purpleLt:    '#F5F3FF',
  purpleMid:   '#DDD6FE',
  shadow:      '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
  shadowMd:    '0 4px 12px rgba(0,0,0,0.06)',
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface DashData {
  kpis: {
    todayRevenue: number; todayTransactions: number; todayMargin: number
    marginPct: number; activeReceivables: number; receivablesCount: number
    lowStockCount: number; outOfStockCount: number
  }
  revenueChart: { date: string; revenue: number; margin: number }[]
  expenseBreakdown: { category: string; amount: number }[]
  topProducts: { name: string; margin: number; revenue: number; marginPct: number }[]
  recentAlerts: { _id: string; severity: string; message: string; alertType: string; createdAt: string }[]
  recommendations: { _id: string; title: string; urgency: string; businessImpact: string; module: string }[]
  recentSales: { _id: string; transactionRef: string; totalAmount: number; saleDate: string; staffId?: { name: string } }[]
  lowStockProducts: { _id: string; name: string; stockQuantity: number; reorderThreshold: number }[]
  totalSales: number; totalExpenses: number; totalProfit: number
  totalProducts: number; totalStaff: number; alertsCount: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = formatCurrency
const timeAgo = (d: string) => {
  const diff = Date.now() - new Date(d).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function Bone({ w = '100%', h = 16, r = 8 }: { w?: string | number; h?: number; r?: number }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: r,
      background: 'linear-gradient(90deg, #F1F5F9 25%, #E2E8F0 50%, #F1F5F9 75%)',
      backgroundSize: '400px 100%',
      animation: 'shimmerLight 1.4s infinite',
    }} />
  )
}

// ─── Card wrapper ─────────────────────────────────────────────────────────────
function Card({ children, style = {} }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: T.card, border: `1px solid ${T.border}`,
      borderRadius: 16, padding: 20,
      boxShadow: T.shadow,
      ...style,
    }}>
      {children}
    </div>
  )
}

function CardHead({ title, icon, link, linkLabel = 'View all' }: {
  title: string; icon?: React.ReactNode; link?: string; linkLabel?: string
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        {icon}
        <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{title}</span>
      </div>
      {link && (
        <Link href={link} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 12, color: T.blue, textDecoration: 'none', fontWeight: 500 }}>
          {linkLabel} <ChevronRight style={{ width: 12, height: 12 }} />
        </Link>
      )}
    </div>
  )
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
interface KPIProps {
  label: string; value: string; sub: string
  trend?: 'up' | 'down' | 'neutral'; trendVal?: string
  icon: React.ReactNode
  accent: string; accentLt: string; accentMid: string
  loading?: boolean
}
function KPICard({ label, value, sub, trend, trendVal, icon, accent, accentLt, accentMid, loading }: KPIProps) {
  const TrendIcon = trend === 'up' ? ArrowUpRight : trend === 'down' ? ArrowDownRight : ArrowRight
  const trendColor = trend === 'up' ? T.green : trend === 'down' ? T.red : T.textMuted

  return (
    <motion.div
      whileHover={{ y: -2, boxShadow: T.shadowMd }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      style={{
        background: T.card, border: `1px solid ${T.border}`,
        borderRadius: 16, padding: '18px 20px',
        boxShadow: T.shadow, cursor: 'default',
        transition: 'border-color 0.15s',
      }}
      onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.borderColor = accentMid}
      onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.borderColor = T.border}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: T.textSub, margin: 0 }}>{label}</p>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: accentLt, border: `1px solid ${accentMid}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: accent,
        }}>
          {icon}
        </div>
      </div>

      {loading ? (
        <><Bone h={28} w="70%" r={6} /><div style={{ height: 8 }} /><Bone h={14} w="50%" /></>
      ) : (
        <>
          <p style={{ fontSize: 24, fontWeight: 800, color: T.text, margin: '0 0 6px', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.5px' }}>
            {value}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p style={{ fontSize: 11, color: T.textMuted, margin: 0 }}>{sub}</p>
            {trendVal && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 11, fontWeight: 600, color: trendColor }}>
                <TrendIcon style={{ width: 12, height: 12 }} />
                {trendVal}
              </div>
            )}
          </div>
        </>
      )}
    </motion.div>
  )
}

// ─── Custom tooltip ───────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: T.card, border: `1px solid ${T.border}`,
      borderRadius: 10, padding: '10px 14px',
      boxShadow: T.shadowMd, fontSize: 12,
    }}>
      <p style={{ color: T.textMuted, margin: '0 0 6px', fontWeight: 600 }}>{label}</p>
      {payload.map((p, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.color }} />
          <span style={{ color: T.textSub }}>{p.name}:</span>
          <span style={{ fontWeight: 700, color: T.text }}>{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Period selector ──────────────────────────────────────────────────────────
function PeriodBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '5px 12px', borderRadius: 7, border: 'none',
        background: active ? T.blue : 'transparent',
        color: active ? '#fff' : T.textSub,
        fontSize: 11, fontWeight: 600, cursor: 'pointer',
        transition: 'all 0.12s',
      }}
    >
      {label}
    </button>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { apiFetch } = useApi()
  const user = useAuthStore(s => s.user)

  const [data, setData]       = useState<DashData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(false)
  const [period, setPeriod]   = useState<'7d' | '30d' | 'month' | 'lastMonth'>('7d')
  const [showTimeline, setShowTimeline] = useState(false)

  const loadData = useCallback(() => {
    setLoading(true); setError(false)
    apiFetch<DashData>('/api/dashboard')
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadData() }, [loadData])

  const kpis = data?.kpis
  const alertsCount = (kpis?.lowStockCount ?? 0) + (kpis?.outOfStockCount ?? 0)

  // Chart data — use revenueChart from API (7-day by default)
  const chartData = data?.revenueChart ?? []

  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const firstName = user?.name?.split(' ')[0] ?? 'Owner'

  // ── Activity feed: merge sales + alerts, sort by date ──
  const activityFeed = [
    ...(data?.recentSales?.slice(0, 3).map(s => ({
      id: s._id,
      type: 'sale' as const,
      label: `Sale ${s.transactionRef}`,
      sub: `${fmt(s.totalAmount)} via billing`,
      time: s.saleDate,
      color: T.green,
      icon: <ShoppingCart style={{ width: 12, height: 12 }} />,
    })) ?? []),
    ...(data?.recentAlerts?.slice(0, 2).map(a => ({
      id: a._id,
      type: 'alert' as const,
      label: a.message,
      sub: a.alertType?.replace(/_/g, ' ').toLowerCase() ?? '',
      time: a.createdAt,
      color: a.severity === 'critical' ? T.red : T.amber,
      icon: <AlertTriangle style={{ width: 12, height: 12 }} />,
    })) ?? []),
  ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 6)

  return (
    <div style={{ background: T.bg, minHeight: '100vh', color: T.text, fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}>
      <OwnerTopBar alertCount={alertsCount} onOpenTimeline={() => setShowTimeline(true)} />

      <div style={{ padding: '24px 24px 40px', maxWidth: 1280, margin: '0 auto' }}>

        {/* ── Welcome banner ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          style={{
            background: 'linear-gradient(135deg, #EFF6FF 0%, #F0F9FF 50%, #F5F3FF 100%)',
            border: '1px solid #BFDBFE',
            borderRadius: 20, padding: '24px 28px',
            marginBottom: 24,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexWrap: 'wrap', gap: 16,
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <div style={{
                width: 28, height: 28, borderRadius: 8,
                background: 'linear-gradient(135deg, #2563EB, #4F46E5)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Zap style={{ width: 13, height: 13, color: '#fff' }} />
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: T.blue, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Build a Smarter Business
              </span>
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: T.text, margin: '0 0 4px', letterSpacing: '-0.4px' }}>
              Welcome back, {firstName} 👋
            </h1>
            <p style={{ fontSize: 13, color: T.textSub, margin: '0 0 10px' }}>
              {today} · Here&apos;s what&apos;s happening with your business today.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: T.green, animation: 'pulseGreen 2s infinite' }} />
              <span style={{ fontSize: 11, fontWeight: 600, color: T.green }}>System Online</span>
              <span style={{ fontSize: 11, color: T.textMuted }}>· All systems running smoothly</span>
            </div>
          </div>
          <div className="owner-desktop-only" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <QuickStatPill label="Total Sales" value={data ? fmt(data.totalSales) : '—'} loading={loading} />
            <QuickStatPill label="Net Profit" value={data ? fmt(data.totalProfit) : '—'} loading={loading} />
            <QuickStatPill label="Products" value={data ? String(data.totalProducts) : '—'} loading={loading} />
          </div>
        </motion.div>

        {/* ── Error state ── */}
        {error && (
          <div style={{
            background: T.redLt, border: `1px solid ${T.redMid}`, borderRadius: 12,
            padding: '14px 18px', marginBottom: 20,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: 13, color: T.red }}>Unable to load dashboard data. Please try again.</span>
            <button onClick={loadData} style={{
              display: 'flex', alignItems: 'center', gap: 5, fontSize: 12,
              color: T.red, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600,
            }}>
              <RefreshCw style={{ width: 13, height: 13 }} /> Retry
            </button>
          </div>
        )}

        {/* ── KPI strip ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }} className="kpi-grid">
          <KPICard
            label="Today's Revenue"
            value={loading ? '—' : fmt(kpis?.todayRevenue ?? 0)}
            sub={loading ? '' : `${kpis?.todayTransactions ?? 0} transaction${kpis?.todayTransactions !== 1 ? 's' : ''}`}
            trend="up"
            trendVal={kpis?.todayTransactions ? `${kpis.todayTransactions} orders` : undefined}
            icon={<TrendingUp style={{ width: 16, height: 16 }} />}
            accent={T.blue} accentLt={T.blueLt} accentMid={T.blueMid}
            loading={loading}
          />
          <KPICard
            label="Gross Margin (30d)"
            value={loading ? '—' : formatPercent(kpis?.marginPct ?? 0)}
            sub="30-day margin rate"
            trend={(kpis?.marginPct ?? 0) >= 20 ? 'up' : 'down'}
            trendVal={(kpis?.marginPct ?? 0) >= 20 ? 'Healthy' : 'Review needed'}
            icon={<TrendingUp style={{ width: 16, height: 16 }} />}
            accent={T.green} accentLt={T.greenLt} accentMid={T.greenMid}
            loading={loading}
          />
          <KPICard
            label="Active Receivables"
            value={loading ? '—' : fmt(kpis?.activeReceivables ?? 0)}
            sub={loading ? '' : `${kpis?.receivablesCount ?? 0} outstanding`}
            trend="neutral"
            trendVal={kpis?.receivablesCount ? 'pending' : 'all clear'}
            icon={<Wallet style={{ width: 16, height: 16 }} />}
            accent={T.amber} accentLt={T.amberLt} accentMid={T.amberMid}
            loading={loading}
          />
          <KPICard
            label="Stock Alerts"
            value={loading ? '—' : String(kpis?.lowStockCount ?? 0)}
            sub={loading ? '' : `${kpis?.outOfStockCount ?? 0} out of stock`}
            trend={(kpis?.lowStockCount ?? 0) > 0 ? 'down' : 'up'}
            trendVal={(kpis?.lowStockCount ?? 0) > 0 ? 'needs action' : 'all stocked'}
            icon={<Package style={{ width: 16, height: 16 }} />}
            accent={T.red} accentLt={T.redLt} accentMid={T.redMid}
            loading={loading}
          />
        </div>

        {/* ── Charts + AI row ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16, marginBottom: 16 }} className="chart-grid">
          {/* Revenue vs Expenses chart */}
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: T.blueLt, border: `1px solid ${T.blueMid}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Activity style={{ width: 14, height: 14, color: T.blue }} />
                </div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: T.text, margin: 0 }}>Revenue vs Expenses</p>
                  <p style={{ fontSize: 11, color: T.textMuted, margin: 0 }}>Last 7 days performance</p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 4, background: '#F1F5F9', borderRadius: 8, padding: 3 }}>
                {(['7d', '30d', 'month', 'lastMonth'] as const).map(p => (
                  <PeriodBtn key={p} label={p === '7d' ? '7 Days' : p === '30d' ? '30 Days' : p === 'month' ? 'This Month' : 'Last Month'} active={period === p} onClick={() => setPeriod(p)} />
                ))}
              </div>
            </div>

            {loading ? (
              <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Bone w="100%" h={200} r={12} />
              </div>
            ) : chartData.length === 0 ? (
              <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.textMuted, fontSize: 13 }}>
                No sales data available for this period
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
                    <defs>
                      <linearGradient id="gradRevL" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={T.blue} stopOpacity={0.15} />
                        <stop offset="95%" stopColor={T.blue} stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gradMarL" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={T.green} stopOpacity={0.12} />
                        <stop offset="95%" stopColor={T.green} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                    <XAxis dataKey="date" tick={{ fill: T.textMuted, fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: T.textMuted, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                    <Tooltip content={<ChartTooltip />} />
                    <Area type="monotone" dataKey="revenue" stroke={T.blue} strokeWidth={2} fill="url(#gradRevL)" name="Revenue" />
                    <Area type="monotone" dataKey="margin"  stroke={T.green} strokeWidth={2} fill="url(#gradMarL)" name="Margin" />
                  </AreaChart>
                </ResponsiveContainer>
                {/* Legend */}
                <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
                  {[{ color: T.blue, label: 'Revenue' }, { color: T.green, label: 'Margin' }].map(l => (
                    <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <div style={{ width: 12, height: 3, borderRadius: 2, background: l.color }} />
                      <span style={{ fontSize: 11, color: T.textMuted }}>{l.label}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </Card>

          {/* ProfitPulse AI card */}
          <Card style={{ display: 'flex', flexDirection: 'column' }}>
            <CardHead
              title="Profit Pulse AI"
              icon={<div style={{ width: 30, height: 30, borderRadius: 8, background: T.purpleLt, border: `1px solid ${T.purpleMid}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Brain style={{ width: 14, height: 14, color: T.purple }} /></div>}
              link="/profit-pulse"
            />
            <p style={{ fontSize: 11, color: T.textMuted, marginBottom: 14, marginTop: -8 }}>Your AI business assistant</p>

            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[1, 2, 3].map(i => <Bone key={i} h={52} r={10} />)}
              </div>
            ) : (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(data?.recommendations ?? []).length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '20px 0', color: T.textMuted, fontSize: 12 }}>
                    <Sparkles style={{ width: 24, height: 24, margin: '0 auto 8px', color: T.purpleMid }} />
                    No recommendations at the moment
                  </div>
                ) : (
                  data?.recommendations.map((r, i) => (
                    <div key={r._id || i} style={{
                      padding: '10px 12px', borderRadius: 10,
                      background: r.urgency === 'urgent' ? '#FFF7ED' : r.urgency === 'monitor' ? '#FFFBEB' : T.purpleLt,
                      border: `1px solid ${r.urgency === 'urgent' ? '#FED7AA' : r.urgency === 'monitor' ? '#FDE68A' : T.purpleMid}`,
                    }}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: T.text, margin: '0 0 3px' }}>{r.title}</p>
                      <p style={{ fontSize: 11, color: T.textMuted, margin: 0, lineHeight: 1.4 }}>{r.businessImpact}</p>
                    </div>
                  ))
                )}
                <Link href="/profit-pulse" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px 0', borderRadius: 10, background: `linear-gradient(135deg, ${T.purple} 0%, #4F46E5 100%)`, color: '#fff', fontSize: 12, fontWeight: 700, textDecoration: 'none', marginTop: 8 }}>
                  <Sparkles style={{ width: 13, height: 13 }} />
                  Ask Profit Pulse AI
                  <ArrowRight style={{ width: 12, height: 12 }} />
                </Link>
              </div>
            )}
          </Card>
        </div>

        {/* ── Bottom row: Recent Activity + Top Products + Quick Actions ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 280px', gap: 16 }} className="bottom-grid">

          {/* Recent Activity */}
          <Card>
            <CardHead
              title="Recent Activity"
              icon={<div style={{ width: 28, height: 28, borderRadius: 8, background: T.blueLt, border: `1px solid ${T.blueMid}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Activity style={{ width: 13, height: 13, color: T.blue }} /></div>}
              link="/sales"
              linkLabel="All sales"
            />

            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[1, 2, 3, 4].map(i => <Bone key={i} h={42} r={8} />)}
              </div>
            ) : activityFeed.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px 0', color: T.textMuted, fontSize: 12 }}>
                <Activity style={{ width: 22, height: 22, margin: '0 auto 8px', opacity: 0.4 }} />
                No recent activity
              </div>
            ) : (
              <div style={{ position: 'relative', paddingLeft: 20 }}>
                {/* Timeline line */}
                <div style={{ position: 'absolute', left: 6, top: 8, bottom: 8, width: 2, background: '#F1F5F9', borderRadius: 2 }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {activityFeed.map((item) => (
                    <div key={item.id} style={{ position: 'relative' }}>
                      {/* Dot */}
                      <div style={{
                        position: 'absolute', left: -17, top: 4,
                        width: 10, height: 10, borderRadius: '50%',
                        background: item.color, border: '2px solid #F8FAFC',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#fff',
                      }} />
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <p style={{ fontSize: 12, fontWeight: 600, color: T.text, margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {item.label}
                          </p>
                          <p style={{ fontSize: 11, color: T.textMuted, margin: 0 }}>{item.sub}</p>
                        </div>
                        <span style={{ fontSize: 10, color: T.textMuted, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                          {timeAgo(item.time)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>

          {/* Top Products + Low Stock */}
          <Card>
            <CardHead
              title="Top Products"
              icon={<div style={{ width: 28, height: 28, borderRadius: 8, background: T.greenLt, border: `1px solid ${T.greenMid}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><TrendingUp style={{ width: 13, height: 13, color: T.green }} /></div>}
              link="/inventory"
            />

            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[1, 2, 3, 4, 5].map(i => <Bone key={i} h={36} r={8} />)}
              </div>
            ) : (data?.topProducts ?? []).length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px 0', color: T.textMuted, fontSize: 12 }}>
                <Package style={{ width: 22, height: 22, margin: '0 auto 8px', opacity: 0.4 }} />
                No product data yet
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                  {data?.topProducts.map((p, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 24, height: 24, borderRadius: 7,
                        background: i === 0 ? '#FFF7ED' : i === 1 ? '#F0FDF4' : '#F8FAFC',
                        border: `1px solid ${i === 0 ? '#FED7AA' : i === 1 ? '#BBF7D0' : '#E2E8F0'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 10, fontWeight: 800,
                        color: i === 0 ? T.amber : i === 1 ? T.green : T.textMuted,
                        flexShrink: 0,
                      }}>
                        {i + 1}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 12, fontWeight: 500, color: T.text, margin: '0 0 3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ flex: 1, height: 4, background: '#F1F5F9', borderRadius: 2, overflow: 'hidden' }}>
                            <div style={{ width: `${Math.min(p.marginPct, 100)}%`, height: '100%', background: `linear-gradient(90deg, ${T.blue}, ${T.purple})`, borderRadius: 2, transition: 'width 0.8s ease' }} />
                          </div>
                          <span style={{ fontSize: 10, color: T.textMuted, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{formatPercent(p.marginPct)}</span>
                        </div>
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: T.text, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{fmt(p.margin)}</span>
                    </div>
                  ))}
                </div>

                {/* Low stock mini-list */}
                {(data?.lowStockProducts?.length ?? 0) > 0 && (
                  <>
                    <div style={{ height: 1, background: T.border, margin: '4px 0 12px' }} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                      <AlertTriangle style={{ width: 12, height: 12, color: T.amber }} />
                      <span style={{ fontSize: 11, fontWeight: 700, color: T.amber }}>Low Stock</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                      {data?.lowStockProducts.slice(0, 3).map(p => (
                        <div key={p._id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 8px', borderRadius: 7, background: T.amberLt, border: `1px solid ${T.amberMid}` }}>
                          <span style={{ fontSize: 11, color: T.text, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' }}>{p.name}</span>
                          <span style={{ fontSize: 11, fontWeight: 700, color: T.amber }}>{p.stockQuantity} left</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHead
              title="Quick Actions"
              icon={<div style={{ width: 28, height: 28, borderRadius: 8, background: T.purpleLt, border: `1px solid ${T.purpleMid}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Zap style={{ width: 13, height: 13, color: T.purple }} /></div>}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { label: 'Add Product',     icon: <Plus style={{ width: 15, height: 15 }} />,         href: '/inventory',    accent: T.blue,   accentLt: T.blueLt,   accentMid: T.blueMid },
                { label: 'Record Expense',  icon: <Receipt style={{ width: 15, height: 15 }} />,      href: '/expenses',     accent: T.red,    accentLt: T.redLt,    accentMid: T.redMid },
                { label: 'View Inventory',  icon: <LayoutGrid style={{ width: 15, height: 15 }} />,   href: '/inventory',    accent: T.green,  accentLt: T.greenLt,  accentMid: T.greenMid },
                { label: 'Generate Report', icon: <FileText style={{ width: 15, height: 15 }} />,     href: '/reports',      accent: T.amber,  accentLt: T.amberLt,  accentMid: T.amberMid },
                { label: 'View Alerts',     icon: <Bell style={{ width: 15, height: 15 }} />,         href: '/alerts',       accent: T.purple, accentLt: T.purpleLt, accentMid: T.purpleMid },
                { label: 'Sales Track',     icon: <ShoppingCart style={{ width: 15, height: 15 }} />, href: '/sales',        accent: T.blue,   accentLt: T.blueLt,   accentMid: T.blueMid },
              ].map(({ label, icon, href, accent, accentLt, accentMid }) => (
                <Link key={label} href={href} style={{ textDecoration: 'none' }}>
                  <div
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '9px 12px', borderRadius: 10,
                      background: '#FAFAFA', border: `1px solid ${T.border}`,
                      cursor: 'pointer', transition: 'all 0.12s',
                    }}
                    onMouseEnter={e => {
                      const el = e.currentTarget as HTMLDivElement
                      el.style.background = accentLt
                      el.style.borderColor = accentMid
                      el.style.transform = 'translateY(-1px)'
                    }}
                    onMouseLeave={e => {
                      const el = e.currentTarget as HTMLDivElement
                      el.style.background = '#FAFAFA'
                      el.style.borderColor = T.border
                      el.style.transform = 'translateY(0)'
                    }}
                  >
                    <div style={{
                      width: 28, height: 28, borderRadius: 8,
                      background: accentLt, border: `1px solid ${accentMid}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: accent, flexShrink: 0,
                    }}>
                      {icon}
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: T.text, flex: 1 }}>{label}</span>
                    <ChevronRight style={{ width: 12, height: 12, color: T.textMuted }} />
                  </div>
                </Link>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* Responsive styles + animations */}
      <style>{`
        @keyframes shimmerLight {
          0%   { background-position: -400px 0; }
          100% { background-position: 400px 0; }
        }
        @keyframes pulseGreen {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        .kpi-grid { grid-template-columns: repeat(4, 1fr); }
        .chart-grid { grid-template-columns: 1fr 340px; }
        .bottom-grid { grid-template-columns: 1fr 1fr 280px; }
        @media (max-width: 1100px) {
          .chart-grid { grid-template-columns: 1fr !important; }
          .bottom-grid { grid-template-columns: 1fr 1fr !important; }
          .bottom-grid > *:last-child { grid-column: 1 / -1; }
        }
        @media (max-width: 900px) {
          .kpi-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (max-width: 600px) {
          .kpi-grid { grid-template-columns: 1fr !important; }
          .bottom-grid { grid-template-columns: 1fr !important; }
          .owner-desktop-only { display: none !important; }
        }
        input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; }
      `}</style>

      {/* Business Timeline modal — rendered at root level so it overlays everything */}
      {showTimeline && (
        <BusinessTimelineModal onClose={() => setShowTimeline(false)} />
      )}
    </div>
  )
}

// ─── Quick stat pill for welcome banner ───────────────────────────────────────
function QuickStatPill({ label, value, loading }: { label: string; value: string; loading: boolean }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(37,99,235,0.15)',
      borderRadius: 10, padding: '8px 14px', backdropFilter: 'blur(4px)',
    }}>
      <p style={{ fontSize: 10, fontWeight: 600, color: T.textMuted, margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
      {loading
        ? <Bone h={16} w={80} />
        : <p style={{ fontSize: 14, fontWeight: 800, color: T.blue, margin: 0, fontVariantNumeric: 'tabular-nums' }}>{value}</p>
      }
    </div>
  )
}
