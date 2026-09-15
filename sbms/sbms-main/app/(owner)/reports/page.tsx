'use client'
import { useState } from 'react'
import { useApi } from '@/hooks/useApi'
import { TopBar } from '@/components/layout/TopBar'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { formatCurrency, formatDate } from '@/lib/utils'
import { BarChart3, Download, FileText } from 'lucide-react'
import toast from 'react-hot-toast'

const REPORT_TYPES = [
  { id: 'daily_pl', label: 'Daily P&L', description: 'Revenue, cost, and margin for a specific day' },
  { id: 'weekly_sales', label: 'Weekly Sales Summary', description: '7-day sales breakdown by product and staff' },
  { id: 'inventory_valuation', label: 'Inventory Valuation', description: 'Current stock value at cost and retail' },
  { id: 'expense_breakdown', label: 'Expense Breakdown', description: 'Category-wise expense analysis' },
  { id: 'receivables_aging', label: 'Receivables Aging', description: 'Outstanding receivables by age bucket' },
]

export default function ReportsPage() {
  const { apiFetch } = useApi()
  const [selectedReport, setSelectedReport] = useState('daily_pl')
  const [dateFrom, setDateFrom] = useState(new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0])
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0])
  const [reportData, setReportData] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(false)

  async function generateReport() {
    setLoading(true)
    try {
      let data: Record<string, unknown> = {}
      if (selectedReport === 'daily_pl' || selectedReport === 'weekly_sales') {
        const sales = await apiFetch<{ sales: unknown[] }>(`/api/sales?from=${dateFrom}&to=${dateTo}&limit=200`)
        data = { sales: sales.sales, from: dateFrom, to: dateTo }
      } else if (selectedReport === 'inventory_valuation') {
        const products = await apiFetch<unknown[]>('/api/products')
        data = { products }
      } else if (selectedReport === 'expense_breakdown') {
        const expenses = await apiFetch<{ expenses: unknown[]; categoryTotals: unknown[] }>(`/api/expenses?from=${dateFrom}&to=${dateTo}`)
        data = expenses
      } else if (selectedReport === 'receivables_aging') {
        const cf = await apiFetch<{ receivables: unknown[] }>('/api/cashflow')
        data = { receivables: cf.receivables }
      }
      setReportData(data)
      toast.success('Report generated')
    } catch {
      toast.error('Failed to generate report')
    } finally {
      setLoading(false)
    }
  }

  function exportCSV() {
    if (!reportData) return
    let csv = ''
    if (selectedReport === 'inventory_valuation') {
      const products = reportData.products as Record<string, unknown>[]
      csv = 'Name,SKU,Category,Stock,Cost Price,Retail Price,Stock Value (Cost),Stock Value (Retail)\n'
      products.forEach((p) => {
        const costVal = (p.stockQuantity as number) * (p.unitCost as number)
        const retailVal = (p.stockQuantity as number) * (p.retailPrice as number)
        csv += `"${p.name}","${p.sku}","${p.category}",${p.stockQuantity},${p.unitCost},${p.retailPrice},${costVal},${retailVal}\n`
      })
    } else if (selectedReport === 'expense_breakdown') {
      const expenses = reportData.expenses as Record<string, unknown>[]
      csv = 'Date,Category,Vendor,Amount\n'
      expenses.forEach((e) => {
        csv += `"${formatDate(e.expenseDate as string)}","${e.category}","${e.vendorName || ''}",${e.amount}\n`
      })
    } else if (selectedReport === 'receivables_aging') {
      const receivables = reportData.receivables as Record<string, unknown>[]
      csv = 'Customer,Amount,Due Date,Status\n'
      receivables.forEach((r) => {
        csv += `"${r.customerName}",${r.amount},"${formatDate(r.dueDate as string)}","${r.status}"\n`
      })
    }
    if (!csv) { toast.error('CSV export not available for this report type'); return }
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `sbms-${selectedReport}-${dateFrom}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <TopBar title="ReportHub" subtitle="Generate and export business reports" />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Report selector */}
        <div className="space-y-2">
          {REPORT_TYPES.map(r => (
            <button
              key={r.id}
              onClick={() => { setSelectedReport(r.id); setReportData(null) }}
              className={`w-full text-left p-3 rounded-xl border transition-all ${selectedReport === r.id ? 'bg-indigo-600/15 border-indigo-500/30 text-indigo-400' : 'bg-[#1A1D27] border-white/5 text-slate-400 hover:border-white/10'}`}
            >
              <p className="text-sm font-medium">{r.label}</p>
              <p className="text-[10px] mt-0.5 opacity-60">{r.description}</p>
            </button>
          ))}
        </div>

        {/* Report config + preview */}
        <div className="lg:col-span-3 space-y-4">
          <Card>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1.5">From</label>
                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none" />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1.5">To</label>
                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none" />
              </div>
              <Button onClick={generateReport} loading={loading}>
                <BarChart3 className="w-4 h-4" /> Generate Report
              </Button>
              {reportData && (
                <Button variant="secondary" onClick={exportCSV}>
                  <Download className="w-4 h-4" /> Export CSV
                </Button>
              )}
            </div>
          </Card>

          {reportData ? (
            <Card>
              <div className="flex items-center gap-2 mb-4">
                <FileText className="w-4 h-4 text-indigo-400" />
                <h3 className="text-sm font-medium text-white">{REPORT_TYPES.find(r => r.id === selectedReport)?.label}</h3>
                <span className="text-xs text-slate-500">{dateFrom} → {dateTo}</span>
              </div>

              {selectedReport === 'inventory_valuation' && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-white/5">{['Product', 'Stock', 'Cost', 'Retail', 'Value (Cost)', 'Value (Retail)'].map(h => <th key={h} className="text-left text-xs text-slate-500 pb-3 pr-4">{h}</th>)}</tr></thead>
                    <tbody className="divide-y divide-white/3">
                      {(reportData.products as Record<string, unknown>[])?.map((p) => (
                        <tr key={p.id as string} className="hover:bg-white/3">
                          <td className="py-2 pr-4 text-white text-xs">{p.name as string}</td>
                          <td className="py-2 pr-4 text-slate-400 text-xs">{p.stockQuantity as number}</td>
                          <td className="py-2 pr-4 text-slate-400 text-xs">{formatCurrency(p.unitCost as number)}</td>
                          <td className="py-2 pr-4 text-slate-400 text-xs">{formatCurrency(p.retailPrice as number)}</td>
                          <td className="py-2 pr-4 text-white text-xs">{formatCurrency((p.stockQuantity as number) * (p.unitCost as number))}</td>
                          <td className="py-2 text-emerald-400 text-xs">{formatCurrency((p.stockQuantity as number) * (p.retailPrice as number))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {selectedReport === 'receivables_aging' && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-white/5">{['Customer', 'Amount', 'Due Date', 'Status'].map(h => <th key={h} className="text-left text-xs text-slate-500 pb-3 pr-4">{h}</th>)}</tr></thead>
                    <tbody className="divide-y divide-white/3">
                      {(reportData.receivables as Record<string, unknown>[])?.map((r) => (
                        <tr key={r.id as string} className="hover:bg-white/3">
                          <td className="py-2 pr-4 text-white text-xs">{r.customerName as string}</td>
                          <td className="py-2 pr-4 text-white text-xs">{formatCurrency(r.amount as number)}</td>
                          <td className="py-2 pr-4 text-slate-400 text-xs">{formatDate(r.dueDate as string)}</td>
                          <td className="py-2 text-xs capitalize">{r.status as string}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {(selectedReport === 'expense_breakdown') && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-white/5">{['Date', 'Category', 'Vendor', 'Amount'].map(h => <th key={h} className="text-left text-xs text-slate-500 pb-3 pr-4">{h}</th>)}</tr></thead>
                    <tbody className="divide-y divide-white/3">
                      {(reportData.expenses as Record<string, unknown>[])?.map((e) => (
                        <tr key={e.id as string} className="hover:bg-white/3">
                          <td className="py-2 pr-4 text-slate-400 text-xs">{formatDate(e.expenseDate as string)}</td>
                          <td className="py-2 pr-4 text-slate-300 text-xs">{e.category as string}</td>
                          <td className="py-2 pr-4 text-slate-400 text-xs">{(e.vendorName as string) || '—'}</td>
                          <td className="py-2 text-white text-xs">{formatCurrency(e.amount as number)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          ) : (
            <div className="flex flex-col items-center justify-center h-48 bg-[#1A1D27] rounded-xl border border-white/5">
              <BarChart3 className="w-8 h-8 text-slate-600 mb-2" />
              <p className="text-sm text-slate-500">Select a report type and click Generate</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
