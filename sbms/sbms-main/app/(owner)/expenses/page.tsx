'use client'
import { useEffect, useState, useCallback } from 'react'
import { useApi } from '@/hooks/useApi'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Plus, Receipt, TrendingDown, Tag } from 'lucide-react'
import toast from 'react-hot-toast'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { L, LCard, LCardHead, LPageHeader, LStatCard, LBadge, LButton, LInput, LSelect, LDrawer, LTable, LTR, LTD, LBone, LEmpty } from '@/components/owner/LTheme'
import { OwnerTopBar } from '@/components/layout/OwnerTopBar'

const CATEGORIES = ['Rent', 'Utilities', 'Payroll', 'Supplies', 'Marketing', 'Logistics', 'Miscellaneous']
const PIE_COLORS = ['#2563EB', '#16A34A', '#D97706', '#DC2626', '#7C3AED', '#0891B2', '#DB2777']

interface Expense { _id: string; category: string; vendorName: string; amount: number; expenseDate: string; loggedById?: { name: string }; isRecurring: boolean }
interface CategoryTotal { category: string; amount: number }

export default function ExpensesPage() {
  const { apiFetch } = useApi()
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [categoryTotals, setCategoryTotals] = useState<CategoryTotal[]>([])
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [form, setForm] = useState({ category: 'Rent', vendorName: '', amount: '', notes: '', isRecurring: false })
  const [saving, setSaving] = useState(false)
  const [catFilter, setCatFilter] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    apiFetch<{ expenses: Expense[]; categoryTotals: CategoryTotal[] }>(`/api/expenses?category=${catFilter}`)
      .then(d => { setExpenses(d.expenses); setCategoryTotals(d.categoryTotals) })
      .catch(() => {}).finally(() => setLoading(false))
  }, [catFilter]) // eslint-disable-line

  useEffect(() => { load() }, [load])

  async function save() {
    setSaving(true)
    try {
      await apiFetch('/api/expenses', { method: 'POST', body: JSON.stringify({ ...form, amount: parseFloat(form.amount) }) })
      toast.success('Expense recorded')
      setDrawerOpen(false); setForm({ category: 'Rent', vendorName: '', amount: '', notes: '', isRecurring: false }); load()
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Failed') }
    finally { setSaving(false) }
  }

  const totalExpenses = categoryTotals.reduce((s, c) => s + (c.amount ?? 0), 0)
  const topCategory = [...categoryTotals].sort((a, b) => b.amount - a.amount)[0]
  const avgExpense = expenses.length > 0 ? totalExpenses / expenses.length : 0

  const chartData = categoryTotals.map(c => ({ name: c.category, value: Math.round(c.amount ?? 0) })).filter(c => c.value > 0)

  return (
    <div style={{ background: L.bg, minHeight: '100vh', fontFamily: "'Inter', -apple-system, sans-serif" }}>
      <OwnerTopBar />
      <div style={{ padding: '24px 24px 40px', maxWidth: 1280, margin: '0 auto' }}>
        <LPageHeader title="Expenses" subtitle="Track and analyze business expenses" right={<LButton onClick={() => setDrawerOpen(true)}><Plus style={{ width: 14, height: 14 }} /> Add Expense</LButton>} />

        {/* KPI strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 24 }} className="l-kpi3">
          <LStatCard label="Total Expenses" value={formatCurrency(totalExpenses)} sub="all time" icon={<TrendingDown style={{ width: 15, height: 15 }} />} accent={L.red} accentLt={L.redLt} accentMid={L.redMid} loading={loading} />
          <LStatCard label="This Month" value={formatCurrency(expenses.filter(e => new Date(e.expenseDate).getMonth() === new Date().getMonth()).reduce((s, e) => s + e.amount, 0))} sub="current month" icon={<Receipt style={{ width: 15, height: 15 }} />} accent={L.amber} accentLt={L.amberLt} accentMid={L.amberMid} loading={loading} />
          <LStatCard label="Avg. Expense" value={formatCurrency(avgExpense)} sub="per transaction" icon={<Tag style={{ width: 15, height: 15 }} />} accent={L.blue} accentLt={L.blueLt} accentMid={L.blueMid} loading={loading} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16, alignItems: 'start' }} className="l-exp-grid">
          {/* Expense table */}
          <LCard>
            <LCardHead title="Expense Log" right={
              <select value={catFilter} onChange={e => setCatFilter(e.target.value)} style={{ padding: '6px 10px', background: '#F8FAFC', border: `1px solid ${L.border}`, borderRadius: 8, fontSize: 12, color: L.text, outline: 'none', cursor: 'pointer' }}>
                <option value="">All Categories</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            } />
            {loading ? <LBone h={240} /> : expenses.length === 0 ? <LEmpty icon={<Receipt style={{ width: 28, height: 28 }} />} message="No expenses recorded." /> : (
              <LTable headers={['Date', 'Category', 'Vendor', 'Amount', 'By']}>
                {expenses.map(e => (
                  <LTR key={e._id}>
                    <LTD muted>{formatDate(e.expenseDate)}</LTD>
                    <LTD><LBadge variant="default">{e.category}</LBadge></LTD>
                    <LTD muted>{e.vendorName || '—'}</LTD>
                    <LTD><span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(e.amount)}</span></LTD>
                    <LTD muted>{(e.loggedById as any)?.name ?? '—'}</LTD>
                  </LTR>
                ))}
              </LTable>
            )}
          </LCard>

          {/* Breakdown */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <LCard>
              <LCardHead title="Category Breakdown" />
              {loading ? <LBone h={160} /> : chartData.length === 0 ? <LEmpty message="No expense data." /> : (
                <>
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={72} strokeWidth={2} stroke="#F8FAFC">
                        {chartData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v) => [formatCurrency(Number(v)), '']} contentStyle={{ background: '#fff', border: `1px solid ${L.border}`, borderRadius: 10, fontSize: 12, color: L.text }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                    {chartData.slice(0, 5).map((c, i) => (
                      <div key={c.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 9, height: 9, borderRadius: '50%', background: PIE_COLORS[i % PIE_COLORS.length], flexShrink: 0 }} />
                          <span style={{ fontSize: 12, color: L.textSub }}>{c.name}</span>
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 700, color: L.text, fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(c.value)}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </LCard>
            <LCard>
              <p style={{ fontSize: 11, color: L.textMuted, margin: '0 0 4px' }}>Total Expenses</p>
              <p style={{ fontSize: 22, fontWeight: 800, color: L.red, margin: 0, fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(totalExpenses)}</p>
              {topCategory && <p style={{ fontSize: 11, color: L.textMuted, margin: '4px 0 0' }}>Top: {topCategory.category} · {formatCurrency(topCategory.amount)}</p>}
            </LCard>
          </div>
        </div>

        <LDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title="Record Expense">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <LSelect label="Category" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </LSelect>
            <LInput label="Vendor / Description" value={form.vendorName} onChange={e => setForm(f => ({ ...f, vendorName: e.target.value }))} placeholder="e.g. Monthly rent" />
            <LInput label="Amount (₹)" type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" />
            <LInput label="Notes (optional)" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            <LButton onClick={save} loading={saving} style={{ width: '100%', justifyContent: 'center' }}>Record Expense</LButton>
          </div>
        </LDrawer>
      </div>
      <style>{`
        .l-kpi3{grid-template-columns:repeat(3,1fr)}
        .l-exp-grid{grid-template-columns:1fr 300px}
        @media(max-width:900px){.l-kpi3{grid-template-columns:1fr!important}.l-exp-grid{grid-template-columns:1fr!important}}
      `}</style>
    </div>
  )
}
