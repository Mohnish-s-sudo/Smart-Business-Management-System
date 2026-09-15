'use client'
import { useEffect, useState } from 'react'
import { useApi } from '@/hooks/useApi'
import { TopBar } from '@/components/layout/TopBar'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { KPISkeleton, Skeleton } from '@/components/ui/Skeleton'
import { formatCurrency, formatPercent, getSeverityColor, getUrgencyColor } from '@/lib/utils'
import { motion } from 'framer-motion'
import {
  TrendingUp, TrendingDown, Package, Wallet,
  Sparkles, ArrowRight, AlertTriangle, ArrowUpRight, ArrowDownRight
} from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts'
import Link from 'next/link'

const COLORS = ['#7C3AED', '#4F46E5', '#06B6D4', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6']

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
}

const stagger = {
  show: { transition: { staggerChildren: 0.07 } },
}

export default function DashboardPage() {
  const { apiFetch } = useApi()
  const [data, setData]       = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiFetch<Record<string, unknown>>('/api/dashboard')
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div>
      <TopBar title="Executive Dashboard" subtitle="Business overview" />
      <KPISkeleton />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-64" />)}
      </div>
    </div>
  )

  const kpis             = data?.kpis as Record<string, number>
  const revenueChart     = (data?.revenueChart     as { date: string; revenue: number; margin: number }[]) || []
  const expenseBreakdown = (data?.expenseBreakdown as { category: string; amount: number }[]) || []
  const topProducts      = (data?.topProducts      as { name: string; margin: number; revenue: number; marginPct: number }[]) || []
  const recentAlerts     = (data?.recentAlerts     as { _id: string; severity: string; message: string; alertType: string; createdAt: string }[]) || []
  const recommendations  = (data?.recommendations  as { _id: string; title: string; urgency: string; businessImpact: string; module: string }[]) || []

  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div>
      <TopBar title="Executive Dashboard" subtitle={today} />

      {/* KPI strip */}
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6"
      >
        <KPICard
          label="Today's Revenue"
          value={formatCurrency(kpis?.todayRevenue || 0)}
          sub={`${kpis?.todayTransactions || 0} transactions`}
          trend="up"
          trendVal="+12%"
          icon={<TrendingUp className="w-4 h-4" />}
          color="violet"
        />
        <KPICard
          label="Gross Margin (30d)"
          value={formatPercent(kpis?.marginPct || 0)}
          sub="vs last month"
          trend={(kpis?.marginPct || 0) > 25 ? 'up' : 'down'}
          trendVal={`${(kpis?.marginPct || 0) > 25 ? '↑' : '↓'} trend`}
          icon={<TrendingUp className="w-4 h-4" />}
          color="blue"
        />
        <KPICard
          label="Active Receivables"
          value={formatCurrency(kpis?.activeReceivables || 0)}
          sub={`${kpis?.receivablesCount || 0} outstanding`}
          trend="neutral"
          trendVal="pending"
          icon={<Wallet className="w-4 h-4" />}
          color="amber"
        />
        <KPICard
          label="Stock Alerts"
          value={String(kpis?.lowStockCount || 0)}
          sub={`${kpis?.outOfStockCount || 0} out of stock`}
          trend={kpis?.lowStockCount > 0 ? 'down' : 'up'}
          trendVal={kpis?.lowStockCount > 0 ? 'needs action' : 'all good'}
          icon={<Package className="w-4 h-4" />}
          color="red"
        />
      </motion.div>

      {/* Charts row */}
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4"
      >
        {/* Revenue area chart */}
        <motion.div variants={fadeUp} className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Revenue vs Margin — Last 7 Days</CardTitle>
              <Badge variant="ai">Live</Badge>
            </CardHeader>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={revenueChart} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#7C3AED" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#7C3AED" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradMargin" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#06B6D4" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#06B6D4" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fill: '#475569', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#475569', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ background: '#0E1220', border: '1px solid rgba(124,58,237,0.2)', borderRadius: 12, fontSize: 12 }}
                  labelStyle={{ color: '#94A3B8' }}
                  formatter={(v) => [formatCurrency(v as number), '']}
                />
                <Area type="monotone" dataKey="revenue" stroke="#7C3AED" strokeWidth={2} fill="url(#gradRevenue)" name="Revenue" />
                <Area type="monotone" dataKey="margin"  stroke="#06B6D4" strokeWidth={2} fill="url(#gradMargin)"  name="Margin" />
              </AreaChart>
            </ResponsiveContainer>
          </Card>
        </motion.div>

        {/* Expense donut */}
        <motion.div variants={fadeUp}>
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Expense Breakdown</CardTitle>
              <span className="text-xs text-slate-500">30 days</span>
            </CardHeader>
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={expenseBreakdown} dataKey="amount" nameKey="category" cx="50%" cy="50%" innerRadius={48} outerRadius={72} strokeWidth={2} stroke="#080B12">
                  {expenseBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip
                  contentStyle={{ background: '#0E1220', border: '1px solid rgba(124,58,237,0.2)', borderRadius: 12, fontSize: 12 }}
                  formatter={(v) => [formatCurrency(v as number), '']}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2 mt-1">
              {expenseBreakdown.slice(0, 4).map((e, i) => (
                <div key={e.category} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                    <span className="text-slate-400">{e.category}</span>
                  </div>
                  <span className="text-white font-medium font-mono">{formatCurrency(e.amount)}</span>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>
      </motion.div>

      {/* Bottom row */}
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 lg:grid-cols-3 gap-4"
      >
        {/* Top products */}
        <motion.div variants={fadeUp}>
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Top Products by Margin</CardTitle>
              <Link href="/inventory" className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1 transition-colors">
                All <ArrowRight className="w-3 h-3" />
              </Link>
            </CardHeader>
            <div className="space-y-3.5">
              {topProducts.map((p, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.06 }}
                  className="flex items-center gap-3"
                >
                  <div className="w-6 h-6 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-[10px] font-bold text-violet-400 flex-shrink-0">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white truncate font-medium">{p.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(p.marginPct, 100)}%` }}
                          transition={{ delay: 0.4 + i * 0.05, duration: 0.6 }}
                          className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full"
                        />
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono">{formatPercent(p.marginPct)}</span>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-white font-mono">{formatCurrency(p.margin)}</span>
                </motion.div>
              ))}
              {topProducts.length === 0 && <p className="text-xs text-slate-600 text-center py-4">No product data yet</p>}
            </div>
          </Card>
        </motion.div>

        {/* AI Recommendations */}
        <motion.div variants={fadeUp}>
          <Card className="h-full">
            <CardHeader>
              <CardTitle>
                <Sparkles className="w-4 h-4 text-violet-400" />
                ProfitPulse AI
              </CardTitle>
              <Link href="/insights" className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1 transition-colors">
                All <ArrowRight className="w-3 h-3" />
              </Link>
            </CardHeader>
            <div className="space-y-3">
              {recommendations.map((r, i) => (
                <motion.div
                  key={r._id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.07 }}
                  className={`p-3 rounded-xl border text-xs ${getUrgencyColor(r.urgency)} transition-colors hover:border-opacity-50`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="font-medium leading-snug">{r.title}</p>
                    <Badge
                      variant={r.urgency === 'urgent' ? 'critical' : r.urgency === 'monitor' ? 'warning' : 'info'}
                      className="flex-shrink-0"
                    >
                      {r.urgency}
                    </Badge>
                  </div>
                  <p className="opacity-60 leading-relaxed">{r.businessImpact}</p>
                </motion.div>
              ))}
              {recommendations.length === 0 && <p className="text-xs text-slate-600 text-center py-4">No recommendations yet</p>}
            </div>
          </Card>
        </motion.div>

        {/* Recent alerts */}
        <motion.div variants={fadeUp}>
          <Card className="h-full">
            <CardHeader>
              <CardTitle>
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                Recent Alerts
              </CardTitle>
              <Link href="/alerts" className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1 transition-colors">
                All <ArrowRight className="w-3 h-3" />
              </Link>
            </CardHeader>
            <div className="space-y-2.5">
              {recentAlerts.map((a, i) => (
                <motion.div
                  key={a._id}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.06 }}
                  className={`p-3 rounded-xl border text-xs ${getSeverityColor(a.severity)}`}
                >
                  <p className="leading-snug font-medium">{a.message}</p>
                  <p className="opacity-50 mt-1.5">{new Date(a.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p>
                </motion.div>
              ))}
              {recentAlerts.length === 0 && (
                <div className="text-center py-6">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-2">
                    <AlertTriangle className="w-5 h-5 text-emerald-400" />
                  </div>
                  <p className="text-xs text-slate-600">All clear — no alerts</p>
                </div>
              )}
            </div>
          </Card>
        </motion.div>
      </motion.div>
    </div>
  )
}

