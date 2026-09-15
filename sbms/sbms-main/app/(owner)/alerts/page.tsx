'use client'
import { useEffect, useState, useCallback } from 'react'
import { useApi } from '@/hooks/useApi'
import { TopBar } from '@/components/layout/TopBar'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { getSeverityColor } from '@/lib/utils'
import { Bell, Mail, MessageCircle, Send, CheckCircle } from 'lucide-react'
import toast from 'react-hot-toast'

interface Alert { _id: string; alertType: string; severity: string; message: string; deliveryStatus: string; channel: string; createdAt: string; acknowledgedAt: string | null }

const channelIcon = (channel: string) => {
  if (channel === 'email') return <Mail className="w-3.5 h-3.5" />
  if (channel === 'whatsapp') return <MessageCircle className="w-3.5 h-3.5" />
  if (channel === 'telegram') return <Send className="w-3.5 h-3.5" />
  return <Bell className="w-3.5 h-3.5" />
}

const deliveryBadge = (status: string) => {
  if (status === 'sent') return <Badge variant="success">Delivered</Badge>
  if (status === 'failed') return <Badge variant="critical">Failed</Badge>
  return <Badge variant="muted">Pending</Badge>
}

export default function AlertsPage() {
  const { apiFetch } = useApi()
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [severityFilter, setSeverityFilter] = useState('')
  const [acknowledging, setAcknowledging] = useState<string | null>(null)

  const load = useCallback(() => {
    apiFetch<Alert[]>('/api/alerts').then(setAlerts).catch(console.error)
  }, [])

  useEffect(() => { load() }, [load])

  async function acknowledge(_id: string) {
    setAcknowledging(_id)
    try {
      await apiFetch('/api/alerts', { method: 'PATCH', body: JSON.stringify({ id: _id }) })  // API still expects { id }
      toast.success('Alert acknowledged')
      load()
    } catch {
      toast.error('Failed')
    } finally {
      setAcknowledging(null) }
  }

  const filtered = severityFilter ? alerts.filter(a => a.severity === severityFilter) : alerts
  const criticalCount = alerts.filter(a => a.severity === 'critical' && !a.acknowledgedAt).length

  return (
    <div>
      <TopBar title="AlertCommand" subtitle={`${alerts.length} alerts · ${criticalCount} unacknowledged critical`} />

      {criticalCount > 0 && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 mb-5 text-sm text-red-400">
          <Bell className="w-4 h-4 flex-shrink-0 animate-pulse" />
          {criticalCount} critical alert{criticalCount > 1 ? 's' : ''} require your attention
        </div>
      )}

      <div className="flex gap-2 mb-5">
        {['', 'critical', 'warning', 'info'].map(s => (
          <button key={s} onClick={() => setSeverityFilter(s)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${severityFilter === s ? 'bg-indigo-600 text-white' : 'bg-white/5 text-slate-400 hover:text-white'}`}>
            {s || 'All'}
          </button>
        ))}
      </div>

      <Card>
        <div className="space-y-2">
          {filtered.map(a => (
            <div key={a._id} className={`p-4 rounded-xl border transition-all ${getSeverityColor(a.severity)} ${a.acknowledgedAt ? 'opacity-50' : ''}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <Badge variant={a.severity === 'critical' ? 'critical' : a.severity === 'warning' ? 'warning' : 'info'}>
                      {a.severity}
                    </Badge>
                    <div className="flex items-center gap-1 text-xs opacity-60">
                      {channelIcon(a.channel)}
                      <span className="capitalize">{a.channel}</span>
                    </div>
                    {deliveryBadge(a.deliveryStatus)}
                    {a.acknowledgedAt && <Badge variant="success"><CheckCircle className="w-3 h-3 mr-1" />Acknowledged</Badge>}
                  </div>
                  <p className="text-sm text-white leading-relaxed">{a.message}</p>
                  <p className="text-[10px] opacity-50 mt-1.5">
                    {new Date(a.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                {!a.acknowledgedAt && (
                  <Button size="sm" variant="ghost" loading={acknowledging === a._id} onClick={() => acknowledge(a._id)}>
                    <CheckCircle className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
