'use client'
import { useEffect, useState, useCallback } from 'react'
import { useApi } from '@/hooks/useApi'
import { TopBar } from '@/components/layout/TopBar'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Drawer } from '@/components/ui/Drawer'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Plus } from 'lucide-react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import toast from 'react-hot-toast'

const CATEGORIES = ['Rent', 'Utilities', 'Payroll', 'Supplies', 'Marketing', 'Logistics', 'Miscellaneous']
const COLORS = ['#6366F1', '#14B8A6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#10B981']

interface Expense {
  _id: string
  category: string
  vendorName: string
  amount: number
  expenseDate: string
  loggedBy: { name: string }
  isRecurring: boolean
}

interface CategoryTotal {
  category: string
  amount: number
}

export default function ExpensesPage() {
  const { apiFetch } = useApi()
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [categoryTotals, setCategoryTotals] = useState<CategoryTotal[]>([])
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [form, setForm] = useState({ category: 'Rent', vendorName: '', amount: '', notes: '', isRecurring: false })
  const [saving, setSaving] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState('')

  const load = useCallback(() => {
    apiFetch<{ expenses: Expense[]; categoryTotals: CategoryTotal[] }>(`/api/expenses?category=${categoryFilter}`)
      .then(d => {
        setExpenses(d.expenses)
        setCategoryTotals(d.categoryTotals)
      })
      .catch(console.error)
  }, [categoryFilter])

  useEffect(() => { load() }, [load])

  async function save() {
    setSaving(true)
    try {
      await apiFetch('/api/expenses', {
        method: 'POST',
        body: JSON.stringify({ ...form, amount: parseFloat(form.amount) })
      })
      toast.success('Expense recorded')
      setDrawerOpen(false)
      setForm({ category: 'Rent', vendorName: '', amount: '', notes: '', isRecurring: false })
      load()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const totalExpenses = categoryTotals.reduce((s, c) => s + (c.amount || 0), 0)

  const chartData = categoryTotals.map(c => ({
    name: c.category,
    value: Math.round(c.amount || 0)
  }))

  return (
    <div>
      <TopBar
        title="ExpenseLens"
        subtitle="Track and analyze business expenses"
        actions={
          <Button onClick={() => setDrawerOpen(true)} size="sm">
            <Plus className="w-3.5 h-3.5" /> Add Expense
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-slate-400">Expense Log</h3>
            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              className="bg-[#0F1117] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white"
            >
              <option value="">All Categories</option>
              {CATEGORIES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  {['Date', 'Category', 'Vendor', 'Amount', 'Logged by'].map(h => (
                    <th key={h} className="text-left text-xs text-slate-500 font-medium pb-3 pr-4">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/3">
                {expenses.map(e => (
                  <tr key={e._id} className="hover:bg-white/3">
                    <td className="py-3 pr-4 text-slate-400 text-xs">
                      {formatDate(e.expenseDate)}
                    </td>
                    <td className="py-3 pr-4">
                      <span className="inline-flex px-2 py-0.5 rounded-md text-xs bg-white/5 text-slate-300">
                        {e.category}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-slate-400">
                      {e.vendorName || '—'}
                    </td>
                    <td className="py-3 pr-4 font-medium text-white">
                      {formatCurrency(e.amount)}
                    </td>
                    <td className="py-3 text-slate-500 text-xs">
                      {e.loggedBy?.name}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <h3 className="text-sm font-medium text-slate-400 mb-3">
              Category Breakdown
            </h3>
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={65}>
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>

            <div className="space-y-2 mt-2">
              {chartData.map((c, i) => (
                <div key={c.name} className="flex justify-between text-xs">
                  <span>{c.name}</span>
                  <span>{formatCurrency(c.value)}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <p className="text-xs text-slate-500 mb-1">Total Expenses</p>
            <p className="text-2xl font-bold text-white">
              {formatCurrency(totalExpenses)}
            </p>
          </Card>
        </div>
      </div>

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title="Record Expense">
        <div className="space-y-4">
          <Input label="Vendor name" value={form.vendorName} onChange={e => setForm(f => ({ ...f, vendorName: e.target.value }))} />
          <Input label="Amount" type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
          <Button onClick={save} loading={saving} className="w-full">Record Expense</Button>
        </div>
      </Drawer>
    </div>
  )
}