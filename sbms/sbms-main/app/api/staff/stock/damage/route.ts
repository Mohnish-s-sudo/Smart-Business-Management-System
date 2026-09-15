import { NextRequest, NextResponse } from 'next/server'
import mongoose from 'mongoose'
import { getTokenFromRequest } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import Product from '@/lib/models/Product'
import StockTransaction from '@/lib/models/StockTransaction'
import ActivityLog from '@/lib/models/ActivityLog'
import Alert from '@/lib/models/Alert'

export async function POST(req: NextRequest) {
  const payload = getTokenFromRequest(req)
  if (!payload || payload.role !== 'staff') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await connectDB()
  const { productId, quantity, reason } = await req.json()

  if (!productId || !quantity || quantity <= 0) {
    return NextResponse.json({ error: 'productId and positive quantity required' }, { status: 400 })
  }

  const product = await Product.findByIdAndUpdate(
    productId,
    { $inc: { stockQuantity: -quantity } },
    { new: true }
  )
  if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 })

  const staffId = new mongoose.Types.ObjectId(payload.userId)

  await Promise.all([
    StockTransaction.create({ productId, staffId, type: 'damage', quantity: -quantity, reason }),
    ActivityLog.create({ staffId, action: 'STOCK_DAMAGE', detail: `Recorded ${quantity} damaged units of ${product.name}. Reason: ${reason || 'N/A'}` }),
    Alert.create({
      alertType: 'STOCK_DAMAGE',
      severity: 'warning',
      message: `${quantity} units of ${product.name} recorded as damaged by ${payload.name}`,
      triggerData: { productId, quantity, reason, staffId: payload.userId },
      channel: 'in-app'
    })
  ])

  return NextResponse.json({ success: true, product })
}
