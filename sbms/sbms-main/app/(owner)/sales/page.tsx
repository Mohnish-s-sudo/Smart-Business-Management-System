'use client'
import { useEffect, useState, useCallback } from 'react'
import { useApi } from '@/hooks/useApi'
import { TopBar } from '@/components/layout/TopBar'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Drawer } from '@/components/ui/Drawer'
import { formatCurrency, formatPercent, formatDate } from '@/lib/utils'
import { Plus, Search, ShoppingCart, Trash2, TrendingUp } from 'lucide-react'
import toast from 'react-hot-toast'

interface Product {
  _id: string
  name: string
  sku: string
  category: string
  retailPrice: number
  unitCost: number
  stockQuantity: number
}

interface CartItem {
  product: Product
  quantity: number
}

interface Sale {
  _id: string
  transactionRef: string
  saleDate: string
  totalAmount: number
  grossMargin: number
  paymentMethod: string
  staff: { name: string }
  items: { product: { name: string }; quantity: number }[]
}

export default function SalesPage() {
  const { apiFetch } = useApi()
  const [products, setProducts] = useState<Product[]>([])
  const [sales, setSales] = useState<Sale[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [search, setSearch] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [creditCustomer, setCreditCustomer] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const loadProducts = useCallback(() => {
    apiFetch<Product[]>(`/api/products?search=${search}`)
      .then(setProducts)
      .catch(console.error)
  }, [search])

  const loadSales = useCallback(() => {
    apiFetch<{ sales: Sale[] }>('/api/sales?limit=20')
      .then(d => setSales(d.sales))
      .catch(console.error)
  }, [])

  useEffect(() => { loadProducts() }, [loadProducts])
  useEffect(() => { loadSales() }, [loadSales])

  function addToCart(product: Product) {
    setCart(prev => {
      const existing = prev.find(i => i.product._id === product._id)
      if (existing) {
        return prev.map(i =>
          i.product._id === product._id
            ? { ...i, quantity: i.quantity + 1 }
            : i
        )
      }
      return [...prev, { product, quantity: 1 }]
    })
  }

  function updateQty(productId: string, qty: number) {
    if (qty <= 0) {
      setCart(prev => prev.filter(i => i.product._id !== productId))
    } else {
      setCart(prev =>
        prev.map(i =>
          i.product._id === productId
            ? { ...i, quantity: qty }
            : i
        )
      )
    }
  }

  const cartTotal = cart.reduce((s, i) => s + i.product.retailPrice * i.quantity, 0)
  const cartCost = cart.reduce((s, i) => s + i.product.unitCost * i.quantity, 0)
  const cartMargin = cartTotal - cartCost
  const cartMarginPct = cartTotal > 0 ? (cartMargin / cartTotal) * 100 : 0

  async function submitSale() {
    if (!cart.length) return toast.error('Add items to cart first')
    setSubmitting(true)
    try {
      await apiFetch('/api/sales', {
        method: 'POST',
        body: JSON.stringify({
          items: cart.map(i => ({
            productId: i.product._id,
            quantity: i.quantity
          })),
          paymentMethod,
          notes: paymentMethod === 'credit' ? creditCustomer : undefined
        })
      })
      toast.success('Sale recorded successfully')
      setCart([])
      setCreditCustomer('')
      loadSales()
      loadProducts()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to record sale')
    } finally {
      setSubmitting(false)
    }
  }

  const paymentBadge = (method: string) => {
    const map: Record<string, 'success' | 'info' | 'default' | 'warning'> = {
      cash: 'success',
      upi: 'info',
      card: 'default',
      credit: 'warning'
    }
    return map[method] || 'default'
  }

  return (
    <div>
      <TopBar title="SalesTrack" subtitle="Log transactions and track revenue" />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 space-y-4">
          <Card>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-80 overflow-y-auto">
              {products.map(p => (
                <button
                  key={p._id}
                  onClick={() => addToCart(p)}
                  disabled={p.stockQuantity === 0}
                  className="flex items-center justify-between p-3 rounded-lg"
                >
                  <div>
                    <p className="text-xs font-medium text-white">{p.name}</p>
                    <p className="text-[10px] text-slate-500">
                      {p.category} · Stock: {p.stockQuantity}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-white">
                      {formatCurrency(p.retailPrice)}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </Card>

          <Card>
            <h3 className="text-sm font-medium text-slate-400 mb-3">
              Recent Transactions
            </h3>
            <div className="space-y-2">
              {sales.map(s => (
                <div
                  key={s._id}
                  onClick={() => { setSelectedSale(s); setDrawerOpen(true) }}
                  className="flex items-center justify-between p-3 rounded-lg"
                >
                  <div>
                    <p className="text-xs font-medium text-white">
                      {s.transactionRef}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      {formatDate(s.saleDate)} · {s.staff?.name}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-white">
                      {formatCurrency(s.totalAmount)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}