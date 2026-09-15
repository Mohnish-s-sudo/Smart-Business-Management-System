import { NextRequest, NextResponse } from 'next/server'
import { getTokenFromRequest } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import Product from '@/lib/models/Product'
import { checkLowStock } from '@/lib/checkLowStock'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const payload = getTokenFromRequest(req)
  if (!payload || payload.role !== 'owner') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  await connectDB()
  const data = await req.json()
  const product = await Product.findByIdAndUpdate(id, data, { new: true })
  if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 })
  await checkLowStock()
  return NextResponse.json(product)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const payload = getTokenFromRequest(req)
  if (!payload || payload.role !== 'owner') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  await connectDB()
  await Product.findByIdAndUpdate(id, { isActive: false })
  return NextResponse.json({ success: true })
}
