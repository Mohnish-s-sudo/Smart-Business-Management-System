'use client'
import { useEffect, useState, useCallback } from 'react'
import { useApi } from '@/hooks/useApi'
import { TopBar } from '@/components/layout/TopBar'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { Drawer } from '@/components/ui/Drawer'
import { formatCurrency, formatPercent, getStockStatus, daysUntil } from '@/lib/utils'
import { Plus, Search, Package, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'

interface Product {
  _id: string; name: string; sku: string; category: string
  unitCost: number; retailPrice: number; stockQuantity: number
  reorderThreshold: number; expiryDate: string | null; isActive: boolean
}

const CATEGORIES = ['Grocery', 'Dairy', 'Personal Care', 'Snacks', 'Beverages', 'Electronics', 'Apparel', 'Other']

export default function InventoryPage() {
  const { apiFetch } = useApi()
  const [products, setProducts] = useState<Product[]>([])
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [form, setForm] = useState({ name: '', sku: '', category: 'Grocery', unitCost: '', retailPrice: '', stockQuantity: '', reorderThreshold: '10', expiryDate: '' })
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    apiFetch<Product[]>(`/api/products?search=${search}&category=${categoryFilter}`)
      .then(setProducts).catch(console.error)
  }, [search, categoryFilter])

  useEffect(() => { load() }, [load])

  function openAdd() { setEditing(null); setForm({ name: '', sku: '', category: 'Grocery', unitCost: '', retailPrice: '', stockQuantity: '', reorderThreshold: '10', expiryDate: '' }); setDrawerOpen(true) }
  function openEdit(p: Product) {
    setEditing(p)
    setForm({ name: p.name, sku: p.sku, category: p.category, unitCost: String(p.unitCost), retailPrice: String(p.retailPrice), stockQuantity: String(p.stockQuantity), reorderThreshold: String(p.reorderThreshold), expiryDate: p.expiryDate ? p.expiryDate.split('T')[0] : '' })
    setDrawerOpen(true)
  }

  async function save() {
    setSaving(true)
    try {
      const payload = { ...form, unitCost: parseFloat(form.unitCost), retailPrice: parseFloat(form.retailPrice), stockQuantity: parseInt(form.stockQuantity), reorderThreshold: parseInt(form.reorderThreshold), expiryDate: form.expiryDate || null }
      if (editing) await apiFetch(`/api/products/${editing._id}`, { method: 'PUT', body: JSON.stringify(payload) })
      else await apiFetch('/api/products', { method: 'POST', body: JSON.stringify(payload) })
      toast.success(editing ? 'Product updated' : 'Product added')
      setDrawerOpen(false)
      load()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const lowStockCount = products.filter(p => p.stockQuantity <= p.reorderThreshold).length
  const nearExpiryCount = products.filter(p => p.expiryDate && daysUntil(p.expiryDate) <= 7).length

  return (
    <div>
      <TopBar
        title="InventoryGuard"
        subtitle={`${products.length} products · ${lowStockCount} low stock · ${nearExpiryCount} near expiry`}
        actions={<Button onClick={openAdd} size="sm"><Plus className="w-3.5 h-3.5" /> Add Product</Button>}
      />

      {/* Alert banners */}
      {lowStockCount > 0 && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 mb-4 text-sm text-amber-400">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {lowStockCount} product{lowStockCount > 1 ? 's' : ''} below reorder threshold — review and restock
        </div>
      )}

      <Card>
        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-4">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products..." className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500/50" />
          </div>
          <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="bg-[#0F1117] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none">
            <option value="">All Categories</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                {['Product', 'SKU', 'Category', 'Stock', 'Reorder', 'Cost', 'Price', 'Margin', 'Expiry', 'Status'].map(h => (
                  <th key={h} className="text-left text-xs text-slate-500 font-medium pb-3 pr-4">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/3">
              {products.map(p => {
                const status = getStockStatus(p.stockQuantity, p.reorderThreshold)
                const margin = ((p.retailPrice - p.unitCost) / p.retailPrice) * 100
                const expDays = p.expiryDate ? daysUntil(p.expiryDate) : null
                return (
                  <tr key={p._id} onClick={() => openEdit(p)} className="hover:bg-white/3 cursor-pointer transition-colors">
                    <td className="py-3 pr-4 font-medium text-white">{p.name}</td>
                    <td className="py-3 pr-4 text-slate-500 font-mono text-xs">{p.sku}</td>
                    <td className="py-3 pr-4 text-slate-400">{p.category}</td>
                    <td className="py-3 pr-4 font-mono text-white">{p.stockQuantity}</td>
                    <td className="py-3 pr-4 text-slate-500">{p.reorderThreshold}</td>
                    <td className="py-3 pr-4 text-slate-400">{formatCurrency(p.unitCost)}</td>
                    <td className="py-3 pr-4 text-white">{formatCurrency(p.retailPrice)}</td>
                    <td className="py-3 pr-4">
                      <span className={margin >= 25 ? 'text-emerald-400' : margin >= 15 ? 'text-amber-400' : 'text-red-400'}>
                        {formatPercent(margin)}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      {expDays !== null ? (
                        <span className={expDays <= 3 ? 'text-red-400' : expDays <= 7 ? 'text-amber-400' : 'text-slate-400'}>
                          {expDays <= 0 ? 'Expired' : `${expDays}d`}
                        </span>
                      ) : <span className="text-slate-600">—</span>}
                    </td>
                    <td className="py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${status.color}`}>
                        {status.label}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title={editing ? 'Edit Product' : 'Add Product'}>
        <div className="space-y-4">
          <Input label="Product name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Basmati Rice 5kg" />
          <Input label="SKU" value={form.sku} onChange={e => setForm(f => ({ ...f, sku: e.target.value }))} placeholder="e.g. GRC-001" />
          <div>
            <label className="text-xs font-medium text-slate-400 block mb-1.5">Category</label>
            <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="w-full bg-[#0F1117] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none">
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Unit cost (₹)" type="number" value={form.unitCost} onChange={e => setForm(f => ({ ...f, unitCost: e.target.value }))} />
            <Input label="Retail price (₹)" type="number" value={form.retailPrice} onChange={e => setForm(f => ({ ...f, retailPrice: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Stock quantity" type="number" value={form.stockQuantity} onChange={e => setForm(f => ({ ...f, stockQuantity: e.target.value }))} />
            <Input label="Reorder threshold" type="number" value={form.reorderThreshold} onChange={e => setForm(f => ({ ...f, reorderThreshold: e.target.value }))} />
          </div>
          <Input label="Expiry date (optional)" type="date" value={form.expiryDate} onChange={e => setForm(f => ({ ...f, expiryDate: e.target.value }))} />
          {form.unitCost && form.retailPrice && (
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400">
              Margin: {formatPercent(((parseFloat(form.retailPrice) - parseFloat(form.unitCost)) / parseFloat(form.retailPrice)) * 100)}
            </div>
          )}
          <Button onClick={save} loading={saving} className="w-full justify-center">
            {editing ? 'Update Product' : 'Add Product'}
          </Button>
        </div>
      </Drawer>
    </div>
  )
}
