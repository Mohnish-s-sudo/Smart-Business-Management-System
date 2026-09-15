import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import Product from '@/lib/models/Product'
import StockTransaction from '@/lib/models/StockTransaction'
import { getTokenFromRequest } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const payload = getTokenFromRequest(req)
  if (!payload || payload.role !== 'staff') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await connectDB()

    const { productId, adjustment, reason } = await req.json()

    if (!productId || adjustment === undefined) {
      return NextResponse.json({ error: 'Missing data' }, { status: 400 })
    }

    // Adjust stock
    const product = await Product.findByIdAndUpdate(
      productId,
      { $inc: { stockQuantity: adjustment } },
      { new: true }
    )

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    // Record adjustment
    await StockTransaction.create({
      productId,
      type: 'adjust',
      quantity: adjustment,
      note: reason,
      staffId: payload.userId
    })

    return NextResponse.json({
      message: 'Stock adjusted successfully',
      product
    })

  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}