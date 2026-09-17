'use client'
import { useEffect, useState, useCallback } from 'react'
import { useApi } from '@/hooks/useApi'
import { formatCurrency, formatPercent, formatDate } from '@/lib/utils'
import { Plus, Search, ShoppingCart, Minus, Trash2, TrendingUp, Receipt, Calendar, Hash } from 'lucide-react'
import toast from 'react-hot-toast'
import { L, LCard, LCardHead, LPageHeader, LStatCard, LBadge, LButton, LInput, LSelect, LDrawer, LTable, LTR, LTD, LBone, LEmpty } from '@/components/owner/LTheme'
import { OwnerTopBar } from '@/components/layout/OwnerTopBar'

interface Product { _id: string; name: string; sku: string; category: string; retailPrice: number; unitCost: number; stockQuantity: number }
interface CartItem { product: Product; quantity: number }
interface Sale { _id: string; transactionRef: string; saleDate: string; totalAmount: number; grossMargin: number; paymentMethod: string; staffId?: { name: string }; items: { productName: string; quantity: number; unitPrice: number }[] }

const payVariant = (m: string): 'success' | 'info' | 'default' | 'warning' => ({ cash: 'success', upi: 'info', card: 'default', credit: 'warning' }[m] as any || 'default')

export default function SalesPage() {
  const { apiFetch } = useApi()
  const [products, setProducts] = useState<Product[]>([])
  const [sales, setSales] = useState<Sale[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [search, setSearch] = useState('')
  const [txSearch, setTxSearch] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [creditCustomer, setCreditCustomer] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [totalSales, setTotalSales] = useState(0)
  const [totalTx, setTotalTx] = useState(0)

  const loadProducts = useCallback(() => {
    apiFetch<Product[]>(`/api/products?search=${search}`).then(setProducts).catch(() => {})
  }, [search]) // eslint-disable-line

  const loadSales = useCallback(() => {
    setLoading(true)
    apiFetch<{ sales: Sale[]; total: number }>('/api/sales?limit=50')
      .then(d => {
        setSales(d.sales)
        setTotalTx(d.total ?? d.sales.length)
        setTotalSales(d.sales.reduce((s, x) => s + x.totalAmount, 0))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, []) // eslint-disable-line

  useEffect(() => { loadProducts() }, [loadProducts])
  useEffect(() => { loadSales() }, [loadSales])

  function addToCart(product: Product) {
    if (product.stockQuantity === 0) return
    setCart(prev => {
      const ex = prev.find(i => i.product._id === product._id)
      return ex ? prev.map(i => i.product._id === product._id ? { ...i, quantity: i.quantity + 1 } : i) : [...prev, { product, quantity: 1 }]
    })
  }
  function updateQty(id: string, qty: number) {
    if (qty <= 0) setCart(prev => prev.filter(i => i.product._id !== id))
    else setCart(prev => prev.map(i => i.product._id === id ? { ...i, quantity: qty } : i))
  }

  const cartTotal = cart.reduce((s, i) => s + i.product.retailPrice * i.quantity, 0)
  const cartMargin = cart.reduce((s, i) => s + (i.product.retailPrice - i.product.unitCost) * i.quantity, 0)
  const cartMarginPct = cartTotal > 0 ? (cartMargin / cartTotal) * 100 : 0

  async function submitSale() {
    if (!cart.length) return toast.error('Add items to cart first')
    setSubmitting(true)
    try {
      await apiFetch('/api/sales', { method: 'POST', body: JSON.stringify({ items: cart.map(i => ({ productId: i.product._id, quantity: i.quantity })), paymentMethod, notes: paymentMethod === 'credit' ? creditCustomer : undefined }) })
      toast.success('Sale recorded')
      setCart([]); setCreditCustomer(''); loadSales(); loadProducts()
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Failed') }
    finally { setSubmitting(false) }
  }

  const avgOrder = totalTx > 0 ? Math.round(totalSales / totalTx) : 0

  const filteredSales = txSearch.trim()
    ? sales.filter(s =>
        s.transactionRef.toLowerCase().includes(txSearch.toLowerCase()) ||
        s.paymentMethod.toLowerCase().includes(txSearch.toLowerCase()) ||
        (s.items ?? []).some(i => i.productName.toLowerCase().includes(txSearch.toLowerCase())) ||
        ((s.staffId as any)?.name ?? '').toLowerCase().includes(txSearch.toLowerCase())
      )
    : sales

  return (
    <div style={{ background: L.bg, minHeight: '100vh', fontFamily: "'Inter', -apple-system, sans-serif" }}>
      <OwnerTopBar />
      <div style={{ padding: '24px 24px 40px', maxWidth: 1280, margin: '0 auto' }}>
        <LPageHeader
          title="Sales Track"
          subtitle="Log transactions and track revenue"
          right={
            <LButton onClick={() => { setSelectedSale(null); setDrawerOpen(true) }}>
              <Plus style={{ width: 14, height: 14 }} /> New Sale
            </LButton>
          }
        />

        {/* KPI strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 24 }} className="l-kpi3">
          <LStatCard label="Total Revenue" value={formatCurrency(totalSales)} sub={`${totalTx} transactions`} icon={<TrendingUp style={{ width: 15, height: 15 }} />} accent={L.blue} accentLt={L.blueLt} accentMid={L.blueMid} loading={loading} />
          <LStatCard label="Avg. Order Value" value={formatCurrency(avgOrder)} sub="per transaction" icon={<ShoppingCart style={{ width: 15, height: 15 }} />} accent={L.green} accentLt={L.greenLt} accentMid={L.greenMid} loading={loading} />
          <LStatCard label="Today's Sales" value={formatCurrency(sales.filter(s => new Date(s.saleDate).toDateString() === new Date().toDateString()).reduce((a, s) => a + s.totalAmount, 0))} sub="today" icon={<Receipt style={{ width: 15, height: 15 }} />} accent={L.amber} accentLt={L.amberLt} accentMid={L.amberMid} loading={loading} />
        </div>

        {/* Transactions table */}
        <LCard>
          <LCardHead title="Transactions" subtitle="All recorded sales" right={
            <div style={{ position: 'relative' }}>
              <Search style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 13, height: 13, color: L.textMuted, pointerEvents: 'none' }} />
              <input value={txSearch} onChange={e => setTxSearch(e.target.value)} placeholder="Search…" style={{ padding: '7px 10px 7px 30px', background: '#F8FAFC', border: `1px solid ${L.border}`, borderRadius: 8, fontSize: 12, color: L.text, outline: 'none', width: 180 }} />
            </div>
          } />
          {loading ? <LBone h={200} /> : filteredSales.length === 0 ? <LEmpty icon={<ShoppingCart style={{ width: 32, height: 32 }} />} message="No sales recorded yet." /> : (
            <LTable headers={['Ref', 'Date', 'Items', 'Total', 'Margin', 'Staff', 'Payment', '']}>
              {filteredSales.map(s => (
                <LTR key={s._id} onClick={() => { setSelectedSale(s); setDrawerOpen(true) }}>
                  <LTD><span style={{ fontFamily: 'monospace', fontSize: 12, color: L.blue, fontWeight: 600 }}>{s.transactionRef}</span></LTD>
                  <LTD muted>{formatDate(s.saleDate)}</LTD>
                  <LTD muted>{s.items?.length ?? 0} item{s.items?.length !== 1 ? 's' : ''}</LTD>
                  <LTD><span style={{ fontWeight: 700, color: L.text, fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(s.totalAmount)}</span></LTD>
                  <LTD><span style={{ color: s.grossMargin >= 0 ? L.green : L.red, fontWeight: 600 }}>{formatCurrency(s.grossMargin)}</span></LTD>
                  <LTD muted>{(s.staffId as any)?.name ?? '—'}</LTD>
                  <LTD><LBadge variant={payVariant(s.paymentMethod)}>{s.paymentMethod}</LBadge></LTD>
                  <LTD><span style={{ fontSize: 11, color: L.blue, fontWeight: 600, cursor: 'pointer' }}>View →</span></LTD>
                </LTR>
              ))}
            </LTable>
          )}
        </LCard>

        {/* Sale detail / new sale drawer */}
        <LDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title={selectedSale ? `Sale ${selectedSale.transactionRef}` : 'New Sale'}>
          {selectedSale ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[['Ref', selectedSale.transactionRef], ['Date', formatDate(selectedSale.saleDate)], ['Total', formatCurrency(selectedSale.totalAmount)], ['Payment', selectedSale.paymentMethod.toUpperCase()]].map(([l, v]) => (
                  <div key={l} style={{ padding: '10px 12px', borderRadius: 10, background: '#F8FAFC', border: `1px solid ${L.border}` }}>
                    <p style={{ fontSize: 10, fontWeight: 600, color: L.textMuted, margin: '0 0 2px', textTransform: 'uppercase' }}>{l}</p>
                    <p style={{ fontSize: 13, fontWeight: 700, color: L.text, margin: 0, fontFamily: 'monospace' }}>{v}</p>
                  </div>
                ))}
              </div>
              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: L.textSub, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Items</p>
                {selectedSale.items?.map((item, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${L.border}` }}>
                    <span style={{ fontSize: 13, color: L.text }}>{item.productName}</span>
                    <span style={{ fontSize: 13, color: L.textSub, fontVariantNumeric: 'tabular-nums' }}>{item.quantity} × {formatCurrency(item.unitPrice)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Product picker */}
              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: L.textSub, marginBottom: 8 }}>Select Products</p>
                <div style={{ position: 'relative', marginBottom: 8 }}>
                  <Search style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 13, height: 13, color: L.textMuted }} />
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products…" style={{ width: '100%', padding: '7px 10px 7px 30px', background: '#F8FAFC', border: `1.5px solid ${L.border}`, borderRadius: 8, fontSize: 12, color: L.text, outline: 'none' }} />
                </div>
                <div style={{ maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {products.map(p => (
                    <button key={p._id} onClick={() => addToCart(p)} disabled={p.stockQuantity === 0}
                      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 12px', borderRadius: 8, border: `1px solid ${L.border}`, background: '#FAFAFA', cursor: p.stockQuantity === 0 ? 'not-allowed' : 'pointer', opacity: p.stockQuantity === 0 ? 0.5 : 1, textAlign: 'left' }}>
                      <div>
                        <p style={{ fontSize: 12, fontWeight: 600, color: L.text, margin: 0 }}>{p.name}</p>
                        <p style={{ fontSize: 10, color: L.textMuted, margin: '1px 0 0' }}>{p.category} · {p.stockQuantity} in stock</p>
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: L.blue, fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(p.retailPrice)}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Cart */}
              {cart.length > 0 && (
                <div>
                  <p style={{ fontSize: 12, fontWeight: 700, color: L.textSub, marginBottom: 8 }}>Cart</p>
                  {cart.map(item => (
                    <div key={item.product._id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: `1px solid ${L.border}` }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 12, fontWeight: 500, color: L.text, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.product.name}</p>
                        <p style={{ fontSize: 11, color: L.textMuted, margin: 0 }}>{formatCurrency(item.product.retailPrice)} each</p>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <button onClick={() => updateQty(item.product._id, item.quantity - 1)} style={{ width: 24, height: 24, borderRadius: 6, border: `1px solid ${L.border}`, background: '#F8FAFC', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: L.textSub }}>
                          <Minus style={{ width: 10, height: 10 }} />
                        </button>
                        <span style={{ fontSize: 12, fontWeight: 700, color: L.text, width: 20, textAlign: 'center' }}>{item.quantity}</span>
                        <button onClick={() => updateQty(item.product._id, item.quantity + 1)} disabled={item.quantity >= item.product.stockQuantity} style={{ width: 24, height: 24, borderRadius: 6, border: `1px solid ${L.border}`, background: '#F8FAFC', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: L.textSub, opacity: item.quantity >= item.product.stockQuantity ? 0.4 : 1 }}>
                          <Plus style={{ width: 10, height: 10 }} />
                        </button>
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: L.text, fontVariantNumeric: 'tabular-nums', minWidth: 54, textAlign: 'right' }}>{formatCurrency(item.product.retailPrice * item.quantity)}</span>
                      <button onClick={() => updateQty(item.product._id, 0)} style={{ width: 24, height: 24, borderRadius: 6, border: 'none', background: L.redLt, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: L.red }}>
                        <Trash2 style={{ width: 10, height: 10 }} />
                      </button>
                    </div>
                  ))}
                  <div style={{ padding: '10px 0', borderBottom: `1px solid ${L.border}`, display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 13, color: L.textSub }}>Subtotal</span>
                    <span style={{ fontSize: 14, fontWeight: 800, color: L.blue, fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(cartTotal)}</span>
                  </div>
                  {cartMargin > 0 && <p style={{ fontSize: 11, color: L.green, margin: '6px 0 0' }}>Margin: {formatCurrency(cartMargin)} ({formatPercent(cartMarginPct)})</p>}
                </div>
              )}

              <LSelect label="Payment Method" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
                {['cash', 'upi', 'card', 'credit'].map(m => <option key={m} value={m} style={{ textTransform: 'capitalize' }}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>)}
              </LSelect>
              {paymentMethod === 'credit' && <LInput label="Customer Name" value={creditCustomer} onChange={e => setCreditCustomer(e.target.value)} placeholder="Customer name for credit" />}
              <LButton onClick={submitSale} loading={submitting} disabled={cart.length === 0} style={{ width: '100%', justifyContent: 'center', marginTop: 4 }}>
                Confirm Sale · {formatCurrency(cartTotal)}
              </LButton>
            </div>
          )}
        </LDrawer>
      </div>
      <style>{`.l-kpi3 { grid-template-columns: repeat(3,1fr); } @media(max-width:768px){ .l-kpi3{ grid-template-columns:1fr!important; } }`}</style>
    </div>
  )
}
