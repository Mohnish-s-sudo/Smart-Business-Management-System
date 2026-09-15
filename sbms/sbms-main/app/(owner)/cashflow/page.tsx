'use client'
import { useEffect, useState, useCallback } from 'react'
import { useApi } from '@/hooks/useApi'
import { TopBar } from '@/components/layout/TopBar'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { formatCurrency, formatDate, daysOverdue } from '@/lib/utils'
import { Wallet, TrendingDown, Clock, CheckCircle } from 'lucide-react'
import toast from 'react-hot-toast'

interface Receivable { _id: string; customerName: string; amount: number; saleDate: string; dueDate: string; status: string }
interface Payable { _id: string; vendorName: string; amount: number; dueDate: string; status: string }
interface Summary { totalOutstanding: number; totalOverdue: number; totalPayables: number; netPosition: number }

export default function CashFlowPage() {
  const { apiFetch } = useApi()
  const [receivables, setReceivables] = useState<Receivable[]>([])
  const [payables, setPayables] = useState<Payable[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [tab, setTab] = useState<'receivables' | 'payables'>('receivables')
  const [marking, setMarking] = useState<string | null>(null)

  const load = useCallback(() => {
    apiFetch<{ receivables: Receivable[]; payables: Payable[]; summary: Summary }>('/api/cashflow')
      .then(d => { setReceivables(d.receivables); setPayables(d.payables); setSummary(d.summary) })
      .catch(console.error)
  }, [])

  useEffect(() => { load() }, [load])

  async function markPaid(_id: string) {
    setMarking(_id)
    try {
      await apiFetch(`/api/cashflow/receivables/${_id}`, { method: 'PATCH', body: JSON.stringify({ status: 'paid' }) })
      toast.success('Marked as paid')
      load()
    } catch {
      toast.error('Failed to update')
    } finally {
      setMarking(null)
    }
  }

  const statusBadge = (status: string) => {
    if (status === 'paid') return <Badge variant="success">Paid</Badge>
    if (status === 'overdue') return <Badge variant="critical">Overdue</Badge>
    return <Badge variant="warning">Pending</Badge>
  }

  return (
    <div>
      <TopBar title="CashFlow360" subtitle="Receivables, payables, and net cash position" />

      {/* Summary strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Outstanding', value: formatCurrency(summary?.totalOutstanding || 0), icon: <Wallet className="w-4 h-4 text-indigo-400" />, color: 'border-indigo-500/20' },
          { label: 'Total Overdue', value: formatCurrency(summary?.totalOverdue || 0), icon: <Clock className="w-4 h-4 text-red-400" />, color: 'border-red-500/20' },
          { label: 'Total Payables', value: formatCurrency(summary?.totalPayables || 0), icon: <TrendingDown className="w-4 h-4 text-amber-400" />, color: 'border-amber-500/20' },
          { label: 'Net Position', value: formatCurrency(summary?.netPosition || 0), icon: <CheckCircle className="w-4 h-4 text-emerald-400" />, color: 'border-emerald-500/20' },
        ].map(k => (
          <div key={k.label} className={`bg-[#1A1D27] border ${k.color} rounded-xl p-4`}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-slate-400">{k.label}</p>
              {k.icon}
            </div>
            <p className="text-xl font-bold text-white font-mono">{k.value}</p>
          </div>
        ))}
      </div>

      <Card>
        {/* Tabs */}
        <div className="flex gap-1 mb-5 bg-white/3 rounded-lg p-1 w-fit">
          {(['receivables', 'payables'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors capitalize ${tab === t ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>
              {t}
            </button>
          ))}
        </div>

        {tab === 'receivables' && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                {['Customer', 'Amount', 'Sale Date', 'Due Date', 'Overdue', 'Status', ''].map(h => (
                  <th key={h} className="text-left text-xs text-slate-500 font-medium pb-3 pr-4">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/3">
              {receivables.map(r => {
                const overdueDays = r.status === 'overdue' ? daysOverdue(r.dueDate) : 0
                return (
                  <tr key={r._id} className={`hover:bg-white/3 transition-colors ${r.status === 'overdue' ? 'bg-red-500/3' : ''}`}>
                    <td className="py-3 pr-4 font-medium text-white">{r.customerName}</td>
                    <td className="py-3 pr-4 font-mono text-white">{formatCurrency(r.amount)}</td>
                    <td className="py-3 pr-4 text-slate-400 text-xs">{formatDate(r.saleDate)}</td>
                    <td className="py-3 pr-4 text-slate-400 text-xs">{formatDate(r.dueDate)}</td>
                    <td className="py-3 pr-4">
                      {overdueDays > 0 ? <span className="text-red-400 font-medium">{overdueDays}d overdue</span> : <span className="text-slate-600">—</span>}
                    </td>
                    <td className="py-3 pr-4">{statusBadge(r.status)}</td>
                    <td className="py-3">
                      {r.status !== 'paid' && (
                        <Button size="sm" variant="secondary" loading={marking === r._id} onClick={() => markPaid(r._id)}>
                          Mark paid
                        </Button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}

        {tab === 'payables' && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                {['Vendor', 'Amount', 'Due Date', 'Status'].map(h => (
                  <th key={h} className="text-left text-xs text-slate-500 font-medium pb-3 pr-4">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/3">
              {payables.map(p => (
                <tr key={p._id} className={`hover:bg-white/3 transition-colors ${p.status === 'overdue' ? 'bg-red-500/3' : ''}`}>
                  <td className="py-3 pr-4 font-medium text-white">{p.vendorName}</td>
                  <td className="py-3 pr-4 font-mono text-white">{formatCurrency(p.amount)}</td>
                  <td className="py-3 pr-4 text-slate-400 text-xs">{formatDate(p.dueDate)}</td>
                  <td className="py-3">{statusBadge(p.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}
