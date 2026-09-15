import { NextRequest, NextResponse } from 'next/server'
import mongoose from 'mongoose'
import { getTokenFromRequest } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import Product from '@/lib/models/Product'
import StockVerification from '@/lib/models/StockVerification'
import ActivityLog from '@/lib/models/ActivityLog'
import Alert from '@/lib/models/Alert'

export async function POST(req: NextRequest) {
  const payload = getTokenFromRequest(req)
  if (!payload || payload.role !== 'staff') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await connectDB()
  const { productId, actualStock } = await req.json()

  if (!productId || actualStock === undefined) {
    return NextResponse.json({ error: 'productId and actualStock required' }, { status: 400 })
  }

  const product = await Product.findById(productId)
  if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 })

  const staffId = new mongoose.Types.ObjectId(payload.userId)
  const difference = product.stockQuantity - actualStock

  await Promise.all([
    StockVerification.create({
      productId,
      staffId,
      systemStock: product.stockQuantity,
      actualStock,
      difference
    }),
    ActivityLog.create({
      staffId,
      action: 'STOCK_VERIFY',
      detail: `Verified ${product.name}: system=${product.stockQuantity}, actual=${actualStock}, diff=${difference}`
    })
  ])

  if (difference > 0) {
    await Alert.create({
      alertType: 'INVENTORY_LOSS',
      severity: difference >= 5 ? 'critical' : 'warning',
      message: `Inventory Loss Detected: ${product.name} is short by ${difference} units`,
      triggerData: { productId, systemStock: product.stockQuantity, actualStock, difference, staffId: payload.userId },
      channel: 'in-app'
    })
  }

  return NextResponse.json({ success: true, systemStock: product.stockQuantity, actualStock, difference })
}
