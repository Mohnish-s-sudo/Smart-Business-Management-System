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

    const { productId, quantity, note } = await req.json()

    if (!productId || !quantity) {
      return NextResponse.json({ error: 'Missing data' }, { status: 400 })
    }

    // Increase stock
    const product = await Product.findByIdAndUpdate(
      productId,
      { $inc: { stockQuantity: quantity } },
      { new: true }
    )

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    // Record stock transaction
    await StockTransaction.create({
      productId,
      type: 'add',
      quantity,
      note,
      staffId: payload.userId
    })

    return NextResponse.json({
      message: 'Stock added successfully',
      product
    })

  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}