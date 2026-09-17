'use client'
import { useEffect, useState, useCallback } from 'react'
import { useApi } from '@/hooks/useApi'
import { formatCurrency, formatPercent, getStockStatus, daysUntil } from '@/lib/utils'
import { Plus, Search, Package, AlertTriangle, Edit2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useSearchParams } from 'next/navigation'
import { L, LCard, LCardHead, LPageHeader, LStatCard, LBadge, LButton, LInput, LSelect, LDrawer, LTable, LTR, LTD, LBone, LEmpty } from '@/components/owner/LTheme'
import { OwnerTopBar } from '@/components/layout/OwnerTopBar'

interface Product {
  _id: string; name: string; sku: string; category: string
  unitCost: number; retailPrice: number; stockQuantity: number
  reorderThreshold: number; expiryDate: string | null; isActive: boolean
}

const CATEGORIES = ['Grocery', 'Dairy', 'Personal Care', 'Snacks', 'Beverages', 'Electronics', 'Apparel', 'Other']

function stockBadge(qty: number, threshold: number) {
  if (qty === 0) return <LBadge variant="danger">Out of Stock</LBadge>
  if (qty <= threshold) return <LBadge variant="warning">Low Stock</LBadge>
  return <LBadge variant="success">In Stock</LBadge>
}

