'use client'
import { useEffect, useState } from 'react'
import { useApi } from '@/hooks/useApi'
import { useRouter } from 'next/navigation'
import { formatCurrency } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { ArrowLeft, Search, Plus, Minus, Trash2, CheckCircle } from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'

interface Product { id: string; name: string; retailPrice: number; stockQuantity: number; category: string }
interface CartItem { product: Product; quantity: number }

export default function StaffSalePage() {
  const { apiFetch } = useApi()
  const router = useRouter()
  const [products, setProducts] = useState<Product[]>([])
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    apiFetch<Product[]>(`/api/products?search=${search}`).then(setProducts).catch(console.error)
  }, [search])

  function addToCart(p: Product) {
    setCart(prev => {
      const ex = prev.find(i => i.product.id === p.id)
      if (ex) return prev.map(i => i.product.id === p.id ? { ...i, quantity: i.quantity + 1 } : i)
      return [...prev, { product: p, quantity: 1 }]
    })
  }

  function updateQty(id: string, qty: number) {
    if (qty <= 0) setCart(prev => prev.filter(i => i.product.id !== id))
    else setCart(prev => prev.map(i => i.product.id === id ? { ...i, quantity: qty } : i))
  }

  const total = cart.reduce((s, i) => s + i.product.retailPrice * i.quantity, 0)

  async function submit() {
    if (!cart.length) return
    setSubmitting(true)
    try {
      await apiFetch('/api/sales', {
        method: 'POST',
        body: JSON.stringify({ items: cart.map(i => ({ productId: i.product.id, quantity: i.quantity })), paymentMethod })
      })
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
      <p className="text-lg font-bold text-white">Sale Recorded</p>
      <p className="text-sm text-slate-500">{formatCurrency(total)} · {paymentMethod}</p>
    </div>
  )

  return (
    <div className="py-4">
      <div className="flex items-center gap-3 mb-5">
        <Link href="/staff-ops" className="p-2 rounded-lg hover:bg-white/5 text-slate-400">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <h1 className="text-lg font-bold text-white">Log Sale</h1>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products..." className="w-full bg-[#1A1D27] border border-white/10 rounded-xl pl-9 pr-3 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500/50" />
      </div>

      {/* Products */}
      <div className="space-y-2 mb-5 max-h-52 overflow-y-auto">
        {products.filter(p => p.stockQuantity > 0).map(p => (
          <button key={p.id} onClick={() => addToCart(p)} className="w-full flex items-center justify-between p-3 rounded-xl bg-[#1A1D27] border border-white/5 hover:border-indigo-500/30 active:scale-98 transition-all">
            <div className="text-left">
              <p className="text-sm font-medium text-white">{p.name}</p>
              <p className="text-xs text-slate-500">{p.category} · {p.stockQuantity} in stock</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white">{formatCurrency(p.retailPrice)}</span>
              <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center">
                <Plus className="w-4 h-4 text-white" />
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Cart */}
      {cart.length > 0 && (
        <div className="bg-[#1A1D27] rounded-2xl border border-white/5 p-4 mb-4">
          <p className="text-xs text-slate-500 mb-3">Cart ({cart.length} items)</p>
          <div className="space-y-2 mb-4">
            {cart.map(item => (
              <div key={item.product.id} className="flex items-center gap-2">
                <p className="flex-1 text-sm text-white truncate">{item.product.name}</p>
                <div className="flex items-center gap-1">
                  <button onClick={() => updateQty(item.product.id, item.quantity - 1)} className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center">
                    <Minus className="w-3 h-3 text-white" />
                  </button>
                  <span className="text-sm text-white w-6 text-center">{item.quantity}</span>
                  <button onClick={() => updateQty(item.product.id, item.quantity + 1)} className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center">
                    <Plus className="w-3 h-3 text-white" />
                  </button>
                  <button onClick={() => updateQty(item.product.id, 0)} className="w-7 h-7 rounded-lg hover:bg-red-500/10 flex items-center justify-center ml-1">
                    <Trash2 className="w-3 h-3 text-slate-500" />
                  </button>
                </div>
                <span className="text-sm font-medium text-white w-16 text-right">{formatCurrency(item.product.retailPrice * item.quantity)}</span>
              </div>
            ))}
          </div>

          {/* Payment method */}
          <div className="grid grid-cols-4 gap-2 mb-4">
            {['cash', 'upi', 'card', 'credit'].map(m => (
              <button key={m} onClick={() => setPaymentMethod(m)} className={`py-2 rounded-xl text-xs font-medium capitalize transition-colors ${paymentMethod === m ? 'bg-indigo-600 text-white' : 'bg-white/5 text-slate-400'}`}>
                {m}
              </button>
            ))}
          </div>

          <Button onClick={submit} loading={submitting} className="w-full justify-center" size="lg">
            Confirm Sale · {formatCurrency(total)}
          </Button>
        </div>
      )}
    </div>
  )
}