// KPI Card Component
const colorMap = {
  violet: { bg: 'bg-violet-500/8', border: 'border-violet-500/20', icon: 'text-violet-400', iconBg: 'bg-violet-500/10 border-violet-500/20' },
  blue:   { bg: 'bg-blue-500/8',   border: 'border-blue-500/20',   icon: 'text-blue-400',   iconBg: 'bg-blue-500/10 border-blue-500/20' },
  amber:  { bg: 'bg-amber-500/8',  border: 'border-amber-500/20',  icon: 'text-amber-400',  iconBg: 'bg-amber-500/10 border-amber-500/20' },
  red:    { bg: 'bg-red-500/8',    border: 'border-red-500/20',    icon: 'text-red-400',    iconBg: 'bg-red-500/10 border-red-500/20' },
}

function KPICard({ label, value, sub, trend, trendVal, icon, color }: {
  label: string; value: string; sub: string
  trend: 'up' | 'down' | 'neutral'; trendVal: string
  icon: React.ReactNode; color: keyof typeof colorMap
}) {
  const c = colorMap[color]
  const TrendIcon = trend === 'up' ? ArrowUpRight : trend === 'down' ? ArrowDownRight : ArrowRight
  const trendColor = trend === 'up' ? 'text-emerald-400' : trend === 'down' ? 'text-red-400' : 'text-slate-500'

  return (
    <motion.div
      variants={fadeUp}
      whileHover={{ y: -2, transition: { type: 'spring', stiffness: 300 } }}
      className={`bg-[#0E1220] border ${c.border} rounded-2xl p-5 ${c.bg} relative overflow-hidden group cursor-default`}
    >
      <div className="flex items-start justify-between mb-4">
        <p className="text-xs text-slate-400 font-medium">{label}</p>
        <div className={`w-8 h-8 rounded-xl border ${c.iconBg} flex items-center justify-center ${c.icon}`}>
          {icon}
        </div>
      </div>
      <p className="text-2xl font-bold text-white font-mono tracking-tight mb-1">{value}</p>
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">{sub}</p>
        <div className={`flex items-center gap-0.5 text-[11px] font-medium ${trendColor}`}>
          <TrendIcon className="w-3 h-3" />
          {trendVal}
        </div>
      </div>
    </motion.div>
  )
}
