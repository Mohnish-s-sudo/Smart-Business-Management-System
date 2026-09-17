'use client'
import { useEffect, useState, useCallback } from 'react'
import { useApi } from '@/hooks/useApi'
import { Bell, Mail, MessageCircle, Send, CheckCircle, AlertTriangle, Info } from 'lucide-react'
import toast from 'react-hot-toast'
import { L, LCard, LPageHeader, LBadge, LButton, LBone, LEmpty, LFilterChips } from '@/components/owner/LTheme'
import { OwnerTopBar } from '@/components/layout/OwnerTopBar'

interface Alert { _id: string; alertType: string; severity: string; message: string; deliveryStatus: string; channel: string; createdAt: string; acknowledgedAt: string | null }

const channelIcon = (c: string) => {
  if (c === 'email') return <Mail style={{ width: 12, height: 12 }} />
  if (c === 'whatsapp') return <MessageCircle style={{ width: 12, height: 12 }} />
  if (c === 'telegram') return <Send style={{ width: 12, height: 12 }} />
  return <Bell style={{ width: 12, height: 12 }} />
}

function AlertCard({ a, onAck, loading }: { a: Alert; onAck: () => void; loading: boolean }) {
  const severityStyle = a.severity === 'critical'
    ? { bg: L.redLt, border: L.redMid, accent: L.red }
    : a.severity === 'warning'
    ? { bg: L.amberLt, border: L.amberMid, accent: L.amber }
    : { bg: L.blueLt, border: L.blueMid, accent: L.blue }

  return (
    <div style={{
      padding: '16px', borderRadius: 12,
      background: a.acknowledgedAt ? '#F8FAFC' : severityStyle.bg,
      border: `1.5px solid ${a.acknowledgedAt ? L.border : severityStyle.border}`,
      opacity: a.acknowledgedAt ? 0.6 : 1, transition: 'all 0.15s',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
            <LBadge variant={a.severity === 'critical' ? 'danger' : a.severity === 'warning' ? 'warning' : 'info'}>{a.severity}</LBadge>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: L.textMuted }}>
              {channelIcon(a.channel)}<span style={{ textTransform: 'capitalize' }}>{a.channel}</span>
            </div>
            <LBadge variant={a.deliveryStatus === 'sent' ? 'success' : 'default'}>{a.deliveryStatus === 'sent' ? 'Delivered' : a.deliveryStatus === 'failed' ? 'Failed' : 'Pending'}</LBadge>
            {a.acknowledgedAt && <LBadge variant="success">✓ Acknowledged</LBadge>}
          </div>
          <p style={{ fontSize: 13, fontWeight: 500, color: L.text, margin: '0 0 6px', lineHeight: 1.5 }}>{a.message}</p>
          <p style={{ fontSize: 11, color: L.textMuted, margin: 0 }}>
            {new Date(a.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        {!a.acknowledgedAt && (
          <LButton size="sm" variant="secondary" loading={loading} onClick={onAck}>
            <CheckCircle style={{ width: 12, height: 12 }} /> Ack
          </LButton>
        )}
      </div>
    </div>
  )
}

export default function AlertsPage() {
  const { apiFetch } = useApi()
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [severityFilter, setSeverityFilter] = useState('')
  const [acknowledging, setAcknowledging] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    apiFetch<Alert[]>('/api/alerts').then(setAlerts).catch(() => {}).finally(() => setLoading(false))
  }, []) // eslint-disable-line

  useEffect(() => { load() }, [load])

  async function acknowledge(id: string) {
    setAcknowledging(id)
    try {
      await apiFetch('/api/alerts', { method: 'PATCH', body: JSON.stringify({ id }) })
      toast.success('Alert acknowledged'); load()
    } catch { toast.error('Failed') }
    finally { setAcknowledging(null) }
  }

  const filtered = severityFilter ? alerts.filter(a => a.severity === severityFilter) : alerts
  const criticalCount = alerts.filter(a => a.severity === 'critical' && !a.acknowledgedAt).length

  return (
    <div style={{ background: L.bg, minHeight: '100vh', fontFamily: "'Inter', -apple-system, sans-serif" }}>
      <OwnerTopBar alertCount={criticalCount} />
      <div style={{ padding: '24px 24px 40px', maxWidth: 1280, margin: '0 auto' }}>
        <LPageHeader title="Alerts" subtitle={`${alerts.length} total · ${criticalCount} unacknowledged critical`} />

        {criticalCount > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: L.redLt, border: `1px solid ${L.redMid}`, borderRadius: 10, marginBottom: 20, fontSize: 13, color: L.red, fontWeight: 500 }}>
            <AlertTriangle style={{ width: 15, height: 15, flexShrink: 0 }} />
            {criticalCount} critical alert{criticalCount > 1 ? 's' : ''} require your attention
          </div>
        )}

        <LFilterChips
          options={[{ value: '', label: 'All' }, { value: 'critical', label: 'Critical' }, { value: 'warning', label: 'Warning' }, { value: 'info', label: 'Info' }]}
          active={severityFilter}
          onChange={setSeverityFilter}
        />

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1, 2, 3].map(i => <LBone key={i} h={80} />)}
          </div>
        ) : filtered.length === 0 ? (
          <LCard><LEmpty icon={<Bell style={{ width: 32, height: 32 }} />} message="No alerts found." /></LCard>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.map(a => (
              <AlertCard key={a._id} a={a} onAck={() => acknowledge(a._id)} loading={acknowledging === a._id} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
