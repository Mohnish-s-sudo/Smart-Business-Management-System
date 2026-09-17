'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useApi } from '@/hooks/useApi'
import { useAuthStore } from '@/store/auth'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import {
  ArrowLeft, Search, Plus, Minus, Trash2, ShoppingCart,
  CreditCard, Banknote, QrCode, CheckCircle, Printer,
  Download, RefreshCw, X, ChevronDown, User, Phone,
  Tag, AlertTriangle, Loader2, Receipt,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Product {
  _id: string
  name: string
  category: string
  retailPrice: number
  stockQuantity: number
  isActive: boolean
}

interface CartItem {
  product: Product
  quantity: number
}

interface CompletedSale {
  saleId: string
  transactionRef: string
  subtotal: number
  discountAmount: number
  grandTotal: number
  paymentMethod: 'cash' | 'upi' | 'card'
  cashReceived?: number
  change?: number
  customerName: string | null
  customerMobile: string | null
  staffName: string
  saleDate: string
  items: { productName: string; quantity: number; unitPrice: number; lineTotal: number }[]
}

type PayMethod = 'cash' | 'upi' | 'card'
type Stage = 'billing' | 'payment' | 'success' | 'invoice'

// ─── Constants — light theme matching Staff Dashboard ─────────────────────────
const BG      = '#F8FAFC'          // page background
const SURFACE  = '#FFFFFF'          // card background
const SURFACE2 = '#F1F5F9'          // inner-card / input background
const BORDER   = '#E2E8F0'          // card border
const BORDER2  = '#CBD5E1'          // input border / subtle separator
const ACCENT      = '#6366F1'       // indigo primary
const ACCENT_HOVER = '#4F46E5'
const SUCCESS  = '#22C55E'
const WARNING  = '#F59E0B'
const DANGER   = '#EF4444'
const TEXT     = '#0F172A'          // dark navy — primary text
const MUTED    = '#64748B'          // secondary labels
const SUBTLE   = '#94A3B8'          // tertiary / disabled text

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n)

function upiPayloadUrl(upiId: string, name: string, amount: number, ref: string) {
  const params = new URLSearchParams({
    pa: upiId,
    pn: name,
    am: amount.toFixed(2),
    cu: 'INR',
    tn: ref,
  })
  return `upi://pay?${params.toString()}`
}