export default function InventoryPage() {
  const { apiFetch } = useApi()
  const searchParams = useSearchParams()
  const [products, setProducts] = useState<Product[]>([])
  const [search, setSearch] = useState(() => searchParams.get('q') ?? '')
  const [catFilter, setCatFilter] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [form, setForm] = useState({ name: '', sku: '', category: 'Grocery', unitCost: '', retailPrice: '', stockQuantity: '', reorderThreshold: '10', expiryDate: '' })
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams({ search, category: catFilter })
    apiFetch<Product[]>(`/api/products?${params.toString()}`)
      .then(setProducts).catch(() => {}).finally(() => setLoading(false))
  }, [search, catFilter]) // eslint-disable-line

  // The fetch synchronizes the table with the current filters.
  // eslint-disable-next-line react-hooks/set-state-in-effect
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
      setDrawerOpen(false); load()
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Failed') }
    finally { setSaving(false) }
  }

  const lowCount = products.filter(p => p.stockQuantity <= p.reorderThreshold && p.stockQuantity > 0).length
  const outCount = products.filter(p => p.stockQuantity === 0).length
  const nearExpiry = products.filter(p => p.expiryDate && daysUntil(p.expiryDate) <= 7).length

  return (
    <div style={{ background: L.bg, minHeight: '100vh', fontFamily: "'Inter', -apple-system, sans-serif" }}>
      <OwnerTopBar />
      <div style={{ padding: '24px 24px 40px', maxWidth: 1280, margin: '0 auto' }}>
        <LPageHeader title="Inventory" subtitle={`${products.length} products · ${lowCount} low stock · ${nearExpiry} near expiry`} right={<LButton onClick={openAdd}><Plus style={{ width: 14, height: 14 }} /> Add Product</LButton>} />

        {/* KPI strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 24 }} className="l-kpi4">
          <LStatCard label="Total Products" value={String(products.length)} sub="active products" icon={<Package style={{ width: 15, height: 15 }} />} accent={L.blue} accentLt={L.blueLt} accentMid={L.blueMid} loading={loading} />
          <LStatCard label="In Stock" value={String(products.length - lowCount - outCount)} sub="healthy stock" icon={<Package style={{ width: 15, height: 15 }} />} accent={L.green} accentLt={L.greenLt} accentMid={L.greenMid} loading={loading} />
          <LStatCard label="Low Stock" value={String(lowCount)} sub="needs restocking" icon={<AlertTriangle style={{ width: 15, height: 15 }} />} accent={L.amber} accentLt={L.amberLt} accentMid={L.amberMid} loading={loading} />
          <LStatCard label="Out of Stock" value={String(outCount)} sub="zero inventory" icon={<AlertTriangle style={{ width: 15, height: 15 }} />} accent={L.red} accentLt={L.redLt} accentMid={L.redMid} loading={loading} />
        </div>

        {/* Alert banner */}
        {lowCount > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px', background: L.amberLt, border: `1px solid ${L.amberMid}`, borderRadius: 10, marginBottom: 16, fontSize: 13, color: L.amber }}>
            <AlertTriangle style={{ width: 15, height: 15, flexShrink: 0 }} />
            {lowCount} product{lowCount > 1 ? 's' : ''} below reorder threshold — review and restock soon.
          </div>
        )}

        {/* Filters + table */}
        <LCard>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
            <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
              <Search style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 13, height: 13, color: L.textMuted, pointerEvents: 'none' }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products…" style={{ width: '100%', padding: '8px 10px 8px 30px', background: '#F8FAFC', border: `1.5px solid ${L.border}`, borderRadius: 9, fontSize: 13, color: L.text, outline: 'none' }} />
            </div>
            <select value={catFilter} onChange={e => setCatFilter(e.target.value)} style={{ padding: '8px 14px', background: '#F8FAFC', border: `1.5px solid ${L.border}`, borderRadius: 9, fontSize: 13, color: L.text, outline: 'none', cursor: 'pointer' }}>
              <option value="">All Categories</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {loading ? <LBone h={240} /> : products.length === 0 ? <LEmpty icon={<Package style={{ width: 32, height: 32 }} />} message="No products found." /> : (
            <LTable headers={['Product', 'SKU', 'Category', 'Stock', 'Reorder', 'Cost', 'Price', 'Margin', 'Expiry', 'Status', '']}>
              {products.map(p => {
                const margin = p.retailPrice > 0 ? ((p.retailPrice - p.unitCost) / p.retailPrice) * 100 : 0
                const expDays = p.expiryDate ? daysUntil(p.expiryDate) : null
                return (
                  <LTR key={p._id} onClick={() => openEdit(p)}>
                    <LTD><span style={{ fontWeight: 600, color: L.text }}>{p.name}</span></LTD>
                    <LTD muted><span style={{ fontFamily: 'monospace', fontSize: 11 }}>{p.sku}</span></LTD>
                    <LTD muted>{p.category}</LTD>
                    <LTD><span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: p.stockQuantity === 0 ? L.red : p.stockQuantity <= p.reorderThreshold ? L.amber : L.text }}>{p.stockQuantity}</span></LTD>
                    <LTD muted>{p.reorderThreshold}</LTD>
                    <LTD muted>{formatCurrency(p.unitCost)}</LTD>
                    <LTD><span style={{ fontWeight: 600 }}>{formatCurrency(p.retailPrice)}</span></LTD>
                    <LTD><span style={{ color: margin >= 25 ? L.green : margin >= 15 ? L.amber : L.red, fontWeight: 600 }}>{formatPercent(margin)}</span></LTD>
                    <LTD>
                      {expDays !== null
                        ? <span style={{ color: expDays <= 0 ? L.red : expDays <= 7 ? L.amber : L.textMuted, fontSize: 12 }}>{expDays <= 0 ? 'Expired' : `${expDays}d`}</span>
                        : <span style={{ color: L.textMuted }}>—</span>}
                    </LTD>
                    <LTD>{stockBadge(p.stockQuantity, p.reorderThreshold)}</LTD>
                    <LTD><Edit2 style={{ width: 13, height: 13, color: L.textMuted }} /></LTD>
                  </LTR>
                )
              })}
            </LTable>
          )}
        </LCard>

        <LDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title={editing ? 'Edit Product' : 'Add Product'}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <LInput label="Product name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Basmati Rice 5kg" />
            <LInput label="SKU" value={form.sku} onChange={e => setForm(f => ({ ...f, sku: e.target.value }))} placeholder="e.g. GRC-001" />
            <LSelect label="Category" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </LSelect>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <LInput label="Unit cost (₹)" type="number" value={form.unitCost} onChange={e => setForm(f => ({ ...f, unitCost: e.target.value }))} />
              <LInput label="Retail price (₹)" type="number" value={form.retailPrice} onChange={e => setForm(f => ({ ...f, retailPrice: e.target.value }))} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <LInput label="Stock quantity" type="number" value={form.stockQuantity} onChange={e => setForm(f => ({ ...f, stockQuantity: e.target.value }))} />
              <LInput label="Reorder threshold" type="number" value={form.reorderThreshold} onChange={e => setForm(f => ({ ...f, reorderThreshold: e.target.value }))} />
            </div>
            <LInput label="Expiry date (optional)" type="date" value={form.expiryDate} onChange={e => setForm(f => ({ ...f, expiryDate: e.target.value }))} />
            {form.unitCost && form.retailPrice && (
              <div style={{ padding: '10px 12px', background: L.greenLt, border: `1px solid ${L.greenMid}`, borderRadius: 9, fontSize: 12, color: L.green, fontWeight: 600 }}>
                Margin: {formatPercent(((parseFloat(form.retailPrice) - parseFloat(form.unitCost)) / parseFloat(form.retailPrice)) * 100)}
              </div>
            )}
            <LButton onClick={save} loading={saving} style={{ width: '100%', justifyContent: 'center' }}>
              {editing ? 'Update Product' : 'Add Product'}
            </LButton>
          </div>
        </LDrawer>
      </div>
      <style>{`.l-kpi4{grid-template-columns:repeat(4,1fr)} @media(max-width:900px){.l-kpi4{grid-template-columns:repeat(2,1fr)!important}} @media(max-width:480px){.l-kpi4{grid-template-columns:1fr!important}}`}</style>
    </div>
  )
}
