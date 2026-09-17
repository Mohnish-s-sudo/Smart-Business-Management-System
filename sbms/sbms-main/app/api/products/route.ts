import { NextRequest, NextResponse } from 'next/server'
import { getTokenFromRequest } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import Product from '@/lib/models/Product'

export async function GET(req: NextRequest) {
  const payload = getTokenFromRequest(req)
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()
  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search') || ''
  const category = searchParams.get('category') || ''
  const lowStock = searchParams.get('lowStock') === 'true'

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filter: Record<string, any> = { isActive: true }
  if (search) {
    const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const searchRegex = { $regex: escapedSearch, $options: 'i' }
    filter.$or = [{ name: searchRegex }, { sku: searchRegex }, { category: searchRegex }]
  }
  if (category) filter.category = category

  let products = await Product.find(filter).sort({ name: 1 })
  if (lowStock) products = products.filter(p => p.stockQuantity <= p.reorderThreshold)

  return NextResponse.json(products)
}

export async function POST(req: NextRequest) {
  const payload = getTokenFromRequest(req)
  if (!payload || payload.role !== 'owner') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    await connectDB()
    const data = await req.json()
    const product = await Product.create(data)
    return NextResponse.json(product, { status: 201 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
