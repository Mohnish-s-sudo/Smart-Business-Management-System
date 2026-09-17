import { NextRequest, NextResponse } from 'next/server'
import mongoose from 'mongoose'
import { getTokenFromRequest } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import Sale from '@/lib/models/Sale'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const payload = getTokenFromRequest(req)
  if (!payload) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: 'Invalid sale ID' }, { status: 400 })
  }

  try {
    await connectDB()

    const sale = await Sale.findById(id).populate('staffId', 'name email')
    if (!sale) {
      return NextResponse.json({ error: 'Sale not found' }, { status: 404 })
    }

    // Parse notes for extra fields
    const notes = sale.notes || ''
    const parseNote = (key: string) => {
      const match = notes.match(new RegExp(`${key}: ([^|]+)`))
      return match ? match[1].trim() : null
    }

    const discountNote = parseNote('Discount')
    const discountAmount = discountNote ? parseFloat(discountNote.replace('₹', '')) : 0
    const subtotal = sale.totalAmount + discountAmount

    return NextResponse.json({
      saleId: sale._id.toString(),
      transactionRef: sale.transactionRef,
      saleDate: sale.saleDate,
      paymentMethod: sale.paymentMethod,
      totalAmount: sale.totalAmount,
      subtotal,
      discountAmount,
      staffName: (sale.staffId as any)?.name || 'Staff',
      customerName: parseNote('Customer'),
      customerMobile: parseNote('Mobile'),
      items: sale.items.map((i: any) => ({
        productName: i.productName,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        lineTotal: i.unitPrice * i.quantity,
      })),
    })
  } catch (err) {
    console.error('[billing/invoice]', err)
    return NextResponse.json({ error: 'Unable to fetch invoice' }, { status: 500 })
  }
}
