import { NextRequest, NextResponse } from 'next/server'
import mongoose from 'mongoose'
import { getTokenFromRequest } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import Expense from '@/lib/models/Expense'
import { sendExpenseWebhook } from '@/lib/n8n/webhooks'
import { checkLowStock } from '@/lib/checkLowStock'

export async function GET(req: NextRequest) {
  const payload = getTokenFromRequest(req)
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()
  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const category = searchParams.get('category')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filter: Record<string, any> = {}
  if (category) filter.category = category
  if (from || to) {
    filter.expenseDate = {}
    if (from) filter.expenseDate.$gte = new Date(from)
    if (to) filter.expenseDate.$lte = new Date(to)
  }

  const [expenses, categoryTotals] = await Promise.all([
    Expense.find(filter).populate('loggedById', 'name').sort({ expenseDate: -1 }).limit(100),
    Expense.aggregate([
      { $match: filter },
      { $group: { _id: '$category', amount: { $sum: '$amount' } } },
      { $project: { category: '$_id', amount: 1, _id: 0 } }
    ])
  ])

  return NextResponse.json({ expenses, categoryTotals })
}

export async function POST(req: NextRequest) {
  const payload = getTokenFromRequest(req)
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    await connectDB()
    const data = await req.json()
    const expense = await Expense.create({ ...data, loggedById: new mongoose.Types.ObjectId(payload.userId) })
    await sendExpenseWebhook({ expenseId: expense._id, category: expense.category, amount: expense.amount })
    await checkLowStock()
    return NextResponse.json(expense, { status: 201 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
