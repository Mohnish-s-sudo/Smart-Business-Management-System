'use client'
import { useState } from 'react'
import { useApi } from '@/hooks/useApi'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { ArrowLeft, CheckCircle } from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'

const CATEGORIES = ['Rent', 'Utilities', 'Payroll', 'Supplies', 'Marketing', 'Logistics', 'Miscellaneous']
const CATEGORY_ICONS: Record<string, string> = { Rent: '🏠', Utilities: '⚡', Payroll: '👥', Supplies: '📦', Marketing: '📢', Logistics: '🚚', Miscellaneous: '📋' }

export default function StaffExpensePage() {
  const { apiFetch } = useApi()
  const router = useRouter()
  const [category, setCategory] = useState('')
  const [amount, setAmount] = useState('')
  const [vendor, setVendor] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  async function submit() {
    if (!category || !amount) return toast.error('Select category and enter amount')
    setSubmitting(true)
    try {
      await apiFetch('/api/expenses', { method: 'POST', body: JSON.stringify({ category, amount: parseFloat(amount), vendorName: vendor }) })
      setDone(true)
      setTimeout(() => router.push('/staff-ops'), 2000)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed')
    } finally {
      setSubmitting(false)
    }
  }

  if (done) return (
    <div className="flex flex-col items-center justify-center h-64 gap-4">
      <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center">
        <CheckCircle className="w-8 h-8 text-emerald-400" />
      </div>
      <p className="text-lg font-bold text-white">Expense Recorded</p>
    </div>
  )

  return (
    <div className="py-4">
      <div className="flex items-center gap-3 mb-5">
        <Link href="/staff-ops" className="p-2 rounded-lg hover:bg-white/5 text-slate-400">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <h1 className="text-lg font-bold text-white">Record Expense</h1>
      </div>

      <p className="text-xs text-slate-500 mb-3">Select category</p>
      <div className="grid grid-cols-2 gap-2 mb-5">
        {CATEGORIES.map(c => (
          <button key={c} onClick={() => setCategory(c)} className={`flex items-center gap-2 p-3 rounded-xl border transition-colors ${category === c ? 'border-indigo-500/50 bg-indigo-600/15 text-indigo-400' : 'border-white/5 bg-[#1A1D27] text-slate-400 hover:border-white/10'}`}>
            <span className="text-lg">{CATEGORY_ICONS[c]}</span>
            <span className="text-sm font-medium">{c}</span>
          </button>
        ))}
      </div>

      <div className="space-y-3">
        <Input label="Amount (₹)" type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" />
        <Input label="Vendor name (optional)" value={vendor} onChange={e => setVendor(e.target.value)} placeholder="e.g. City Power Corp" />
        <Button onClick={submit} loading={submitting} className="w-full justify-center" size="lg" disabled={!category || !amount}>
          Record Expense
        </Button>
      </div>
    </div>
  )
}
