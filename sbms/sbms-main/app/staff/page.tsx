'use client'
import { useEffect, useState, useCallback } from 'react'
import { useApi } from '@/hooks/useApi'
import { useAuthStore } from '@/store/auth'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Package, PlusCircle, MinusCircle, AlertTriangle, DollarSign, Bell, Clock, CheckSquare } from 'lucide-react'
import toast from 'react-hot-toast'

interface DashboardData {
  todayStockAdded: number
  todayExpenses: number
  lowStockCount: number
  recentActivities: { _id: string; action: string; detail: string; createdAt: string }[]
}

interface Product { _id: string; name: string; stockQuantity: number; category: string }
interface Alert { _id: string; severity: string; message: string; createdAt: string }

type ActivePanel = null | 'addStock' | 'adjustStock' | 'damage' | 'verify' | 'expense' | 'alerts' | 'shift'

export default function StaffDashboard() {
  const { apiFetch } = useApi()
  const user = useAuthStore(s => s.user)

  const [dash, setDash] = useState<DashboardData | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [panel, setPanel] = useState<ActivePanel>(null)
  const [shiftActive, setShiftActive] = useState(false)

  // Form states
  const [selectedProduct, setSelectedProduct] = useState('')
  const [quantity, setQuantity] = useState('')
  const [adjustment, setAdjustment] = useState('')
  const [actualStock, setActualStock] = useState('')
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const [expCategory, setExpCategory] = useState('Supplies')
  const [expAmount, setExpAmount] = useState('')
  const [expNote, setExpNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const loadDash = useCallback(() => {
    apiFetch<DashboardData>('/api/staff/dashboard').then(setDash).catch(console.error)
  }, [apiFetch])

  const loadProducts = useCallback(() => {
    apiFetch<Product[]>('/api/products').then(setProducts).catch(console.error)
  }, [apiFetch])

  const loadAlerts = useCallback(() => {
    apiFetch<Alert[]>('/api/staff/alerts').then(setAlerts).catch(console.error)
  }, [apiFetch])

  useEffect(() => { loadDash(); loadProducts() }, [loadDash, loadProducts])

  function openPanel(p: ActivePanel) {
    setPanel(p)
    setSelectedProduct(''); setQuantity(''); setAdjustment('')
    setActualStock(''); setReason(''); setNote('')
    if (p === 'alerts') loadAlerts()
  }

  async function handleAddStock() {
    setSubmitting(true)
    try {
      await apiFetch('/api/staff/stock/add', { method: 'POST', body: JSON.stringify({ productId: selectedProduct, quantity: parseInt(quantity), note }) })
      toast.success('Stock added'); loadDash(); loadProducts(); setPanel(null)
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Failed') }
    finally { setSubmitting(false) }
  }

  async function handleAdjust() {
    setSubmitting(true)
    try {
      await apiFetch('/api/staff/stock/adjust', { method: 'POST', body: JSON.stringify({ productId: selectedProduct, adjustment: parseInt(adjustment), reason }) })
      toast.success('Stock adjusted'); loadDash(); loadProducts(); setPanel(null)
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Failed') }
    finally { setSubmitting(false) }
  }

  async function handleDamage() {
    setSubmitting(true)
    try {
      await apiFetch('/api/staff/stock/damage', { method: 'POST', body: JSON.stringify({ productId: selectedProduct, quantity: parseInt(quantity), reason }) })
      toast.success('Damage recorded'); loadDash(); loadProducts(); setPanel(null)
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Failed') }
    finally { setSubmitting(false) }
  }

  async function handleVerify() {
    setSubmitting(true)
    try {
      const res = await apiFetch<{ difference: number }>('/api/staff/stock/verify', { method: 'POST', body: JSON.stringify({ productId: selectedProduct, actualStock: parseInt(actualStock) }) })
      if (res.difference > 0) toast.error(`Loss detected: ${res.difference} units missing`)
      else toast.success('Stock verified — no discrepancy')
      loadDash(); setPanel(null)
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Failed') }
    finally { setSubmitting(false) }
  }

  async function handleExpense() {
    setSubmitting(true)
    try {
      await apiFetch('/api/staff/expenses', { method: 'POST', body: JSON.stringify({ category: expCategory, amount: parseFloat(expAmount), note: expNote }) })
      toast.success('Expense recorded'); loadDash(); setPanel(null)
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Failed') }
    finally { setSubmitting(false) }
  }

  async function handleShift() {
    setSubmitting(true)
    try {
      if (!shiftActive) {
        await apiFetch('/api/staff/shift/start', { method: 'POST' })
        toast.success('Shift started'); setShiftActive(true)
      } else {
        await apiFetch('/api/staff/shift/end', { method: 'POST' })
        toast.success('Shift ended'); setShiftActive(false)
      }
      loadDash(); setPanel(null)
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Failed') }
    finally { setSubmitting(false) }
  }

  const actions = [
    { id: 'addStock',    label: 'Add Stock',          icon: PlusCircle,    color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
    { id: 'adjustStock', label: 'Adjust Stock',        icon: Package,       color: 'text-indigo-400',  bg: 'bg-indigo-500/10 border-indigo-500/20' },
    { id: 'damage',      label: 'Record Damage',       icon: MinusCircle,   color: 'text-red-400',     bg: 'bg-red-500/10 border-red-500/20' },
    { id: 'verify',      label: 'Stock Verification',  icon: CheckSquare,   color: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/20' },
    { id: 'expense',     label: 'Add Expense',         icon: DollarSign,    color: 'text-purple-400',  bg: 'bg-purple-500/10 border-purple-500/20' },
    { id: 'alerts',      label: 'View Alerts',         icon: Bell,          color: 'text-orange-400',  bg: 'bg-orange-500/10 border-orange-500/20' },
    { id: 'shift',       label: shiftActive ? 'End Shift' : 'Start Shift', icon: Clock, color: 'text-teal-400', bg: 'bg-teal-500/10 border-teal-500/20' },
  ] as const

  const ProductSelect = (
    <div>
      <label className="text-xs text-slate-400 block mb-1.5">Product</label>
      <select
        value={selectedProduct}
        onChange={e => setSelectedProduct(e.target.value)}
        className="w-full bg-[#0F1117] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
      >
        <option value="">— Select product —</option>
        {products.map(p => (
          <option key={p._id} value={p._id}>
            {p.name} (stock: {p.stockQuantity})
          </option>
        ))}
      </select>
      {products.length === 0 && (
        <p className="text-[10px] text-slate-500 mt-1">Loading products…</p>
      )}
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Greeting */}
      <div>
        <h1 className="text-xl font-bold text-white">Hey, {user?.name?.split(' ')[0]} 👋</h1>
        <p className="text-sm text-slate-500 mt-0.5">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Stock Added Today', value: dash?.todayStockAdded ?? '—', color: 'text-emerald-400' },
          { label: 'Expenses Today',    value: dash ? formatCurrency(dash.todayExpenses) : '—', color: 'text-red-400' },
          { label: 'Low Stock Items',   value: dash?.lowStockCount ?? '—', color: 'text-amber-400' },
        ].map(k => (
          <div key={k.label} className="bg-[#1A1D27] border border-white/5 rounded-xl p-4">
            <p className="text-[10px] text-slate-500 mb-1">{k.label}</p>
            <p className={`text-xl font-bold font-mono ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Action grid */}
      <div className="grid grid-cols-2 gap-3">
        {actions.map(a => (
          <button key={a.id} onClick={() => openPanel(a.id as ActivePanel)}
            className={`flex items-center gap-3 p-4 rounded-xl border text-left transition-all hover:scale-[1.02] ${a.bg}`}>
            <a.icon className={`w-5 h-5 flex-shrink-0 ${a.color}`} />
            <span className="text-sm font-medium text-white">{a.label}</span>
          </button>
        ))}
      </div>

      {/* Panel */}
      {panel && panel !== 'alerts' && panel !== 'shift' && (
        <div className="bg-[#1A1D27] border border-white/10 rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-white capitalize">{panel.replace(/([A-Z])/g, ' $1')}</h2>

          {ProductSelect}

          {(panel === 'addStock' || panel === 'damage') && (
            <div>
              <label className="text-xs text-slate-400 block mb-1.5">Quantity</label>
              <input type="number" value={quantity} onChange={e => setQuantity(e.target.value)} min="1"
                className="w-full bg-[#0F1117] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none" />
            </div>
          )}

          {panel === 'adjustStock' && (
            <div>
              <label className="text-xs text-slate-400 block mb-1.5">Adjustment (use negative to reduce)</label>
              <input type="number" value={adjustment} onChange={e => setAdjustment(e.target.value)}
                className="w-full bg-[#0F1117] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none" />
            </div>
          )}

          {panel === 'verify' && (
            <div>
              <label className="text-xs text-slate-400 block mb-1.5">Actual Stock Count</label>
              <input type="number" value={actualStock} onChange={e => setActualStock(e.target.value)} min="0"
                className="w-full bg-[#0F1117] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none" />
            </div>
          )}

          {(panel === 'adjustStock' || panel === 'damage') && (
            <div>
              <label className="text-xs text-slate-400 block mb-1.5">Reason</label>
              <input value={reason} onChange={e => setReason(e.target.value)}
                className="w-full bg-[#0F1117] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none" />
            </div>
          )}

          {panel === 'addStock' && (
            <div>
              <label className="text-xs text-slate-400 block mb-1.5">Note (optional)</label>
              <input value={note} onChange={e => setNote(e.target.value)}
                className="w-full bg-[#0F1117] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none" />
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button onClick={
              panel === 'addStock' ? handleAddStock :
              panel === 'adjustStock' ? handleAdjust :
              panel === 'damage' ? handleDamage : handleVerify
            } disabled={submitting || !selectedProduct}
              className="flex-1 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-sm font-medium transition-colors">
              {submitting ? 'Saving…' : 'Confirm'}
            </button>
            <button onClick={() => setPanel(null)} className="px-4 py-2 rounded-lg bg-white/5 text-sm text-slate-400 hover:text-white transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Expense panel */}
      {panel === 'expense' && (
        <div className="bg-[#1A1D27] border border-white/10 rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-white">Add Expense</h2>
          <div>
            <label className="text-xs text-slate-400 block mb-1.5">Category</label>
            <select value={expCategory} onChange={e => setExpCategory(e.target.value)}
              className="w-full bg-[#0F1117] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none">
              {['Supplies', 'Utilities', 'Logistics', 'Maintenance', 'Miscellaneous'].map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1.5">Amount (₹)</label>
            <input type="number" value={expAmount} onChange={e => setExpAmount(e.target.value)} min="0"
              className="w-full bg-[#0F1117] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none" />
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1.5">Note (optional)</label>
            <input value={expNote} onChange={e => setExpNote(e.target.value)}
              className="w-full bg-[#0F1117] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none" />
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={handleExpense} disabled={submitting || !expAmount}
              className="flex-1 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-sm font-medium transition-colors">
              {submitting ? 'Saving…' : 'Record Expense'}
            </button>
            <button onClick={() => setPanel(null)} className="px-4 py-2 rounded-lg bg-white/5 text-sm text-slate-400 hover:text-white transition-colors">Cancel</button>
          </div>
        </div>
      )}

      {/* Shift panel */}
      {panel === 'shift' && (
        <div className="bg-[#1A1D27] border border-white/10 rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-white">{shiftActive ? 'End your shift?' : 'Start your shift?'}</h2>
          <p className="text-xs text-slate-500">{shiftActive ? 'This will clock you out and record your hours.' : 'This will clock you in for today.'}</p>
          <div className="flex gap-2">
            <button onClick={handleShift} disabled={submitting}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${shiftActive ? 'bg-red-600 hover:bg-red-500' : 'bg-emerald-600 hover:bg-emerald-500'}`}>
              {submitting ? 'Processing…' : shiftActive ? 'End Shift' : 'Start Shift'}
            </button>
            <button onClick={() => setPanel(null)} className="px-4 py-2 rounded-lg bg-white/5 text-sm text-slate-400 hover:text-white transition-colors">Cancel</button>
          </div>
        </div>
      )}

      {/* Alerts panel */}
      {panel === 'alerts' && (
        <div className="bg-[#1A1D27] border border-white/10 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Active Alerts</h2>
            <button onClick={() => setPanel(null)} className="text-xs text-slate-500 hover:text-white">Close</button>
          </div>
          {alerts.length === 0 && <p className="text-xs text-slate-500 py-4 text-center">No active alerts</p>}
          {alerts.map(a => (
            <div key={a._id} className={`p-3 rounded-lg border text-xs ${a.severity === 'critical' ? 'border-red-500/20 bg-red-500/10 text-red-300' : a.severity === 'warning' ? 'border-amber-500/20 bg-amber-500/10 text-amber-300' : 'border-blue-500/20 bg-blue-500/10 text-blue-300'}`}>
              <p className="font-medium">{a.message}</p>
              <p className="opacity-50 mt-1">{formatDate(a.createdAt)}</p>
            </div>
          ))}
        </div>
      )}

      {/* Recent Activities */}
      {dash?.recentActivities && dash.recentActivities.length > 0 && (
        <div className="bg-[#1A1D27] border border-white/5 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white mb-3">Recent Activities</h2>
          <div className="space-y-2">
            {dash.recentActivities.map(a => (
              <div key={a._id} className="flex items-start gap-3 text-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 flex-shrink-0" />
                <div>
                  <p className="text-slate-300">{a.detail}</p>
                  <p className="text-slate-600 mt-0.5">{formatDate(a.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
