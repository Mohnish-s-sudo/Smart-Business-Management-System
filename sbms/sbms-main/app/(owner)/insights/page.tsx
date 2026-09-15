'use client'
import { useEffect, useState, useCallback } from 'react'
import { useApi } from '@/hooks/useApi'
import { TopBar } from '@/components/layout/TopBar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { getUrgencyColor, getConfidenceColor } from '@/lib/utils'
import { Sparkles, ChevronDown, ChevronUp, CheckCircle, X } from 'lucide-react'
import toast from 'react-hot-toast'

interface Recommendation {
  _id: string; module: string; title: string; detectedPattern: string
  businessImpact: string; confidence: string; urgency: string
  ownerAction: string; dataBasis: string; status: string; createdAt: string
}

export default function InsightsPage() {
  const { apiFetch } = useApi()
  const [recs, setRecs] = useState<Recommendation[]>([])
  const [expanded, setExpanded] = useState<string | null>(null)
  const [moduleFilter, setModuleFilter] = useState('')
  const [urgencyFilter, setUrgencyFilter] = useState('')
  const [updating, setUpdating] = useState<string | null>(null)

  const load = useCallback(() => {
    apiFetch<Recommendation[]>(`/api/recommendations?module=${moduleFilter}&urgency=${urgencyFilter}`)
      .then(setRecs).catch(console.error)
  }, [moduleFilter, urgencyFilter])

  useEffect(() => { load() }, [load])

  async function updateStatus(_id: string, status: string) {
    setUpdating(_id)
    try {
      await apiFetch('/api/recommendations', { method: 'PATCH', body: JSON.stringify({ id: _id, status }) })
      toast.success(status === 'resolved' ? 'Marked as resolved' : 'Dismissed')
      load()
    } catch {
      toast.error('Failed to update')
    } finally {
      setUpdating(null) }
  }

  const urgentCount = recs.filter(r => r.urgency === 'urgent').length

  return (
    <div>
      <TopBar
        title="ProfitPulse AI"
        subtitle={`${recs.length} active insights · ${urgentCount} require immediate action`}
      />

      {urgentCount > 0 && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 mb-5 text-sm text-red-400">
          <Sparkles className="w-4 h-4 flex-shrink-0" />
          {urgentCount} urgent insight{urgentCount > 1 ? 's' : ''} detected — estimated impact visible below
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 mb-5">
        <select value={moduleFilter} onChange={e => setModuleFilter(e.target.value)} className="bg-[#1A1D27] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none">
          <option value="">All Modules</option>
          {['Sales', 'Inventory', 'Expenses', 'CashFlow'].map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <select value={urgencyFilter} onChange={e => setUrgencyFilter(e.target.value)} className="bg-[#1A1D27] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none">
          <option value="">All Urgency</option>
          {['urgent', 'monitor', 'informational'].map(u => <option key={u} value={u} className="capitalize">{u}</option>)}
        </select>
      </div>

      <div className="space-y-3">
        {recs.map(r => (
          <div key={r._id} className={`rounded-xl border transition-all ${getUrgencyColor(r.urgency)}`}>
            <div className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <Badge variant={r.urgency === 'urgent' ? 'critical' : r.urgency === 'monitor' ? 'warning' : 'info'}>
                      {r.urgency}
                    </Badge>
                    <Badge variant="muted">{r.module}</Badge>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${getConfidenceColor(r.confidence)}`}>
                      {r.confidence} confidence
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-white mb-1">{r.title}</h3>
                  <p className="text-xs opacity-80 leading-relaxed">{r.detectedPattern}</p>
                </div>
                <button onClick={() => setExpanded(expanded === r._id ? null : r._id)} className="p-1.5 rounded-lg hover:bg-white/10 flex-shrink-0">
                  {expanded === r._id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              </div>

              {/* Impact highlight */}
              <div className="mt-3 p-3 rounded-lg bg-black/20 border border-white/5">
                <p className="text-[10px] text-slate-500 mb-0.5">Estimated Business Impact</p>
                <p className="text-sm font-semibold text-white">{r.businessImpact}</p>
              </div>

              {/* Expanded detail */}
              {expanded === r._id && (
                <div className="mt-4 space-y-3 border-t border-white/10 pt-4">
                  <div>
                    <p className="text-[10px] text-slate-500 mb-1">Recommended Action</p>
                    <p className="text-sm text-white leading-relaxed">{r.ownerAction}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 mb-1">Data Basis</p>
                    <p className="text-xs opacity-60">{r.dataBasis}</p>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" variant="secondary" loading={updating === r._id} onClick={() => updateStatus(r._id, 'resolved')}>
                      <CheckCircle className="w-3.5 h-3.5" /> Mark resolved
                    </Button>
                    <Button size="sm" variant="ghost" loading={updating === r._id} onClick={() => updateStatus(r._id, 'dismissed')}>
                      <X className="w-3.5 h-3.5" /> Dismiss
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {recs.length === 0 && (
          <div className="text-center py-16">
            <Sparkles className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">No active insights for the selected filters</p>
          </div>
        )}
      </div>
    </div>
  )
}