// Minimal QR generator using a free API (Google Charts replacement — uses qrserver)
function QRImage({ data, size = 180 }: { data: string; size?: number }) {
  const url = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(data)}&size=${size}x${size}&bgcolor=0E1220&color=FFFFFF&margin=8`
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="UPI QR Code" width={size} height={size}
      style={{ borderRadius: 12, border: `1px solid ${BORDER2}` }}
      onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
    />
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function Divider() {
  return <div style={{ height: 1, background: BORDER, margin: '12px 0' }} />
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 11, fontWeight: 600, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
      {children}
    </p>
  )
}

function PayMethodBtn({
  method, label, icon: Icon, selected, onClick,
}: {
  method: PayMethod; label: string; icon: React.ElementType; selected: boolean; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
        padding: '14px 8px', borderRadius: 12,
        background: selected ? `${ACCENT}22` : SURFACE2,
        border: `1.5px solid ${selected ? ACCENT : BORDER2}`,
        cursor: 'pointer', transition: 'all 0.15s',
        color: selected ? ACCENT : SUBTLE,
      }}
    >
      <Icon style={{ width: 22, height: 22 }} />
      <span style={{ fontSize: 12, fontWeight: 600 }}>{label}</span>
    </button>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function BillingPage() {
  const { apiFetch } = useApi()
  const router = useRouter()
  const user = useAuthStore(s => s.user)

  // Products state
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [loadingProducts, setLoadingProducts] = useState(true)

  // Cart
  const [cart, setCart] = useState<CartItem[]>([])

  // Bill meta
  const [discount, setDiscount] = useState('')
  const [discountType, setDiscountType] = useState<'fixed' | 'percent'>('fixed')
  const [customerName, setCustomerName] = useState('')
  const [customerMobile, setCustomerMobile] = useState('')

  // Stage / payment
  const [stage, setStage] = useState<Stage>('billing')
  const [payMethod, setPayMethod] = useState<PayMethod>('cash')
  const [cashReceived, setCashReceived] = useState('')
  const [processing, setProcessing] = useState(false)
  const [completedSale, setCompletedSale] = useState<CompletedSale | null>(null)

  // Idempotency key per bill
  const idempotencyKey = useRef(crypto.randomUUID())

  // UPI config from env
  const upiId = process.env.NEXT_PUBLIC_UPI_ID || ''
  const bizName = process.env.NEXT_PUBLIC_BUSINESS_NAME || 'SBMS'

  // ── Load products ──
  const loadProducts = useCallback(() => {
    setLoadingProducts(true)
    const qs = new URLSearchParams()
    if (search) qs.set('search', search)
    if (catFilter) qs.set('category', catFilter)
    apiFetch<Product[]>(`/api/products?${qs.toString()}`)
      .then(data => {
        setProducts(data)
        if (!catFilter && !search) {
          const cats = [...new Set(data.map(p => p.category))].sort()
          setCategories(cats)
        }
      })
      .catch(() => toast.error('Failed to load products'))
      .finally(() => setLoadingProducts(false))
  }, [search, catFilter]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadProducts() }, [loadProducts])

  // ── Cart helpers ──
  function toggleProduct(product: Product) {
    if (product.stockQuantity === 0) return
    setCart(prev => {
      const exists = prev.find(i => i.product._id === product._id)
      if (exists) return prev.filter(i => i.product._id !== product._id)
      return [...prev, { product, quantity: 1 }]
    })
  }

  function setQty(productId: string, qty: number, maxStock: number) {
    if (qty < 1) {
      setCart(prev => prev.filter(i => i.product._id !== productId))
      return
    }
    const safeQty = Math.min(qty, maxStock)
    setCart(prev => prev.map(i => i.product._id === productId ? { ...i, quantity: safeQty } : i))
  }

  function removeFromCart(productId: string) {
    setCart(prev => prev.filter(i => i.product._id !== productId))
  }

  const isInCart = (id: string) => cart.some(i => i.product._id === id)

  // ── Calculations ──
  const subtotal = cart.reduce((s, i) => s + i.product.retailPrice * i.quantity, 0)
  const discountVal = (() => {
    const d = parseFloat(discount) || 0
    if (d <= 0) return 0
    if (discountType === 'percent') return Math.round((subtotal * Math.min(d, 100)) / 100 * 100) / 100
    return Math.min(d, subtotal)
  })()
  const grandTotal = Math.max(0, subtotal - discountVal)
  const cashChange = (() => {
    const c = parseFloat(cashReceived) || 0
    return c - grandTotal
  })()

  // ── Payment submit ──
  async function confirmPayment() {
    if (cart.length === 0) return
    if (payMethod === 'cash') {
      const cash = parseFloat(cashReceived) || 0
      if (cash < grandTotal) {
        toast.error(`Cash received must be at least ${fmt(grandTotal)}`)
        return
      }
    }

    setProcessing(true)
    try {
      const result = await apiFetch<CompletedSale>('/api/billing/complete', {
        method: 'POST',
        body: JSON.stringify({
          items: cart.map(i => ({ productId: i.product._id, quantity: i.quantity })),
          discount: parseFloat(discount) || 0,
          discountType,
          paymentMethod: payMethod,
          cashReceived: payMethod === 'cash' ? parseFloat(cashReceived) || 0 : undefined,
          customerName: customerName.trim() || undefined,
          customerMobile: customerMobile.trim() || undefined,
          idempotencyKey: idempotencyKey.current,
        }),
      })
      setCompletedSale(result)
      setStage('success')
      setTimeout(() => setStage('invoice'), 1800)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Unable to complete the bill. Please try again.')
    } finally {
      setProcessing(false)
    }
  }

  // ── New bill ──
  function resetBill() {
    setCart([])
    setDiscount('')
    setDiscountType('fixed')
    setCustomerName('')
    setCustomerMobile('')
    setCashReceived('')
    setPayMethod('cash')
    setCompletedSale(null)
    setStage('billing')
    idempotencyKey.current = crypto.randomUUID()
    loadProducts()
  }

  // ── Render: Success flash ──
  if (stage === 'success') {
    return (
      <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          style={{ textAlign: 'center', padding: 40 }}
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
            style={{
              width: 80, height: 80, borderRadius: '50%',
              background: `${SUCCESS}22`, border: `2px solid ${SUCCESS}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px',
            }}
          >
            <CheckCircle style={{ width: 40, height: 40, color: SUCCESS }} />
          </motion.div>
          <h2 style={{ color: TEXT, fontSize: 22, fontWeight: 700, margin: '0 0 8px' }}>Payment Successful</h2>
          <p style={{ color: SUBTLE, fontSize: 14 }}>
            {completedSale?.paymentMethod?.toUpperCase()} · {fmt(completedSale?.grandTotal ?? 0)}
          </p>
          <p style={{ color: MUTED, fontSize: 12, marginTop: 8 }}>Opening invoice…</p>
        </motion.div>
      </div>
    )
  }

  // ── Render: Invoice ──
  if (stage === 'invoice' && completedSale) {
    return <InvoiceView sale={completedSale} onNewBill={resetBill} onBack={() => router.push('/staff')} />
  }

  // ── Render: Payment screen ──
  if (stage === 'payment') {
    return (
      <PaymentScreen
        grandTotal={grandTotal}
        payMethod={payMethod}
        setPayMethod={setPayMethod}
        cashReceived={cashReceived}
        setCashReceived={setCashReceived}
        cashChange={cashChange}
        processing={processing}
        upiId={upiId}
        bizName={bizName}
        transactionRef={`SBMS-DRAFT-${Date.now()}`}
        onConfirm={confirmPayment}
        onBack={() => setStage('billing')}
      />
    )
  }

  // ── Render: Main billing ──
  return (
    <div style={{ minHeight: '100vh', background: BG, color: TEXT, fontFamily: "'Inter', -apple-system, sans-serif" }}>
      {/* ── Header ── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 40,
        background: 'rgba(8,11,18,0.92)', backdropFilter: 'blur(12px)',
        borderBottom: `1px solid ${BORDER}`,
        padding: '0 20px',
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', height: 56, display: 'flex', alignItems: 'center', gap: 14 }}>
          <button
            onClick={() => router.push('/staff')}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 34, height: 34, borderRadius: 8,
              background: SURFACE, border: `1px solid ${BORDER2}`,
              cursor: 'pointer', color: SUBTLE, flexShrink: 0,
            }}
          >
            <ArrowLeft style={{ width: 15, height: 15 }} />
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Receipt style={{ width: 16, height: 16, color: ACCENT }} />
            <span style={{ fontSize: 15, fontWeight: 700, color: TEXT }}>New Bill</span>
          </div>

          <div style={{ flex: 1 }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 11, color: MUTED }}>
              {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
            </span>
            <span style={{
              fontSize: 11, fontWeight: 600, color: ACCENT,
              padding: '2px 8px', borderRadius: 6, background: `${ACCENT}15`, border: `1px solid ${ACCENT}30`,
            }}>
              Staff: {user?.name?.split(' ')[0]}
            </span>
          </div>
        </div>
      </header>

      {/* ── Two-column layout ── */}
      <div style={{
        maxWidth: 1200, margin: '0 auto', padding: '20px 20px',
        display: 'grid',
        gridTemplateColumns: 'minmax(0,1fr) 360px',
        gap: 16,
        alignItems: 'start',
      }}
        className="billing-grid"
      >
        {/* ══ LEFT: Product selection ══ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Search & filter bar */}
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <Search style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: MUTED, pointerEvents: 'none' }} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search products…"
                style={{
                  width: '100%', padding: '9px 12px 9px 34px',
                  background: SURFACE, border: `1px solid ${BORDER2}`,
                  borderRadius: 10, color: TEXT, fontSize: 13, outline: 'none',
                }}
                onFocus={e => (e.target.style.borderColor = ACCENT)}
                onBlur={e => (e.target.style.borderColor = BORDER2)}
              />
            </div>

            {categories.length > 0 && (
              <div style={{ position: 'relative' }}>
                <select
                  value={catFilter}
                  onChange={e => setCatFilter(e.target.value)}
                  style={{
                    padding: '9px 32px 9px 12px',
                    background: SURFACE, border: `1px solid ${BORDER2}`,
                    borderRadius: 10, color: catFilter ? TEXT : MUTED, fontSize: 13,
                    outline: 'none', cursor: 'pointer', appearance: 'none',
                    minWidth: 130,
                  }}
                >
                  <option value="">All Categories</option>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <ChevronDown style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', width: 13, height: 13, color: MUTED, pointerEvents: 'none' }} />
              </div>
            )}
          </div>

          {/* Product grid */}
          <div style={{
            background: SURFACE, borderRadius: 14, border: `1px solid ${BORDER}`,
            overflow: 'hidden',
          }}>
            {loadingProducts ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, gap: 10, color: MUTED }}>
                <Loader2 style={{ width: 18, height: 18, animation: 'spin 1s linear infinite' }} />
                <span style={{ fontSize: 13 }}>Loading products…</span>
              </div>
            ) : products.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: MUTED, fontSize: 13 }}>
                No products found
              </div>
            ) : (
              <div style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 220px)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                      {['', 'Product', 'Category', 'Price', 'Stock', 'Qty'].map((h, i) => (
                        <th key={i} style={{
                          padding: '10px 14px', textAlign: 'left',
                          fontSize: 11, fontWeight: 600, color: MUTED,
                          textTransform: 'uppercase', letterSpacing: '0.06em',
                          background: SURFACE2,
                          ...(i === 0 ? { width: 44 } : {}),
                          ...(i === 5 ? { width: 110, textAlign: 'center' as const } : {}),
                        }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((p, idx) => {
                      const inCart = isInCart(p._id)
                      const cartItem = cart.find(i => i.product._id === p._id)
                      const outOfStock = p.stockQuantity === 0
                      return (
                        <motion.tr
                          key={p._id}
                          initial={false}
                          animate={{ background: inCart ? `${ACCENT}12` : 'transparent' }}
                          style={{
                            borderBottom: idx < products.length - 1 ? `1px solid ${BORDER}` : 'none',
                            opacity: outOfStock ? 0.45 : 1,
                          }}
                        >
                          {/* Checkbox */}
                          <td style={{ padding: '10px 14px' }}>
                            <button
                              onClick={() => !outOfStock && toggleProduct(p)}
                              disabled={outOfStock}
                              style={{
                                width: 20, height: 20, borderRadius: 6,
                                border: `2px solid ${inCart ? ACCENT : BORDER2}`,
                                background: inCart ? ACCENT : 'transparent',
                                cursor: outOfStock ? 'not-allowed' : 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                transition: 'all 0.12s', flexShrink: 0,
                              }}
                            >
                              {inCart && (
                                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                                  <path d="M1.5 5L4 7.5L8.5 2.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              )}
                            </button>
                          </td>

                          {/* Name */}
                          <td style={{ padding: '10px 14px' }}>
                            <p style={{ fontSize: 13, fontWeight: 500, color: TEXT, margin: 0 }}>{p.name}</p>
                          </td>

                          {/* Category */}
                          <td style={{ padding: '10px 14px' }}>
                            <span style={{
                              fontSize: 11, color: SUBTLE, padding: '2px 7px',
                              borderRadius: 5, background: SURFACE2, border: `1px solid ${BORDER}`,
                            }}>
                              {p.category}
                            </span>
                          </td>

                          {/* Price */}
                          <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 600, color: TEXT, fontVariantNumeric: 'tabular-nums' }}>
                            {fmt(p.retailPrice)}
                          </td>

                          {/* Stock */}
                          <td style={{ padding: '10px 14px' }}>
                            {outOfStock ? (
                              <span style={{ fontSize: 11, fontWeight: 600, color: DANGER, padding: '2px 7px', borderRadius: 5, background: `${DANGER}15`, border: `1px solid ${DANGER}30` }}>
                                Out of Stock
                              </span>
                            ) : p.stockQuantity <= 10 ? (
                              <span style={{ fontSize: 11, fontWeight: 600, color: WARNING, padding: '2px 7px', borderRadius: 5, background: `${WARNING}15`, border: `1px solid ${WARNING}30` }}>
                                {p.stockQuantity} left
                              </span>
                            ) : (
                              <span style={{ fontSize: 12, color: SUBTLE }}>{p.stockQuantity}</span>
                            )}
                          </td>

                          {/* Qty control */}
                          <td style={{ padding: '8px 14px' }}>
                            {inCart && cartItem ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
                                <button
                                  onClick={() => setQty(p._id, cartItem.quantity - 1, p.stockQuantity)}
                                  style={qtyBtnStyle}
                                >
                                  <Minus style={{ width: 11, height: 11 }} />
                                </button>
                                <input
                                  type="number"
                                  value={cartItem.quantity}
                                  min={1}
                                  max={p.stockQuantity}
                                  onChange={e => setQty(p._id, parseInt(e.target.value) || 1, p.stockQuantity)}
                                  style={{
                                    width: 38, textAlign: 'center', padding: '4px 2px',
                                    background: SURFACE2, border: `1px solid ${BORDER2}`,
                                    borderRadius: 6, color: TEXT, fontSize: 12, outline: 'none',
                                  }}
                                />
                                <button
                                  onClick={() => setQty(p._id, cartItem.quantity + 1, p.stockQuantity)}
                                  disabled={cartItem.quantity >= p.stockQuantity}
                                  style={{ ...qtyBtnStyle, opacity: cartItem.quantity >= p.stockQuantity ? 0.4 : 1 }}
                                >
                                  <Plus style={{ width: 11, height: 11 }} />
                                </button>
                              </div>
                            ) : (
                              <div style={{ textAlign: 'center' }}>—</div>
                            )}
                          </td>
                        </motion.tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* ══ RIGHT: Cart & Bill ══ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, position: 'sticky', top: 76 }}>

          {/* Cart items */}
          <div style={{ background: SURFACE, borderRadius: 14, border: `1px solid ${BORDER}`, overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 8 }}>
              <ShoppingCart style={{ width: 14, height: 14, color: ACCENT }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: TEXT }}>Current Bill</span>
              {cart.length > 0 && (
                <span style={{
                  marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: ACCENT,
                  background: `${ACCENT}20`, border: `1px solid ${ACCENT}40`,
                  padding: '1px 7px', borderRadius: 10,
                }}>
                  {cart.length} item{cart.length > 1 ? 's' : ''}
                </span>
              )}
            </div>

            <div style={{ minHeight: 80, maxHeight: 280, overflowY: 'auto' }}>
              {cart.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '28px 16px', color: MUTED, fontSize: 12 }}>
                  <ShoppingCart style={{ width: 28, height: 28, margin: '0 auto 8px', opacity: 0.3 }} />
                  Select products to add to the bill
                </div>
              ) : (
                <div>
                  {cart.map(item => (
                    <div key={item.product._id} style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '10px 16px', borderBottom: `1px solid ${BORDER}`,
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 12, fontWeight: 500, color: TEXT, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.product.name}
                        </p>
                        <p style={{ fontSize: 11, color: MUTED, margin: '2px 0 0', fontVariantNumeric: 'tabular-nums' }}>
                          {fmt(item.product.retailPrice)} × {item.quantity}
                        </p>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                        <button onClick={() => setQty(item.product._id, item.quantity - 1, item.product.stockQuantity)} style={qtyBtnStyle}>
                          <Minus style={{ width: 10, height: 10 }} />
                        </button>
                        <span style={{ fontSize: 12, fontWeight: 600, color: TEXT, width: 22, textAlign: 'center' }}>
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => setQty(item.product._id, item.quantity + 1, item.product.stockQuantity)}
                          disabled={item.quantity >= item.product.stockQuantity}
                          style={{ ...qtyBtnStyle, opacity: item.quantity >= item.product.stockQuantity ? 0.4 : 1 }}
                        >
                          <Plus style={{ width: 10, height: 10 }} />
                        </button>
                      </div>

                      <span style={{ fontSize: 12, fontWeight: 600, color: TEXT, fontVariantNumeric: 'tabular-nums', minWidth: 54, textAlign: 'right' }}>
                        {fmt(item.product.retailPrice * item.quantity)}
                      </span>

                      <button onClick={() => removeFromCart(item.product._id)} style={{ ...qtyBtnStyle, color: DANGER, borderColor: `${DANGER}30` }}>
                        <Trash2 style={{ width: 11, height: 11 }} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Customer info */}
          <div style={{ background: SURFACE, borderRadius: 14, border: `1px solid ${BORDER}`, padding: '14px 16px' }}>
            <SectionLabel>Customer (Optional)</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ position: 'relative' }}>
                <User style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 13, height: 13, color: MUTED, pointerEvents: 'none' }} />
                <input
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  placeholder="Customer name"
                  style={inputStyle}
                />
              </div>
              <div style={{ position: 'relative' }}>
                <Phone style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 13, height: 13, color: MUTED, pointerEvents: 'none' }} />
                <input
                  value={customerMobile}
                  onChange={e => setCustomerMobile(e.target.value)}
                  placeholder="Mobile number"
                  type="tel"
                  maxLength={10}
                  style={inputStyle}
                />
              </div>
            </div>
          </div>

          {/* Discount */}
          <div style={{ background: SURFACE, borderRadius: 14, border: `1px solid ${BORDER}`, padding: '14px 16px' }}>
            <SectionLabel>Discount</SectionLabel>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <Tag style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 13, height: 13, color: MUTED, pointerEvents: 'none' }} />
                <input
                  value={discount}
                  onChange={e => setDiscount(e.target.value)}
                  type="number"
                  min="0"
                  placeholder={discountType === 'percent' ? 'e.g. 10' : 'e.g. 50'}
                  style={inputStyle}
                />
              </div>
              <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: `1px solid ${BORDER2}` }}>
                {(['fixed', 'percent'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setDiscountType(t)}
                    style={{
                      padding: '0 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none',
                      background: discountType === t ? ACCENT : SURFACE2,
                      color: discountType === t ? TEXT : MUTED,
                      transition: 'background 0.12s',
                    }}
                  >
                    {t === 'fixed' ? '₹' : '%'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Totals */}
          <div style={{ background: SURFACE, borderRadius: 14, border: `1px solid ${BORDER}`, padding: '14px 16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <TotalRow label="Subtotal" value={fmt(subtotal)} />
              {discountVal > 0 && <TotalRow label={`Discount (${discountType === 'percent' ? discount + '%' : fmt(discountVal)})`} value={`−${fmt(discountVal)}`} valueColor={SUCCESS} />}
              <TotalRow label="Tax" value="₹0" />
              <div style={{ height: 1, background: BORDER2, margin: '4px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>Total</span>
                <span style={{ fontSize: 20, fontWeight: 800, color: ACCENT, fontVariantNumeric: 'tabular-nums' }}>{fmt(grandTotal)}</span>
              </div>
            </div>
          </div>

          {/* Proceed to payment */}
          <button
            onClick={() => {
              if (cart.length === 0) { toast.error('Add at least one product'); return }
              setStage('payment')
            }}
            disabled={cart.length === 0}
            style={{
              width: '100%', padding: '14px', borderRadius: 12, border: 'none',
              background: cart.length === 0 ? SURFACE2 : `linear-gradient(135deg, ${ACCENT} 0%, ${ACCENT_HOVER} 100%)`,
              color: cart.length === 0 ? MUTED : TEXT,
              fontSize: 14, fontWeight: 700, cursor: cart.length === 0 ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              boxShadow: cart.length === 0 ? 'none' : '0 4px 20px rgba(99,102,241,0.35)',
              transition: 'all 0.15s',
            }}
          >
            <CreditCard style={{ width: 16, height: 16 }} />
            Proceed to Payment
          </button>
        </div>
      </div>

      {/* Responsive styles */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 720px) {
          .billing-grid { grid-template-columns: 1fr !important; }
        }
        input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; }
      `}</style>
    </div>
  )
}

// ─── Helper styles ─────────────────────────────────────────────────────────────
const qtyBtnStyle: React.CSSProperties = {
  width: 24, height: 24, borderRadius: 6,
  background: SURFACE2, border: `1px solid ${BORDER2}`,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer', color: SUBTLE, flexShrink: 0,
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px 8px 30px',
  background: SURFACE2, border: `1px solid ${BORDER2}`,
  borderRadius: 8, color: TEXT, fontSize: 12, outline: 'none',
}

function TotalRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: 12, color: MUTED }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: valueColor || SUBTLE, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    </div>
  )
}

// ─── Payment Screen ───────────────────────────────────────────────────────────
function PaymentScreen({
  grandTotal, payMethod, setPayMethod, cashReceived, setCashReceived,
  cashChange, processing, upiId, bizName, transactionRef, onConfirm, onBack,
}: {
  grandTotal: number; payMethod: PayMethod; setPayMethod: (m: PayMethod) => void
  cashReceived: string; setCashReceived: (v: string) => void
  cashChange: number; processing: boolean
  upiId: string; bizName: string; transactionRef: string
  onConfirm: () => void; onBack: () => void
}) {
  const upiPayload = upiId
    ? upiPayloadUrl(upiId, bizName, grandTotal, transactionRef)
    : null

  return (
    <div style={{ minHeight: '100vh', background: BG, color: TEXT, fontFamily: "'Inter', -apple-system, sans-serif" }}>
      {/* Header */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 40,
        background: 'rgba(8,11,18,0.92)', backdropFilter: 'blur(12px)',
        borderBottom: `1px solid ${BORDER}`, padding: '0 20px',
      }}>
        <div style={{ maxWidth: 560, margin: '0 auto', height: 56, display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={onBack} style={{ ...qtyBtnStyle, width: 34, height: 34 }}>
            <ArrowLeft style={{ width: 15, height: 15 }} />
          </button>
          <span style={{ fontSize: 15, fontWeight: 700 }}>Payment</span>
          <span style={{ marginLeft: 'auto', fontSize: 22, fontWeight: 800, color: ACCENT, fontVariantNumeric: 'tabular-nums' }}>
            {fmt(grandTotal)}
          </span>
        </div>
      </header>

      <div style={{ maxWidth: 560, margin: '0 auto', padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Method selector */}
        <div style={{ background: SURFACE, borderRadius: 14, border: `1px solid ${BORDER}`, padding: '16px' }}>
          <SectionLabel>Payment Method</SectionLabel>
          <div style={{ display: 'flex', gap: 8 }}>
            <PayMethodBtn method="cash" label="Cash" icon={Banknote} selected={payMethod === 'cash'} onClick={() => setPayMethod('cash')} />
            <PayMethodBtn method="upi" label="UPI" icon={QrCode} selected={payMethod === 'upi'} onClick={() => setPayMethod('upi')} />
            <PayMethodBtn method="card" label="Card" icon={CreditCard} selected={payMethod === 'card'} onClick={() => setPayMethod('card')} />
          </div>
        </div>

        {/* UPI */}
        <AnimatePresence mode="wait">
          {payMethod === 'upi' && (
            <motion.div key="upi"
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              style={{ background: SURFACE, borderRadius: 14, border: `1px solid ${BORDER}`, padding: '20px', textAlign: 'center' }}
            >
              <p style={{ fontSize: 13, fontWeight: 600, color: SUBTLE, marginBottom: 16 }}>UPI Payment · {fmt(grandTotal)}</p>
              {upiPayload ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
                    <QRImage data={upiPayload} size={180} />
                  </div>
                  <p style={{ fontSize: 12, color: MUTED, marginBottom: 6 }}>
                    Scan with any UPI app to pay {fmt(grandTotal)}
                  </p>
                  <p style={{ fontSize: 11, color: MUTED, marginBottom: 2 }}>UPI ID: <strong style={{ color: SUBTLE }}>{upiId}</strong></p>
                  <p style={{ fontSize: 10, color: MUTED }}>Ref: {transactionRef}</p>
                </>
              ) : (
                <div style={{ padding: '20px 0' }}>
                  <AlertTriangle style={{ width: 28, height: 28, color: WARNING, margin: '0 auto 10px' }} />
                  <p style={{ fontSize: 13, color: WARNING, fontWeight: 600, marginBottom: 4 }}>UPI not configured</p>
                  <p style={{ fontSize: 11, color: MUTED }}>Set <code>NEXT_PUBLIC_UPI_ID</code> in <code>.env.local</code> to enable QR payment.</p>
                </div>
              )}
              <ConfirmBtn label="Confirm Payment Received" processing={processing} onClick={onConfirm} />
            </motion.div>
          )}

          {/* Card */}
          {payMethod === 'card' && (
            <motion.div key="card"
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              style={{ background: SURFACE, borderRadius: 14, border: `1px solid ${BORDER}`, padding: '24px', textAlign: 'center' }}
            >
              <CreditCard style={{ width: 36, height: 36, color: ACCENT, margin: '0 auto 14px' }} />
              <p style={{ fontSize: 15, fontWeight: 700, color: TEXT, marginBottom: 8 }}>{fmt(grandTotal)}</p>
              <p style={{ fontSize: 13, color: MUTED, marginBottom: 24 }}>Collect payment using the card machine.</p>
              <ConfirmBtn label="Confirm Card Payment" processing={processing} onClick={onConfirm} />
            </motion.div>
          )}

          {/* Cash */}
          {payMethod === 'cash' && (
            <motion.div key="cash"
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              style={{ background: SURFACE, borderRadius: 14, border: `1px solid ${BORDER}`, padding: '20px' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <Banknote style={{ width: 18, height: 18, color: SUCCESS }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: TEXT }}>Cash Payment</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, padding: '12px 14px', background: SURFACE2, borderRadius: 10 }}>
                <span style={{ fontSize: 13, color: MUTED }}>Amount Due</span>
                <span style={{ fontSize: 16, fontWeight: 800, color: ACCENT, fontVariantNumeric: 'tabular-nums' }}>{fmt(grandTotal)}</span>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: MUTED, display: 'block', marginBottom: 6 }}>
                  Cash Received (₹)
                </label>
                <input
                  type="number"
                  value={cashReceived}
                  onChange={e => setCashReceived(e.target.value)}
                  placeholder={grandTotal.toFixed(2)}
                  min={grandTotal}
                  style={{
                    width: '100%', padding: '10px 14px',
                    background: SURFACE2, border: `1.5px solid ${BORDER2}`,
                    borderRadius: 10, color: TEXT, fontSize: 16, outline: 'none',
                    fontWeight: 600, fontVariantNumeric: 'tabular-nums',
                  }}
                  onFocus={e => (e.target.style.borderColor = ACCENT)}
                  onBlur={e => (e.target.style.borderColor = BORDER2)}
                />
              </div>

              {parseFloat(cashReceived) > 0 && (
                <div style={{ padding: '10px 14px', borderRadius: 10, background: cashChange >= 0 ? `${SUCCESS}15` : `${DANGER}15`, border: `1px solid ${cashChange >= 0 ? SUCCESS + '40' : DANGER + '40'}`, marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, color: MUTED }}>Change to Return</span>
                    <span style={{ fontSize: 15, fontWeight: 800, color: cashChange >= 0 ? SUCCESS : DANGER, fontVariantNumeric: 'tabular-nums' }}>
                      {cashChange >= 0 ? fmt(cashChange) : `Short by ${fmt(-cashChange)}`}
                    </span>
                  </div>
                </div>
              )}

              <ConfirmBtn
                label="Confirm Cash Payment"
                processing={processing}
                disabled={parseFloat(cashReceived) < grandTotal}
                onClick={onConfirm}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

function ConfirmBtn({ label, processing, disabled = false, onClick }: { label: string; processing: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={processing || disabled}
      style={{
        width: '100%', padding: '13px', borderRadius: 10, border: 'none',
        background: processing || disabled ? SURFACE2 : `linear-gradient(135deg, ${ACCENT} 0%, ${ACCENT_HOVER} 100%)`,
        color: processing || disabled ? MUTED : TEXT,
        fontSize: 14, fontWeight: 700, cursor: processing || disabled ? 'not-allowed' : 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        boxShadow: processing || disabled ? 'none' : '0 4px 20px rgba(99,102,241,0.35)',
        transition: 'all 0.15s',
      }}
    >
      {processing ? (
        <><Loader2 style={{ width: 15, height: 15, animation: 'spin 1s linear infinite' }} /> Processing…</>
      ) : (
        <><CheckCircle style={{ width: 15, height: 15 }} />{label}</>
      )}
    </button>
  )
}

// ─── Invoice View ─────────────────────────────────────────────────────────────
function InvoiceView({ sale, onNewBill, onBack }: { sale: CompletedSale; onNewBill: () => void; onBack: () => void }) {
  const bizName = process.env.NEXT_PUBLIC_BUSINESS_NAME || 'SBMS'

  function handlePrint() {
    window.print()
  }

  function handleDownload() {
    // Use browser print to PDF as jspdf would require client-side bundle
    const printWindow = window.open('', '_blank')
    if (!printWindow) return
    printWindow.document.write(buildInvoiceHTML(sale, bizName))
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => {
      printWindow.print()
      printWindow.close()
    }, 400)
  }

  const saleDate = new Date(sale.saleDate)
  const dateStr = saleDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  const timeStr = saleDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })

  return (
    <div style={{ minHeight: '100vh', background: BG, color: TEXT, fontFamily: "'Inter', -apple-system, sans-serif" }}>
      {/* Header */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 40,
        background: 'rgba(8,11,18,0.92)', backdropFilter: 'blur(12px)',
        borderBottom: `1px solid ${BORDER}`, padding: '0 20px',
      }} className="no-print">
        <div style={{ maxWidth: 700, margin: '0 auto', height: 56, display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={onBack} style={{ ...qtyBtnStyle, width: 34, height: 34 }}>
            <ArrowLeft style={{ width: 15, height: 15 }} />
          </button>
          <span style={{ fontSize: 15, fontWeight: 700 }}>Invoice</span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button onClick={handlePrint} style={actionBtnStyle}>
              <Printer style={{ width: 14, height: 14 }} /> Print
            </button>
            <button onClick={handleDownload} style={actionBtnStyle}>
              <Download style={{ width: 14, height: 14 }} /> Download PDF
            </button>
            <button onClick={onNewBill} style={{ ...actionBtnStyle, background: ACCENT, borderColor: ACCENT, color: TEXT }}>
              <RefreshCw style={{ width: 14, height: 14 }} /> New Bill
            </button>
          </div>
        </div>
      </header>

      {/* Invoice card */}
      <div style={{ maxWidth: 560, margin: '28px auto', padding: '0 20px' }}>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          id="invoice-print"
          style={{
            background: SURFACE, border: `1px solid ${BORDER2}`,
            borderRadius: 16, overflow: 'hidden',
          }}
        >
          {/* Invoice header */}
          <div style={{ background: `linear-gradient(135deg, ${ACCENT}22 0%, ${ACCENT_HOVER}11 100%)`, padding: '24px', borderBottom: `1px solid ${BORDER}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8,
                    background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_HOVER})`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Receipt style={{ width: 16, height: 16, color: TEXT }} />
                  </div>
                  <span style={{ fontSize: 18, fontWeight: 800, color: TEXT }}>{bizName}</span>
                </div>
                <p style={{ fontSize: 11, color: MUTED, margin: 0 }}>Tax Invoice / Bill of Supply</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: 11, color: MUTED, margin: '0 0 2px' }}>Invoice No.</p>
                <p style={{ fontSize: 13, fontWeight: 700, color: ACCENT, fontFamily: 'monospace' }}>{sale.transactionRef}</p>
              </div>
            </div>
          </div>

          <div style={{ padding: '20px 24px' }}>
            {/* Meta row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
              <MetaField label="Date" value={dateStr} />
              <MetaField label="Time" value={timeStr} />
              <MetaField label="Staff" value={sale.staffName} />
              <MetaField label="Payment" value={sale.paymentMethod.toUpperCase()} />
              {sale.customerName && <MetaField label="Customer" value={sale.customerName} />}
              {sale.customerMobile && <MetaField label="Mobile" value={sale.customerMobile} />}
            </div>

            <Divider />

            {/* Items */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 4 }}>
              <thead>
                <tr>
                  {['Item', 'Qty', 'Rate', 'Amount'].map((h, i) => (
                    <th key={h} style={{
                      fontSize: 10, fontWeight: 600, color: MUTED, textTransform: 'uppercase',
                      letterSpacing: '0.06em', padding: '0 0 8px',
                      textAlign: (i === 0 ? 'left' : 'right') as 'left' | 'right',
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sale.items.map((item, i) => (
                  <tr key={i} style={{ borderTop: `1px solid ${BORDER}` }}>
                    <td style={{ padding: '8px 0', fontSize: 13, color: TEXT }}>{item.productName}</td>
                    <td style={{ padding: '8px 0', fontSize: 12, color: SUBTLE, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{item.quantity}</td>
                    <td style={{ padding: '8px 0', fontSize: 12, color: SUBTLE, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmt(item.unitPrice)}</td>
                    <td style={{ padding: '8px 0', fontSize: 13, fontWeight: 600, color: TEXT, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmt(item.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <Divider />

            {/* Totals */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <TotalRow label="Subtotal" value={fmt(sale.subtotal)} />
              {sale.discountAmount > 0 && <TotalRow label="Discount" value={`−${fmt(sale.discountAmount)}`} valueColor={SUCCESS} />}
              <TotalRow label="Tax" value="₹0.00" />
              <div style={{ height: 1, background: BORDER2, margin: '4px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>TOTAL</span>
                <span style={{ fontSize: 22, fontWeight: 800, color: ACCENT, fontVariantNumeric: 'tabular-nums' }}>{fmt(sale.grandTotal)}</span>
              </div>
              {sale.paymentMethod === 'cash' && sale.cashReceived !== undefined && (
                <>
                  <TotalRow label="Cash Received" value={fmt(sale.cashReceived)} />
                  <TotalRow label="Change" value={fmt(sale.change ?? 0)} valueColor={SUCCESS} />
                </>
              )}
            </div>

            <Divider />

            {/* Footer */}
            <div style={{ textAlign: 'center', paddingTop: 8 }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '4px 12px', borderRadius: 20,
                background: `${SUCCESS}15`, border: `1px solid ${SUCCESS}30`,
                marginBottom: 12,
              }}>
                <CheckCircle style={{ width: 12, height: 12, color: SUCCESS }} />
                <span style={{ fontSize: 11, fontWeight: 600, color: SUCCESS }}>PAID</span>
              </div>
              <p style={{ fontSize: 12, color: MUTED, margin: 0 }}>Thank you for your purchase!</p>
            </div>
          </div>
        </motion.div>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; color: black !important; }
          #invoice-print { border: 1px solid #ccc !important; background: white !important; color: black !important; }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}

function MetaField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p style={{ fontSize: 10, color: MUTED, margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
      <p style={{ fontSize: 13, fontWeight: 600, color: TEXT, margin: 0 }}>{value}</p>
    </div>
  )
}

const actionBtnStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 5,
  padding: '6px 12px', borderRadius: 8, border: `1px solid ${BORDER2}`,
  background: SURFACE, color: SUBTLE, fontSize: 12, fontWeight: 500,
  cursor: 'pointer', transition: 'all 0.12s',
}

// ─── Print HTML builder ───────────────────────────────────────────────────────
function buildInvoiceHTML(sale: CompletedSale, bizName: string): string {
  const saleDate = new Date(sale.saleDate)
  const dateStr = saleDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  const timeStr = saleDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
  const fmt2 = (n: number) => '₹' + n.toFixed(2)

  const itemRows = sale.items.map(i => `
    <tr>
      <td>${i.productName}</td>
      <td style="text-align:center">${i.quantity}</td>
      <td style="text-align:right">${fmt2(i.unitPrice)}</td>
      <td style="text-align:right">${fmt2(i.lineTotal)}</td>
    </tr>
  `).join('')

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>Invoice ${sale.transactionRef}</title>
<style>
  body{font-family:'Helvetica Neue',Arial,sans-serif;max-width:480px;margin:20px auto;color:#111;font-size:13px}
  h1{font-size:20px;margin:0 0 2px}
  .meta{display:grid;grid-template-columns:1fr 1fr;gap:8px 16px;margin:12px 0}
  .meta-item .label{font-size:10px;color:#888;text-transform:uppercase}
  .meta-item .val{font-weight:600}
  table{width:100%;border-collapse:collapse;margin:12px 0}
  th{font-size:10px;text-transform:uppercase;color:#888;padding:6px 0;border-bottom:1px solid #ddd;text-align:left}
  td{padding:8px 0;border-bottom:1px solid #eee}
  .totals{margin-top:8px}
  .total-row{display:flex;justify-content:space-between;padding:3px 0;font-size:13px}
  .grand{font-size:18px;font-weight:800;border-top:2px solid #111;padding-top:8px;margin-top:4px}
  .paid{text-align:center;margin-top:16px;font-weight:700;color:#16a34a;font-size:14px}
  .footer{text-align:center;color:#888;font-size:11px;margin-top:8px}
</style></head><body>
<h1>${bizName}</h1>
<p style="color:#888;font-size:11px;margin:0">Tax Invoice / Bill of Supply</p>
<div style="display:flex;justify-content:space-between;margin-top:12px">
  <div><strong>Invoice No:</strong> ${sale.transactionRef}</div>
</div>
<div class="meta">
  <div class="meta-item"><div class="label">Date</div><div class="val">${dateStr}</div></div>
  <div class="meta-item"><div class="label">Time</div><div class="val">${timeStr}</div></div>
  <div class="meta-item"><div class="label">Staff</div><div class="val">${sale.staffName}</div></div>
  <div class="meta-item"><div class="label">Payment</div><div class="val">${sale.paymentMethod.toUpperCase()}</div></div>
  ${sale.customerName ? `<div class="meta-item"><div class="label">Customer</div><div class="val">${sale.customerName}</div></div>` : ''}
  ${sale.customerMobile ? `<div class="meta-item"><div class="label">Mobile</div><div class="val">${sale.customerMobile}</div></div>` : ''}
</div>
<table>
  <thead><tr><th>Item</th><th style="text-align:center">Qty</th><th style="text-align:right">Rate</th><th style="text-align:right">Amount</th></tr></thead>
  <tbody>${itemRows}</tbody>
</table>
<div class="totals">
  <div class="total-row"><span>Subtotal</span><span>${fmt2(sale.subtotal)}</span></div>
  ${sale.discountAmount > 0 ? `<div class="total-row"><span>Discount</span><span>−${fmt2(sale.discountAmount)}</span></div>` : ''}
  <div class="total-row"><span>Tax</span><span>₹0.00</span></div>
  <div class="total-row grand"><span>TOTAL</span><span>${fmt2(sale.grandTotal)}</span></div>
  ${sale.paymentMethod === 'cash' && sale.cashReceived !== undefined ? `
    <div class="total-row"><span>Cash Received</span><span>${fmt2(sale.cashReceived)}</span></div>
    <div class="total-row"><span>Change</span><span>${fmt2(sale.change ?? 0)}</span></div>
  ` : ''}
</div>
<div class="paid">✓ PAID</div>
<div class="footer">Thank you for your purchase!</div>
</body></html>`
}
