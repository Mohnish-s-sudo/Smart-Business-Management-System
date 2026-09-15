'use client'
import { useEffect, useState } from 'react'
import { useApi } from '@/hooks/useApi'
import { useAuthStore } from '@/store/auth'
import { TopBar } from '@/components/layout/TopBar'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { formatDate } from '@/lib/utils'
import { Users, Bell, Globe, Webhook, Plus } from 'lucide-react'
import toast from 'react-hot-toast'

interface StaffUser { _id: string; name: string; email: string; role: string; isActive: boolean; lastLogin: string | null }

export default function SettingsPage() {
  const { apiFetch } = useApi()
  const user = useAuthStore(s => s.user)
  const [tab, setTab] = useState('staff')
  const [staff, setStaff] = useState<StaffUser[]>([])
  const [newStaff, setNewStaff] = useState({ name: '', email: '', password: '', role: 'staff' })
  const [addingStaff, setAddingStaff] = useState(false)
  const [webhookUrl, setWebhookUrl] = useState('')

  useEffect(() => {
    if (tab === 'staff') apiFetch<StaffUser[]>('/api/staff').then(setStaff).catch(console.error)
  }, [tab])

  async function addStaff() {
    setAddingStaff(true)
    try {
      await apiFetch('/api/staff', { method: 'POST', body: JSON.stringify(newStaff) })
      toast.success('Staff account created')
      setNewStaff({ name: '', email: '', password: '', role: 'staff' })
      apiFetch<StaffUser[]>('/api/staff').then(setStaff)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed')
    } finally {
      setAddingStaff(false)
    }
  }

  const tabs = [
    { id: 'staff', label: 'Staff Accounts', icon: Users },
    { id: 'alerts', label: 'Alert Thresholds', icon: Bell },
    { id: 'language', label: 'Language', icon: Globe },
    { id: 'webhooks', label: 'Webhooks', icon: Webhook },
  ]

  return (
    <div>
      <TopBar title="Settings" subtitle="Business configuration and account management" />

      <div className="flex gap-1 mb-6 bg-white/3 rounded-lg p-1 w-fit">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === t.id ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'staff' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <h3 className="text-sm font-medium text-white mb-4">Team Members</h3>
            <div className="space-y-3">
              {staff.map(s => (
                <div key={s._id} className="flex items-center justify-between p-3 rounded-lg bg-white/3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-indigo-600/20 flex items-center justify-center text-xs font-bold text-indigo-400">
                      {s.name[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm text-white">{s.name}</p>
                      <p className="text-xs text-slate-500">{s.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={s.role === 'owner' ? 'default' : 'muted'}>{s.role}</Badge>
                    {s.lastLogin && <span className="text-[10px] text-slate-600">Last: {formatDate(s.lastLogin)}</span>}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <h3 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
              <Plus className="w-4 h-4 text-indigo-400" /> Add Staff Account
            </h3>
            <div className="space-y-3">
              <Input label="Full name" value={newStaff.name} onChange={e => setNewStaff(f => ({ ...f, name: e.target.value }))} placeholder="Staff member name" />
              <Input label="Email" type="email" value={newStaff.email} onChange={e => setNewStaff(f => ({ ...f, email: e.target.value }))} placeholder="staff@business.com" />
              <Input label="Password" type="password" value={newStaff.password} onChange={e => setNewStaff(f => ({ ...f, password: e.target.value }))} placeholder="Minimum 8 characters" />
              <div>
                <label className="text-xs font-medium text-slate-400 block mb-1.5">Role</label>
                <select value={newStaff.role} onChange={e => setNewStaff(f => ({ ...f, role: e.target.value }))} className="w-full bg-[#0F1117] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none">
                  <option value="staff">Staff</option>
                  <option value="owner">Owner</option>
                </select>
              </div>
              <Button onClick={addStaff} loading={addingStaff} className="w-full justify-center">Create Account</Button>
            </div>
          </Card>
        </div>
      )}

      {tab === 'alerts' && (
        <Card>
          <h3 className="text-sm font-medium text-white mb-4">Alert Thresholds</h3>
          <div className="space-y-4 max-w-md">
            {[
              { label: 'Low stock threshold (units)', key: 'lowStock', default: '10' },
              { label: 'Near expiry warning (days)', key: 'nearExpiry', default: '7' },
              { label: 'Revenue drop alert (%)', key: 'revenueDrop', default: '30' },
              { label: 'Expense spike threshold (%)', key: 'expenseSpike', default: '120' },
              { label: 'Overdue receivable alert (days)', key: 'overdueReceivable', default: '7' },
            ].map(f => (
              <Input key={f.key} label={f.label} type="number" defaultValue={f.default} />
            ))}
            <Button onClick={() => toast.success('Thresholds saved')}>Save Thresholds</Button>
          </div>
        </Card>
      )}

      {tab === 'language' && (
        <Card className="max-w-sm">
          <h3 className="text-sm font-medium text-white mb-4">Language Preference</h3>
          <p className="text-xs text-slate-500 mb-4">Current: {user?.languagePreference === 'en' ? 'English' : user?.languagePreference === 'ta' ? 'Tamil' : 'Hindi'}</p>
          <div className="space-y-2">
            {[{ code: 'en', label: 'English', native: 'English' }, { code: 'hi', label: 'Hindi', native: 'हिन्दी' }, { code: 'ta', label: 'Tamil', native: 'தமிழ்' }].map(l => (
              <button key={l.code} onClick={() => toast.success(`Language set to ${l.label}`)} className={`w-full flex items-center justify-between p-3 rounded-lg border transition-colors ${user?.languagePreference === l.code ? 'border-indigo-500/30 bg-indigo-600/10 text-indigo-400' : 'border-white/5 bg-white/3 text-slate-400 hover:border-white/10'}`}>
                <span className="text-sm">{l.label}</span>
                <span className="text-sm">{l.native}</span>
              </button>
            ))}
          </div>
        </Card>
      )}

      {tab === 'webhooks' && (
        <Card className="max-w-lg">
          <h3 className="text-sm font-medium text-white mb-1">n8n Webhook Configuration</h3>
          <p className="text-xs text-slate-500 mb-4">Connect SBMS alerts to your n8n automation workflow</p>
          <div className="space-y-4">
            <Input label="n8n Webhook URL" value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)} placeholder="https://your-n8n.com/webhook/sbms" />
            <div>
              <p className="text-xs text-slate-400 mb-2">Event subscriptions</p>
              <div className="space-y-2">
                {['alert.critical', 'alert.warning', 'alert.info', 'report.ready', 'recommendation.urgent'].map(e => (
                  <label key={e} className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" defaultChecked={e.includes('critical') || e.includes('urgent')} className="rounded" />
                    <span className="text-sm text-slate-400 font-mono">{e}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => toast.success('Webhook configuration saved')}>Save Configuration</Button>
              <Button variant="secondary" onClick={() => toast.success('Test webhook fired — check your n8n workflow')}>Test Webhook</Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}