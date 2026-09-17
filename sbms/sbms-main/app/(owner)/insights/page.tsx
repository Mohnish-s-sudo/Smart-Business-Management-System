'use client'
import { useEffect, useState, useCallback } from 'react'
import { useApi } from '@/hooks/useApi'
import { getUrgencyColor, getConfidenceColor } from '@/lib/utils'
import { Sparkles, ChevronDown, ChevronUp, CheckCircle, X, TrendingUp } from 'lucide-react'
import toast from 'react-hot-toast'
import { L, LCard, LPageHeader, LBadge, LButton, LBone, LEmpty, LFilterChips } from '@/components/owner/LTheme'
import { OwnerTopBar } from '@/components/layout/OwnerTopBar'

interface Recommendation { _id: string; module: string; title: string; detectedPattern: string; businessImpact: string; confidence: string; urgency: string; ownerAction: string; dataBasis: string; status: string; createdAt: string }

export default function InsightsPage() {
  const { apiFetch } = useApi()
  const [recs, setRecs] = useState<Recommendation[]>([])
  const [expanded, setExpanded] = useState<string | null>(null)
  const [moduleFilter, setModuleFilter] = useState('')
  const [urgencyFilter, setUrgencyFilter] = useState('')
  const [updating, setUpdating] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    apiFetch<Recommendation[]>(`/api/recommendations?module=${moduleFilter}&urgency=${urgencyFilter}`)
      .then(setRecs).catch(() => {}).finally(() => setLoading(false))
  }, [moduleFilter, urgencyFilter]) // eslint-disable-line

  useEffect(() => { load() }, [load])

  async function updateStatus(id: string, status: string) {
    setUpdating(id)
    try {
      await apiFetch('/api/recommendations', { method: 'PATCH', body: JSON.stringify({ id, status }) })
      toast.success(status === 'resolved' ? 'Marked as resolved' : 'Dismissed'); load()
    } catch { toast.error('Failed') }
    finally { setUpdating(null) }
  }

  const urgentCount = recs.filter(r => r.urgency === 'urgent').length

  const urgencyStyle = (u: string) => u === 'urgent'
    ? { bg: L.redLt, border: L.redMid }
    : u === 'monitor'
    ? { bg: L.amberLt, border: L.amberMid }
    : { bg: L.blueLt, border: L.blueMid }

  return (
    <div style={{ background: L.bg, minHeight: '100vh', fontFamily: "'Inter', -apple-system, sans-serif" }}>
      <OwnerTopBar />
      <div style={{ padding: '24px 24px 40px', maxWidth: 1280, margin: '0 auto' }}>
        <LPageHeader title="Analytics & Insights" subtitle={`${recs.length} active insights · ${urgentCount} require immediate action`} />

        {urgentCount > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: L.redLt, border: `1px solid ${L.redMid}`, borderRadius: 10, marginBottom: 20, fontSize: 13, color: L.red, fontWeight: 500 }}>
            <Sparkles style={{ width: 15, height: 15, flexShrink: 0 }} />
            {urgentCount} urgent insight{urgentCount > 1 ? 's' : ''} detected — estimated impact visible below
          </div>
        )}

        {/* Filters */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          <select value={moduleFilter} onChange={e => setModuleFilter(e.target.value)} style={{ padding: '7px 12px', background: '#fff', border: `1.5px solid ${L.border}`, borderRadius: 9, fontSize: 12, color: L.text, outline: 'none', cursor: 'pointer' }}>
            <option value="">All Modules</option>
            {['Sales', 'Inventory', 'Expenses', 'CashFlow'].map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <select value={urgencyFilter} onChange={e => setUrgencyFilter(e.target.value)} style={{ padding: '7px 12px', background: '#fff', border: `1.5px solid ${L.border}`, borderRadius: 9, fontSize: 12, color: L.text, outline: 'none', cursor: 'pointer' }}>
            <option value="">All Urgency</option>
            {['urgent', 'monitor', 'informational'].map(u => <option key={u} value={u} style={{ textTransform: 'capitalize' }}>{u}</option>)}
          </select>
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1, 2, 3].map(i => <LBone key={i} h={100} />)}
          </div>
        ) : recs.length === 0 ? (
          <LCard><LEmpty icon={<Sparkles style={{ width: 32, height: 32 }} />} message="No active insights for the selected filters." /></LCard>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {recs.map(r => {
              const s = urgencyStyle(r.urgency)
              return (
                <div key={r._id} style={{ borderRadius: 14, border: `1.5px solid ${s.border}`, background: s.bg, overflow: 'hidden' }}>
                  <div style={{ padding: '16px 18px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                          <LBadge variant={r.urgency === 'urgent' ? 'danger' : r.urgency === 'monitor' ? 'warning' : 'info'}>{r.urgency}</LBadge>
                          <LBadge variant="default">{r.module}</LBadge>
                          <LBadge variant={r.confidence === 'high' ? 'success' : r.confidence === 'medium' ? 'warning' : 'muted'}>{r.confidence} confidence</LBadge>
                        </div>
                        <h3 style={{ fontSize: 14, fontWeight: 700, color: L.text, margin: '0 0 4px' }}>{r.title}</h3>
                        <p style={{ fontSize: 12, color: L.textSub, margin: 0, lineHeight: 1.5 }}>{r.detectedPattern}</p>
                      </div>
                      <button onClick={() => setExpanded(expanded === r._id ? null : r._id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: L.textMuted, padding: 4 }}>
                        {expanded === r._id ? <ChevronUp style={{ width: 15, height: 15 }} /> : <ChevronDown style={{ width: 15, height: 15 }} />}
                      </button>
                    </div>

                    <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 9, background: 'rgba(255,255,255,0.7)', border: `1px solid rgba(255,255,255,0.5)` }}>
                      <p style={{ fontSize: 10, fontWeight: 700, color: L.textMuted, margin: '0 0 3px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Estimated Business Impact</p>
                      <p style={{ fontSize: 13, fontWeight: 700, color: L.text, margin: 0 }}>{r.businessImpact}</p>
                    </div>

                    {expanded === r._id && (
                      <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid rgba(0,0,0,0.06)`, display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div>
                          <p style={{ fontSize: 10, fontWeight: 700, color: L.textMuted, textTransform: 'uppercase', marginBottom: 4 }}>Recommended Action</p>
                          <p style={{ fontSize: 13, color: L.text, lineHeight: 1.5, margin: 0 }}>{r.ownerAction}</p>
                        </div>
                        <div>
                          <p style={{ fontSize: 10, fontWeight: 700, color: L.textMuted, textTransform: 'uppercase', marginBottom: 4 }}>Data Basis</p>
                          <p style={{ fontSize: 12, color: L.textSub, margin: 0 }}>{r.dataBasis}</p>
                        </div>
                        <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
                          <LButton size="sm" variant="primary" loading={updating === r._id} onClick={() => updateStatus(r._id, 'resolved')}>
                            <CheckCircle style={{ width: 12, height: 12 }} /> Mark resolved
                          </LButton>
                          <LButton size="sm" variant="ghost" loading={updating === r._id} onClick={() => updateStatus(r._id, 'dismissed')}>
                            <X style={{ width: 12, height: 12 }} /> Dismiss
                          </LButton>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
