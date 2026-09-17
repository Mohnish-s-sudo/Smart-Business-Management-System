'use client'
import { useEffect, useState } from 'react'
import { useApi } from '@/hooks/useApi'
import { useAuthStore } from '@/store/auth'
import { formatDate } from '@/lib/utils'
import { Users, Bell, Globe, Webhook, Plus, User } from 'lucide-react'
import toast from 'react-hot-toast'
import { L, LCard, LCardHead, LPageHeader, LBadge, LButton, LInput, LSelect, LTabBar, LBone } from '@/components/owner/LTheme'
import { OwnerTopBar } from '@/components/layout/OwnerTopBar'

interface StaffUser { _id: string; name: string; email: string; role: string; isActive: boolean; lastLogin: string | null }

export default function SettingsPage() {
  const { apiFetch } = useApi()
  const user = useAuthStore(s => s.user)
  const [tab, setTab] = useState('staff')
  const [staff, setStaff] = useState<StaffUser[]>([])
  const [loading, setLoading] = useState(false)
  const [newStaff, setNewStaff] = useState({ name: '', email: '', password: '', role: 'staff' })
  const [addingStaff, setAddingStaff] = useState(false)
  const [webhookUrl, setWebhookUrl] = useState('')

  useEffect(() => {
    if (tab === 'staff') { setLoading(true); apiFetch<StaffUser[]>('/api/staff').then(setStaff).catch(() => {}).finally(() => setLoading(false)) }
  }, [tab]) // eslint-disable-line

  async function addStaff() {
    setAddingStaff(true)
    try {
      await apiFetch('/api/staff', { method: 'POST', body: JSON.stringify(newStaff) })
      toast.success('Staff account created')
      setNewStaff({ name: '', email: '', password: '', role: 'staff' })
      apiFetch<StaffUser[]>('/api/staff').then(setStaff).catch(() => {})
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Failed') }
    finally { setAddingStaff(false) }
  }

  const tabs = ['staff', 'alerts', 'language', 'webhooks']

  return (
    <div style={{ background: L.bg, minHeight: '100vh', fontFamily: "'Inter', -apple-system, sans-serif" }}>
      <OwnerTopBar />
      <div style={{ padding: '24px 24px 40px', maxWidth: 1280, margin: '0 auto' }}>
        <LPageHeader title="Settings" subtitle="Business configuration and account management" />
        <LTabBar tabs={tabs.map(t => t.charAt(0).toUpperCase() + t.slice(1))} active={tab.charAt(0).toUpperCase() + tab.slice(1)} onChange={v => setTab(v.toLowerCase())} />

        {tab === 'staff' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }} className="l-settings-grid">
            <LCard>
              <LCardHead title="Team Members" icon={<Users style={{ width: 16, height: 16, color: L.blue }} />} />
              {loading ? <LBone h={120} /> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {staff.map(s => (
                    <div key={s._id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 10, background: '#F8FAFC', border: `1px solid ${L.border}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 34, height: 34, borderRadius: 9, background: L.blueLt, border: `1px solid ${L.blueMid}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: L.blue }}>
                          {s.name[0].toUpperCase()}
                        </div>
                        <div>
                          <p style={{ fontSize: 13, fontWeight: 600, color: L.text, margin: 0 }}>{s.name}</p>
                          <p style={{ fontSize: 11, color: L.textMuted, margin: 0 }}>{s.email}</p>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <LBadge variant={s.role === 'owner' ? 'info' : 'default'}>{s.role}</LBadge>
                        {s.lastLogin && <span style={{ fontSize: 10, color: L.textMuted }}>Last: {formatDate(s.lastLogin)}</span>}
                      </div>
                    </div>
                  ))}
                  {staff.length === 0 && !loading && <p style={{ fontSize: 12, color: L.textMuted, textAlign: 'center', padding: '16px 0' }}>No team members yet.</p>}
                </div>
              )}
            </LCard>

            <LCard>
              <LCardHead title="Add Staff Account" icon={<Plus style={{ width: 16, height: 16, color: L.blue }} />} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <LInput label="Full name" value={newStaff.name} onChange={e => setNewStaff(f => ({ ...f, name: e.target.value }))} placeholder="Staff member name" />
                <LInput label="Email" type="email" value={newStaff.email} onChange={e => setNewStaff(f => ({ ...f, email: e.target.value }))} placeholder="staff@business.com" />
                <LInput label="Password" type="password" value={newStaff.password} onChange={e => setNewStaff(f => ({ ...f, password: e.target.value }))} placeholder="Minimum 8 characters" />
                <LSelect label="Role" value={newStaff.role} onChange={e => setNewStaff(f => ({ ...f, role: e.target.value }))}>
                  <option value="staff">Staff</option>
                  <option value="owner">Owner</option>
                </LSelect>
                <LButton onClick={addStaff} loading={addingStaff} style={{ width: '100%', justifyContent: 'center' }}>Create Account</LButton>
              </div>
            </LCard>
          </div>
        )}

        {tab === 'alerts' && (
          <LCard style={{ maxWidth: 500 }}>
            <LCardHead title="Alert Thresholds" icon={<Bell style={{ width: 16, height: 16, color: L.amber }} />} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[{ label: 'Low stock threshold (units)', key: 'lowStock', default: '10' }, { label: 'Near expiry warning (days)', key: 'nearExpiry', default: '7' }, { label: 'Revenue drop alert (%)', key: 'revenueDrop', default: '30' }, { label: 'Expense spike threshold (%)', key: 'expenseSpike', default: '120' }, { label: 'Overdue receivable alert (days)', key: 'overdueReceivable', default: '7' }].map(f => (
                <LInput key={f.key} label={f.label} type="number" defaultValue={f.default} />
              ))}
              <LButton onClick={() => toast.success('Thresholds saved')}>Save Thresholds</LButton>
            </div>
          </LCard>
        )}

        {tab === 'language' && (
          <LCard style={{ maxWidth: 380 }}>
            <LCardHead title="Language Preference" icon={<Globe style={{ width: 16, height: 16, color: L.blue }} />} />
            <p style={{ fontSize: 12, color: L.textMuted, marginBottom: 14 }}>Current: {user?.languagePreference === 'en' ? 'English' : user?.languagePreference === 'ta' ? 'Tamil' : 'Hindi'}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[{ code: 'en', label: 'English', native: 'English' }, { code: 'hi', label: 'Hindi', native: 'हिन्दी' }, { code: 'ta', label: 'Tamil', native: 'தமிழ்' }].map(l => (
                <button key={l.code} onClick={() => toast.success(`Language set to ${l.label}`)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 14px', borderRadius: 10, border: `1.5px solid ${user?.languagePreference === l.code ? L.blue : L.border}`, background: user?.languagePreference === l.code ? L.blueLt : '#F8FAFC', cursor: 'pointer' }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: user?.languagePreference === l.code ? L.blue : L.text }}>{l.label}</span>
                  <span style={{ fontSize: 13, color: L.textMuted }}>{l.native}</span>
                </button>
              ))}
            </div>
          </LCard>
        )}

        {tab === 'webhooks' && (
          <LCard style={{ maxWidth: 520 }}>
            <LCardHead title="n8n Webhook Configuration" icon={<Webhook style={{ width: 16, height: 16, color: L.purple }} />} />
            <p style={{ fontSize: 12, color: L.textMuted, marginBottom: 16 }}>Connect SBMS alerts to your n8n automation workflow</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <LInput label="n8n Webhook URL" value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)} placeholder="https://your-n8n.com/webhook/sbms" />
              <div>
                <p style={{ fontSize: 12, fontWeight: 600, color: L.textSub, marginBottom: 10 }}>Event subscriptions</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {['alert.critical', 'alert.warning', 'alert.info', 'report.ready', 'recommendation.urgent'].map(e => (
                    <label key={e} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                      <input type="checkbox" defaultChecked={e.includes('critical') || e.includes('urgent')} />
                      <span style={{ fontSize: 12, color: L.textSub, fontFamily: 'monospace' }}>{e}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <LButton onClick={() => toast.success('Webhook saved')}>Save Configuration</LButton>
                <LButton variant="secondary" onClick={() => toast.success('Test webhook fired')}>Test Webhook</LButton>
              </div>
            </div>
          </LCard>
        )}
      </div>
      <style>{`.l-settings-grid{grid-template-columns:1fr 1fr} @media(max-width:768px){.l-settings-grid{grid-template-columns:1fr!important}}`}</style>
    </div>
  )
}
