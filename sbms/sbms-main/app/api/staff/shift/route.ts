import { NextRequest, NextResponse } from 'next/server'
import mongoose from 'mongoose'
import { getTokenFromRequest } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import Staff from '@/lib/models/Staff'
import Sale from '@/lib/models/Sale'
import Expense from '@/lib/models/Expense'

export async function GET(req: NextRequest) {
  const payload = getTokenFromRequest(req)
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
  const userId = new mongoose.Types.ObjectId(payload.userId)

  const [sales, expenses] = await Promise.all([
    Sale.find({ staffId: userId, saleDate: { $gte: todayStart } }),
    Expense.find({ loggedById: userId, expenseDate: { $gte: todayStart } })
  ])

  const totalSales = sales.reduce((s, sale) => s + sale.totalAmount, 0)
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0)

  return NextResponse.json({
    transactions: sales.length,
    totalSales: Math.round(totalSales),
    totalExpenses: Math.round(totalExpenses),
    recentSales: sales.slice(0, 5)
  })
}

export async function POST(req: NextRequest) {
  const payload = getTokenFromRequest(req)
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()
  const { action } = await req.json()
  const userId = new mongoose.Types.ObjectId(payload.userId)

  let staffDoc = await Staff.findOne({ userId })
  if (!staffDoc) staffDoc = await Staff.create({ userId, shifts: [] })

  if (action === 'clock_in') {
    staffDoc.shifts.push({ date: new Date(), clockIn: new Date() })
    await staffDoc.save()
    return NextResponse.json({ message: 'Clocked in', shift: staffDoc.shifts.at(-1) })
  }

  if (action === 'clock_out') {
    const lastShift = staffDoc.shifts.at(-1)
    if (!lastShift || lastShift.clockOut) {
      return NextResponse.json({ error: 'No active shift to clock out' }, { status: 400 })
    }
    lastShift.clockOut = new Date()
    lastShift.hoursWorked = (lastShift.clockOut.getTime() - lastShift.clockIn.getTime()) / 3600000
    await staffDoc.save()
    return NextResponse.json({ message: 'Clocked out', shift: lastShift })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
