import { NextRequest, NextResponse } from 'next/server'
import mongoose from 'mongoose'
import { getTokenFromRequest } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import Expense from '@/lib/models/Expense'
import ActivityLog from '@/lib/models/ActivityLog'

export async function POST(req: NextRequest) {
  const payload = getTokenFromRequest(req)
  if (!payload || payload.role !== 'staff') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await connectDB()
  const { category, amount, note } = await req.json()

  if (!category || !amount || amount <= 0) {
    return NextResponse.json({ error: 'category and positive amount required' }, { status: 400 })
  }

  const staffId = new mongoose.Types.ObjectId(payload.userId)

  const expense = await Expense.create({
    category,
    amount,
    notes: note,
    loggedById: staffId,
    expenseDate: new Date()
  })

  await ActivityLog.create({
    staffId,
    action: 'EXPENSE_LOGGED',
    detail: `Logged expense: ${category} — ₹${amount}`
  })

  return NextResponse.json({ success: true, expense }, { status: 201 })
}
