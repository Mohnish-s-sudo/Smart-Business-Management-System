'use client'
import { useEffect, useState, useCallback } from 'react'
import { useApi } from '@/hooks/useApi'
import { formatCurrency, daysOverdue } from '@/lib/utils'
import { Wallet, TrendingDown, Clock, CheckCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { L, LCard, LCardHead, LPageHeader, LStatCard, LBadge, LButton, LTable, LTR, LTD, LBone, LEmpty, LTabBar } from '@/components/owner/LTheme'
import { OwnerTopBar } from '@/components/layout/OwnerTopBar'

interface Receivable { _id: string; customerOrVendor: string; amount: number; dueDate: string; createdAt: string; status: string; saleId?: string }
interface Summary { totalOutstanding: number; totalOverdue: number; totalPayables: number; netPosition: number }

// Safe date formatter that handles null/undefined/invalid dates
function safeDate(d: string | null | undefined): string {
  if (!d) return 'N/A'
  const dt = new Date(d)
  if (isNaN(dt.getTime())) return 'N/A'
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function statusBadge(status: string) {
  if (status === 'paid') return <LBadge variant="success">Paid</LBadge>
  if (status === 'overdue') return <LBadge variant="danger">Overdue</LBadge>
  return <LBadge variant="warning">Pending</LBadge>
}

export default function CashFlowPage() {
  const { apiFetch } = useApi()
  const [receivables, setReceivables] = useState<Receivable[]>([])
  const [payables, setPayables] = useState<Receivable[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [tab, setTab] = useState('receivables')
  const [marking, setMarking] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    apiFetch<{ receivables: Receivable[]; payables: Receivable[]; summary: Summary }>('/api/cashflow')
      .then(d => { setReceivables(d.receivables ?? []); setPayables(d.payables ?? []); setSummary(d.summary) })
      .catch(() => {}).finally(() => setLoading(false))
  }, []) // eslint-disable-line

  useEffect(() => { load() }, [load])

  async function markPaid(id: string) {
    setMarking(id)
    try {
      await apiFetch(`/api/cashflow/receivables/${id}`, { method: 'PATCH', body: JSON.stringify({ status: 'paid' }) })
      toast.success('Marked as paid'); load()
    } catch { toast.error('Failed to update') }
    finally { setMarking(null) }
  }

  const netColor = (summary?.netPosition ?? 0) >= 0 ? L.green : L.red

  return (
    <div style={{ background: L.bg, minHeight: '100vh', fontFamily: "'Inter', -apple-system, sans-serif" }}>
      <OwnerTopBar />
      <div style={{ padding: '24px 24px 40px', maxWidth: 1280, margin: '0 auto' }}>
        <LPageHeader title="Cash Flow" subtitle="Receivables, payables, and net cash position" />

        {/* KPI strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 24 }} className="l-kpi4">
          <LStatCard label="Total Outstanding" value={formatCurrency(summary?.totalOutstanding ?? 0)} sub="pending receivables" icon={<Wallet style={{ width: 15, height: 15 }} />} accent={L.blue} accentLt={L.blueLt} accentMid={L.blueMid} loading={loading} />
          <LStatCard label="Total Overdue" value={formatCurrency(summary?.totalOverdue ?? 0)} sub="past due date" icon={<Clock style={{ width: 15, height: 15 }} />} accent={L.red} accentLt={L.redLt} accentMid={L.redMid} loading={loading} />
          <LStatCard label="Total Payables" value={formatCurrency(summary?.totalPayables ?? 0)} sub="owed to vendors" icon={<TrendingDown style={{ width: 15, height: 15 }} />} accent={L.amber} accentLt={L.amberLt} accentMid={L.amberMid} loading={loading} />
          <LStatCard label="Net Position" value={formatCurrency(summary?.netPosition ?? 0)} sub="outstanding − payables" icon={<CheckCircle style={{ width: 15, height: 15 }} />} accent={L.green} accentLt={L.greenLt} accentMid={L.greenMid} loading={loading} />
        </div>

        <LCard>
          <LTabBar tabs={['receivables', 'payables']} active={tab} onChange={setTab} />

          {loading ? <LBone h={240} /> : (
            <>
              {tab === 'receivables' && (
                receivables.length === 0
                  ? <LEmpty icon={<Wallet style={{ width: 28, height: 28 }} />} message="No receivables recorded." />
                  : (
                    <LTable headers={['Customer / Party', 'Amount', 'Created', 'Due Date', 'Overdue', 'Status', '']}>
                      {receivables.map(r => {
                        const od = r.status === 'overdue' ? daysOverdue(r.dueDate) : 0
                        return (
                          <LTR key={r._id} danger={r.status === 'overdue'}>
                            <LTD><span style={{ fontWeight: 600 }}>{r.customerOrVendor}</span></LTD>
                            <LTD><span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(r.amount)}</span></LTD>
                            <LTD muted>{safeDate(r.createdAt)}</LTD>
                            <LTD muted>{safeDate(r.dueDate)}</LTD>
                            <LTD>
                              {od > 0
                                ? <span style={{ color: L.red, fontWeight: 600, fontSize: 12 }}>{od}d overdue</span>
                                : <span style={{ color: L.textMuted }}>—</span>}
                            </LTD>
                            <LTD>{statusBadge(r.status)}</LTD>
                            <LTD>
                              {r.status !== 'paid' && (
                                <LButton size="sm" variant="secondary" loading={marking === r._id} onClick={() => markPaid(r._id)}>Mark paid</LButton>
                              )}
                            </LTD>
                          </LTR>
                        )
                      })}
                    </LTable>
                  )
              )}
              {tab === 'payables' && (
                payables.length === 0
                  ? <LEmpty icon={<TrendingDown style={{ width: 28, height: 28 }} />} message="No payables recorded." />
                  : (
                    <LTable headers={['Vendor / Party', 'Amount', 'Due Date', 'Status']}>
                      {payables.map(p => (
                        <LTR key={p._id} danger={p.status === 'overdue'}>
                          <LTD><span style={{ fontWeight: 600 }}>{p.customerOrVendor}</span></LTD>
                          <LTD><span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(p.amount)}</span></LTD>
                          <LTD muted>{safeDate(p.dueDate)}</LTD>
                          <LTD>{statusBadge(p.status)}</LTD>
                        </LTR>
                      ))}
                    </LTable>
                  )
              )}
            </>
          )}
        </LCard>
      </div>
      <style>{`.l-kpi4{grid-template-columns:repeat(4,1fr)} @media(max-width:900px){.l-kpi4{grid-template-columns:repeat(2,1fr)!important}} @media(max-width:480px){.l-kpi4{grid-template-columns:1fr!important}}`}</style>
    </div>
  )
}
