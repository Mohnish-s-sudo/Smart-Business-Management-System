import { NextRequest, NextResponse } from 'next/server'
import mongoose from 'mongoose'
import { getTokenFromRequest } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import Sale from '@/lib/models/Sale'
import Product from '@/lib/models/Product'
import Cashflow from '@/lib/models/Cashflow'
import Alert from '@/lib/models/Alert'
import { sendSaleWebhook, sendLowStockAlert } from '@/lib/n8n/webhooks'
import { checkLowStock } from '@/lib/checkLowStock'

/* =========================
   GET SALES
========================= */
export async function GET(req: NextRequest) {
  const payload = getTokenFromRequest(req)
  if (!payload) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await connectDB()

  const { searchParams } = new URL(req.url)
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '20')
  const staffId = searchParams.get('staffId')
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  const filter: any = {}

  if (payload.role === 'staff') {
    filter.staffId = new mongoose.Types.ObjectId(payload.userId)
  } else if (staffId) {
    filter.staffId = new mongoose.Types.ObjectId(staffId)
  }

  if (from || to) {
    filter.saleDate = {}
    if (from) filter.saleDate.$gte = new Date(from)
    if (to) filter.saleDate.$lte = new Date(to)
  }

  const [sales, total] = await Promise.all([
    Sale.find(filter)
      .populate('staffId', 'name')
      .sort({ saleDate: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Sale.countDocuments(filter)
  ])

  return NextResponse.json({
    sales,
    total,
    page,
    pages: Math.ceil(total / limit)
  })
}

/* =========================
   CREATE SALE
========================= */
export async function POST(req: NextRequest) {
  const payload = getTokenFromRequest(req)
  if (!payload) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await connectDB()

    const body = await req.json()
    const { items, paymentMethod, notes } = body

    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'No items provided' }, { status: 400 })
    }

    let totalAmount = 0
    let totalCost = 0
    const saleItems: any[] = []

    /* ===== Validate products and calculate totals ===== */
    for (const item of items) {
      const product = await Product.findById(item.productId)

      if (!product) {
        return NextResponse.json(
          { error: `Product not found` },
          { status: 404 }
        )
      }

      if (product.stockQuantity < item.quantity) {
        return NextResponse.json(
          { error: `Not enough stock for ${product.name}` },
          { status: 400 }
        )
      }

      const lineAmount = product.retailPrice * item.quantity
      const lineCost = product.unitCost * item.quantity

      totalAmount += lineAmount
      totalCost += lineCost

      saleItems.push({
        productId: product._id,
        productName: product.name,
        quantity: item.quantity,
        unitPrice: product.retailPrice,
        unitCost: product.unitCost,
        lineMargin: lineAmount - lineCost
      })
    }

    const txRef = `TXN-${Date.now()}`

    /* ===== Create sale ===== */
    const sale = await Sale.create({
      transactionRef: txRef,
      staffId: new mongoose.Types.ObjectId(payload.userId),
      paymentMethod,
      totalAmount,
      totalCost,
      grossMargin: totalAmount - totalCost,
      notes,
      items: saleItems,
      saleDate: new Date()
    })

    /* ===== Deduct stock and create alerts ===== */
    for (const item of saleItems) {
      const updated = await Product.findByIdAndUpdate(
        item.productId,
        { $inc: { stockQuantity: -item.quantity } },
        { new: true }
      )

      if (!updated) continue

      if (updated.stockQuantity <= updated.reorderThreshold) {
        await Alert.create({
          alertType: 'LOW_STOCK',
          severity: updated.stockQuantity === 0 ? 'critical' : 'warning',
          message: `${updated.name} stock is ${
            updated.stockQuantity === 0 ? 'out of stock' : 'low'
          } (${updated.stockQuantity} remaining)`,
          triggerData: {
            productId: updated._id,
            stockQuantity: updated.stockQuantity
          }
        })

        try {
          await sendLowStockAlert({
            productId: updated._id,
            name: updated.name,
            stockQuantity: updated.stockQuantity
          })
        } catch (e) {
          console.log('Low stock webhook failed')
        }
      }
    }

    /* ===== Run low stock check across all products ===== */
    await checkLowStock()

    /* ===== Credit sale → receivable ===== */
    if (paymentMethod === 'credit') {
      const dueDate = new Date()
      dueDate.setDate(dueDate.getDate() + 30)

      await Cashflow.create({
        type: 'receivable',
        customerOrVendor: notes || 'Credit Customer',
        amount: totalAmount,
        dueDate,
        saleId: sale._id
      })
    }

    /* ===== Send sale webhook ===== */
    try {
      await sendSaleWebhook({
        saleId: sale._id,
        transactionRef: txRef,
        totalAmount,
        paymentMethod
      })
    } catch (e) {
      console.log('Sale webhook failed')
    }

    return NextResponse.json(sale, { status: 201 })

  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}