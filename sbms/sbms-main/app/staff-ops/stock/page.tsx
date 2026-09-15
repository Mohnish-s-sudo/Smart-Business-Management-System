'use client'
import { useEffect, useState } from 'react'
import { useApi } from '@/hooks/useApi'
import { useAuthStore } from '@/store/auth'
import { Button } from '@/components/ui/Button'
import { ArrowLeft, Search, CheckCircle } from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'

interface Product { id: string; name: string; sku: string; stockQuantity: number; category: string }

export default function StaffStockPage() {
  const { apiFetch } = useApi()
  const user = useAuthStore(s => s.user)
  const [products, setProducts] = useState<Product[]>([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Product | null>(null)
  const [adjustment, setAdjustment] = useState('')
  const [reason, setReason] = useState('restock')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    apiFetch<Product[]>(`/api/products?search=${search}`).then(setProducts).catch(console.error)
  }, [search])

  async function submit() {
    if (!selected || !adjustment) return
    setSubmitting(true)
    try {
      const qty = parseInt(adjustment)
      await apiFetch(`/api/products/${selected.id}`, {
        method: 'PUT',
        body: JSON.stringify({ stockQuantity: Math.max(0, selected.stockQuantity + qty) })
      })
      setDone(true)
      setTimeout(() => { setDone(false); setSelected(null); setAdjustment('') }, 2000)
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
      <p className="text-lg font-bold text-white">Stock Updated</p>
    </div>
  )

  return (
    <div className="py-4">
      <div className="flex items-center gap-3 mb-5">
        <Link href="/staff-ops" className="p-2 rounded-lg hover:bg-white/5 text-slate-400">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <h1 className="text-lg font-bold text-white">Update Stock</h1>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products..." className="w-full bg-[#1A1D27] border border-white/10 rounded-xl pl-9 pr-3 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none" />
      </div>

      {!selected ? (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {products.map(p => (
            <button key={p.id} onClick={() => setSelected(p)} className="w-full flex items-center justify-between p-3 rounded-xl bg-[#1A1D27] border border-white/5 hover:border-indigo-500/30 transition-all">
              <div className="text-left">
                <p className="text-sm font-medium text-white">{p.name}</p>
                <p className="text-xs text-slate-500">{p.sku}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-white">{p.stockQuantity}</p>
                <p className="text-xs text-slate-500">in stock</p>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="bg-[#1A1D27] rounded-2xl border border-white/5 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-white">{selected.name}</p>
              <p className="text-xs text-slate-500">Current stock: {selected.stockQuantity}</p>
            </div>
            <button onClick={() => setSelected(null)} className="text-xs text-slate-500 hover:text-white">Change</button>
          </div>

          <div>
            <label className="text-xs text-slate-400 block mb-2">Adjustment type</label>
            <div className="grid grid-cols-2 gap-2">
              {[{ v: 'restock', l: 'Restock (+)' }, { v: 'adjustment', l: 'Correction (±)' }].map(r => (
                <button key={r.v} onClick={() => setReason(r.v)} className={`py-2 rounded-xl text-xs font-medium transition-colors ${reason === r.v ? 'bg-indigo-600 text-white' : 'bg-white/5 text-slate-400'}`}>
                  {r.l}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-400 block mb-1.5">Quantity change</label>
            <input
              type="number"
              value={adjustment}
              onChange={e => setAdjustment(e.target.value)}
              placeholder={reason === 'restock' ? '+10' : '±5'}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-lg font-bold text-white text-center focus:outline-none focus:border-indigo-500/50"
            />
            {adjustment && (
              <p className="text-xs text-slate-500 mt-1 text-center">
                New stock: {Math.max(0, selected.stockQuantity + parseInt(adjustment || '0'))}
              </p>
            )}
          </div>

          <Button onClick={submit} loading={submitting} className="w-full justify-center" size="lg" disabled={!adjustment}>
            Update Stock
          </Button>
        </div>
      )}
    </div>
  )
}
