'use client'
import { useState } from 'react'
import { useApi } from '@/hooks/useApi'
import { formatCurrency, formatDate } from '@/lib/utils'
import { BarChart3, Download, FileText } from 'lucide-react'
import toast from 'react-hot-toast'
import { L, LCard, LCardHead, LPageHeader, LButton, LTable, LTR, LTD, LEmpty } from '@/components/owner/LTheme'
import { OwnerTopBar } from '@/components/layout/OwnerTopBar'

const REPORT_TYPES = [
  { id: 'daily_pl',           label: 'Daily P&L',             desc: 'Revenue, cost, and margin for a specific day' },
  { id: 'weekly_sales',       label: 'Weekly Sales Summary',  desc: '7-day sales breakdown by product and staff' },
  { id: 'inventory_valuation',label: 'Inventory Valuation',   desc: 'Current stock value at cost and retail' },
  { id: 'expense_breakdown',  label: 'Expense Breakdown',     desc: 'Category-wise expense analysis' },
  { id: 'receivables_aging',  label: 'Receivables Aging',     desc: 'Outstanding receivables by age bucket' },
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
        data = { products: await apiFetch<unknown[]>('/api/products') }
      } else if (selectedReport === 'expense_breakdown') {
        data = await apiFetch<{ expenses: unknown[]; categoryTotals: unknown[] }>(`/api/expenses?from=${dateFrom}&to=${dateTo}`)
      } else if (selectedReport === 'receivables_aging') {
        const cf = await apiFetch<{ receivables: unknown[] }>('/api/cashflow')
        data = { receivables: cf.receivables }
      }
      setReportData(data)
      toast.success('Report generated')
    } catch { toast.error('Failed to generate report') }
    finally { setLoading(false) }
  }

  function exportCSV() {
    if (!reportData) return
    let csv = ''
    if (selectedReport === 'inventory_valuation') {
      const products = reportData.products as Record<string, unknown>[]
      csv = 'Name,SKU,Category,Stock,Cost Price,Retail Price,Stock Value (Cost),Stock Value (Retail)\n'
      products.forEach(p => { csv += `"${p.name}","${p.sku}","${p.category}",${p.stockQuantity},${p.unitCost},${p.retailPrice},${(p.stockQuantity as number) * (p.unitCost as number)},${(p.stockQuantity as number) * (p.retailPrice as number)}\n` })
    } else if (selectedReport === 'expense_breakdown') {
      const expenses = reportData.expenses as Record<string, unknown>[]
      csv = 'Date,Category,Vendor,Amount\n'
      expenses.forEach(e => { csv += `"${formatDate(e.expenseDate as string)}","${e.category}","${e.vendorName || ''}",${e.amount}\n` })
    } else if (selectedReport === 'receivables_aging') {
      const receivables = reportData.receivables as Record<string, unknown>[]
      csv = 'Customer,Amount,Due Date,Status\n'
      receivables.forEach(r => { csv += `"${r.customerOrVendor ?? r.customerName}",${r.amount},"${formatDate(r.dueDate as string)}","${r.status}"\n` })
    }
    if (!csv) { toast.error('CSV export not available for this report type'); return }
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `sbms-${selectedReport}-${dateFrom}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ background: L.bg, minHeight: '100vh', fontFamily: "'Inter', -apple-system, sans-serif" }}>
      <OwnerTopBar />
      <div style={{ padding: '24px 24px 40px', maxWidth: 1280, margin: '0 auto' }}>
        <LPageHeader title="Reports" subtitle="Generate and export business reports" />

        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 16, alignItems: 'start' }} className="l-report-grid">
          {/* Report type selector */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {REPORT_TYPES.map(r => (
              <button key={r.id} onClick={() => { setSelectedReport(r.id); setReportData(null) }} style={{
                textAlign: 'left', padding: '11px 14px', borderRadius: 10,
                border: `1.5px solid ${selectedReport === r.id ? L.blue : L.border}`,
                background: selectedReport === r.id ? L.blueLt : '#fff',
                cursor: 'pointer', transition: 'all 0.12s',
              }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: selectedReport === r.id ? L.blue : L.text, margin: '0 0 2px' }}>{r.label}</p>
                <p style={{ fontSize: 10, color: L.textMuted, margin: 0, lineHeight: 1.4 }}>{r.desc}</p>
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Controls */}
            <LCard>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: L.textSub, display: 'block', marginBottom: 5 }}>From</label>
                  <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ padding: '8px 12px', background: '#F8FAFC', border: `1.5px solid ${L.border}`, borderRadius: 9, fontSize: 13, color: L.text, outline: 'none' }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: L.textSub, display: 'block', marginBottom: 5 }}>To</label>
                  <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ padding: '8px 12px', background: '#F8FAFC', border: `1.5px solid ${L.border}`, borderRadius: 9, fontSize: 13, color: L.text, outline: 'none' }} />
                </div>
                <LButton onClick={generateReport} loading={loading}><BarChart3 style={{ width: 14, height: 14 }} /> Generate Report</LButton>
                {reportData && <LButton variant="secondary" onClick={exportCSV}><Download style={{ width: 14, height: 14 }} /> Export CSV</LButton>}
              </div>
            </LCard>

            {/* Report preview */}
            {reportData ? (
              <LCard>
                <LCardHead title={REPORT_TYPES.find(r => r.id === selectedReport)?.label ?? ''} subtitle={`${dateFrom} → ${dateTo}`} icon={<FileText style={{ width: 16, height: 16, color: L.blue }} />} />

                {selectedReport === 'inventory_valuation' && (
                  <LTable headers={['Product', 'Stock', 'Cost', 'Retail', 'Value (Cost)', 'Value (Retail)']}>
                    {(reportData.products as Record<string, unknown>[])?.map((p, i) => (
                      <LTR key={i}>
                        <LTD><span style={{ fontWeight: 600 }}>{p.name as string}</span></LTD>
                        <LTD muted>{p.stockQuantity as number}</LTD>
                        <LTD muted>{formatCurrency(p.unitCost as number)}</LTD>
                        <LTD muted>{formatCurrency(p.retailPrice as number)}</LTD>
                        <LTD>{formatCurrency((p.stockQuantity as number) * (p.unitCost as number))}</LTD>
                        <LTD><span style={{ color: L.green, fontWeight: 700 }}>{formatCurrency((p.stockQuantity as number) * (p.retailPrice as number))}</span></LTD>
                      </LTR>
                    ))}
                  </LTable>
                )}

                {selectedReport === 'receivables_aging' && (
                  <LTable headers={['Customer / Party', 'Amount', 'Due Date', 'Status']}>
                    {(reportData.receivables as Record<string, unknown>[])?.map((r, i) => (
                      <LTR key={i}>
                        <LTD><span style={{ fontWeight: 600 }}>{(r.customerOrVendor ?? r.customerName) as string}</span></LTD>
                        <LTD><span style={{ fontWeight: 700 }}>{formatCurrency(r.amount as number)}</span></LTD>
                        <LTD muted>{formatDate(r.dueDate as string)}</LTD>
                        <LTD><span style={{ textTransform: 'capitalize', fontSize: 12, color: r.status === 'overdue' ? L.red : r.status === 'paid' ? L.green : L.amber }}>{r.status as string}</span></LTD>
                      </LTR>
                    ))}
                  </LTable>
                )}

                {selectedReport === 'expense_breakdown' && (
                  <LTable headers={['Date', 'Category', 'Vendor', 'Amount']}>
                    {(reportData.expenses as Record<string, unknown>[])?.map((e, i) => (
                      <LTR key={i}>
                        <LTD muted>{formatDate(e.expenseDate as string)}</LTD>
                        <LTD><span style={{ fontWeight: 500 }}>{e.category as string}</span></LTD>
                        <LTD muted>{(e.vendorName as string) || '—'}</LTD>
                        <LTD><span style={{ fontWeight: 700 }}>{formatCurrency(e.amount as number)}</span></LTD>
                      </LTR>
                    ))}
                  </LTable>
                )}

                {(selectedReport === 'daily_pl' || selectedReport === 'weekly_sales') && (
                  <LTable headers={['Ref', 'Date', 'Total', 'Margin', 'Payment']}>
                    {(reportData.sales as Record<string, unknown>[])?.map((s, i) => (
                      <LTR key={i}>
                        <LTD><span style={{ fontFamily: 'monospace', fontSize: 12, color: L.blue }}>{s.transactionRef as string}</span></LTD>
                        <LTD muted>{formatDate(s.saleDate as string)}</LTD>
                        <LTD><span style={{ fontWeight: 700 }}>{formatCurrency(s.totalAmount as number)}</span></LTD>
                        <LTD><span style={{ color: L.green }}>{formatCurrency(s.grossMargin as number)}</span></LTD>
                        <LTD muted><span style={{ textTransform: 'capitalize' }}>{s.paymentMethod as string}</span></LTD>
                      </LTR>
                    ))}
                  </LTable>
                )}
              </LCard>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 180, background: '#fff', borderRadius: 16, border: `1px solid ${L.border}` }}>
                <BarChart3 style={{ width: 32, height: 32, color: L.textMuted, marginBottom: 8, opacity: 0.5 }} />
                <p style={{ fontSize: 13, color: L.textMuted, margin: 0 }}>Select a report type and click Generate</p>
              </div>
            )}
          </div>
        </div>
      </div>
      <style>{`.l-report-grid{grid-template-columns:220px 1fr} @media(max-width:768px){.l-report-grid{grid-template-columns:1fr!important}}`}</style>
    </div>
  )
}
