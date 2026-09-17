import { NextRequest, NextResponse } from 'next/server'
import mongoose from 'mongoose'
import { getTokenFromRequest } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import Sale from '@/lib/models/Sale'
import Product from '@/lib/models/Product'
import StockTransaction from '@/lib/models/StockTransaction'
import Alert from '@/lib/models/Alert'
import Cashflow from '@/lib/models/Cashflow'
import ActivityLog from '@/lib/models/ActivityLog'
import { checkLowStock } from '@/lib/checkLowStock'

/* ───────────────────────────────────────────────────────────
   Generate a unique bill number: SBMS-YYYY-NNNNNN
────────────────────────────────────────────────────────── */
async function generateBillNumber(): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `SBMS-${year}-`

  // Find highest existing number this year
  const last = await Sale.findOne(
    { transactionRef: { $regex: `^${prefix}` } },
    { transactionRef: 1 },
    { sort: { transactionRef: -1 } }
  )

  let seq = 1
  if (last?.transactionRef) {
    const parts = last.transactionRef.split('-')
    const num = parseInt(parts[parts.length - 1] || '0', 10)
    if (!isNaN(num)) seq = num + 1
  }

  return `${prefix}${String(seq).padStart(6, '0')}`
}

/* ───────────────────────────────────────────────────────────
   POST /api/billing/complete
────────────────────────────────────────────────────────── */
export async function POST(req: NextRequest) {
  const payload = getTokenFromRequest(req)
  if (!payload) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Idempotency: prevent duplicate submissions
  let body: {
    items: { productId: string; quantity: number }[]
    discount: number
    discountType: 'fixed' | 'percent'
    paymentMethod: 'cash' | 'upi' | 'card'
    cashReceived?: number
    customerName?: string
    customerMobile?: string
    idempotencyKey?: string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { items, discount = 0, discountType = 'fixed', paymentMethod,
    cashReceived, customerName, customerMobile, idempotencyKey } = body

  if (!items || items.length === 0) {
    return NextResponse.json({ error: 'No items in bill' }, { status: 400 })
  }

  if (!['cash', 'upi', 'card'].includes(paymentMethod)) {
    return NextResponse.json({ error: 'Invalid payment method' }, { status: 400 })
  }

  try {
    await connectDB()

    // Idempotency check — if same key already exists, return existing sale
    if (idempotencyKey) {
      const existing = await Sale.findOne({ notes: `idem:${idempotencyKey}` })
      if (existing) {
        return NextResponse.json({ saleId: existing._id.toString(), transactionRef: existing.transactionRef, alreadyProcessed: true })
      }
    }

    // ── 1. Validate products & calculate totals (server-side) ──
    let subtotal = 0
    let totalCost = 0
    const saleItems: {
      productId: mongoose.Types.ObjectId
      productName: string
      quantity: number
      unitPrice: number
      unitCost: number
      lineMargin: number
    }[] = []

    for (const item of items) {
      if (!mongoose.Types.ObjectId.isValid(item.productId)) {
        return NextResponse.json({ error: 'Invalid product ID' }, { status: 400 })
      }
      if (!Number.isInteger(item.quantity) || item.quantity < 1) {
        return NextResponse.json({ error: 'Invalid quantity' }, { status: 400 })
      }

      const product = await Product.findById(item.productId)
      if (!product) {
        return NextResponse.json({ error: `Product not found` }, { status: 404 })
      }
      if (!product.isActive) {
        return NextResponse.json({ error: `${product.name} is no longer available` }, { status: 400 })
      }
      if (product.stockQuantity < item.quantity) {
        return NextResponse.json({
          error: `Insufficient stock for "${product.name}". Available: ${product.stockQuantity}`
        }, { status: 400 })
      }

      const lineAmount = product.retailPrice * item.quantity
      const lineCost = (product.unitCost ?? 0) * item.quantity

      subtotal += lineAmount
      totalCost += lineCost

      saleItems.push({
        productId: product._id as mongoose.Types.ObjectId,
        productName: product.name,
        quantity: item.quantity,
        unitPrice: product.retailPrice,
        unitCost: product.unitCost ?? 0,
        lineMargin: lineAmount - lineCost,
      })
    }

    // ── 2. Apply discount (server-side) ──
    let discountAmount = 0
    if (discount > 0) {
      if (discountType === 'percent') {
        discountAmount = Math.round((subtotal * Math.min(discount, 100)) / 100 * 100) / 100
      } else {
        discountAmount = Math.min(discount, subtotal)
      }
    }
    const grandTotal = Math.max(0, subtotal - discountAmount)

    // Cash validation
    if (paymentMethod === 'cash') {
      if (cashReceived === undefined || cashReceived < grandTotal) {
        return NextResponse.json({
          error: `Cash received (₹${cashReceived ?? 0}) is less than total (₹${grandTotal})`
        }, { status: 400 })
      }
    }

    // ── 3. Generate bill number ──
    const transactionRef = await generateBillNumber()

    // ── 4. Build notes string ──
    const noteParts: string[] = []
    if (customerName) noteParts.push(`Customer: ${customerName}`)
    if (customerMobile) noteParts.push(`Mobile: ${customerMobile}`)
    if (discountAmount > 0) noteParts.push(`Discount: ₹${discountAmount}`)
    if (paymentMethod === 'cash' && cashReceived !== undefined) noteParts.push(`Cash: ₹${cashReceived}`)
    if (idempotencyKey) noteParts.push(`idem:${idempotencyKey}`)

    // ── 5. Create sale record ──
    const sale = await Sale.create({
      transactionRef,
      staffId: new mongoose.Types.ObjectId(payload.userId),
      saleDate: new Date(),
      paymentMethod,
      totalAmount: grandTotal,
      totalCost,
      grossMargin: grandTotal - totalCost,
      notes: noteParts.join(' | ') || undefined,
      items: saleItems,
    })

    // ── 6. Deduct stock & create stock transactions ──
    for (const item of saleItems) {
      await Product.findByIdAndUpdate(
        item.productId,
        { $inc: { stockQuantity: -item.quantity } },
        { new: true }
      ).then(async (updated) => {
        if (!updated) return

        // Stock transaction record
        await StockTransaction.create({
          productId: item.productId,
          type: 'adjust',
          quantity: -item.quantity,
          note: `Sale: ${transactionRef}`,
          staffId: new mongoose.Types.ObjectId(payload.userId),
        })

        // Low stock alert
        if (updated.stockQuantity <= updated.reorderThreshold) {
          await Alert.create({
            alertType: 'LOW_STOCK',
            severity: updated.stockQuantity === 0 ? 'critical' : 'warning',
            message: `${updated.name} stock is ${updated.stockQuantity === 0 ? 'out of stock' : 'low'} (${updated.stockQuantity} remaining)`,
            triggerData: { productId: updated._id, stockQuantity: updated.stockQuantity },
          }).catch(() => {})
        }
      })
    }

    // ── 7. Activity log ──
    await ActivityLog.create({
      staffId: new mongoose.Types.ObjectId(payload.userId),
      action: 'SALE',
      detail: `Sale ${transactionRef} · ₹${grandTotal} via ${paymentMethod}`,
    }).catch(() => {})

    // ── 8. Cashflow for credit (not applicable here, but keep parity) ──

    // ── 9. Run low stock check ──
    await checkLowStock().catch(() => {})

    return NextResponse.json({
      saleId: sale._id.toString(),
      transactionRef,
      subtotal,
      discountAmount,
      grandTotal,
      paymentMethod,
      cashReceived: paymentMethod === 'cash' ? cashReceived : undefined,
      change: paymentMethod === 'cash' && cashReceived !== undefined ? cashReceived - grandTotal : 0,
      customerName: customerName || null,
      customerMobile: customerMobile || null,
      staffName: payload.name,
      saleDate: sale.saleDate,
      items: saleItems.map(i => ({
        productName: i.productName,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        lineTotal: i.unitPrice * i.quantity,
      })),
    }, { status: 201 })

  } catch (err) {
    console.error('[billing/complete]', err)
    return NextResponse.json({ error: 'Unable to complete the bill. Please try again.' }, { status: 500 })
  }
}
