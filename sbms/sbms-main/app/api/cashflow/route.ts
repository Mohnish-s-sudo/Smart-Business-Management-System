import { NextRequest, NextResponse } from 'next/server'
import { getTokenFromRequest } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import Cashflow from '@/lib/models/Cashflow'

export async function GET(req: NextRequest) {
  const payload = getTokenFromRequest(req)
  if (!payload || payload.role !== 'owner') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()
  const now = new Date()

  // Auto-mark overdue
  await Cashflow.updateMany(
    { status: 'pending', dueDate: { $lt: now } },
    { $set: { status: 'overdue' } }
  )

  const [receivables, payables] = await Promise.all([
    Cashflow.find({ type: 'receivable' }).sort({ dueDate: 1 }),
    Cashflow.find({ type: 'payable' }).sort({ dueDate: 1 })
  ])

  const totalOutstanding = receivables.filter(r => r.status !== 'paid').reduce((s, r) => s + r.amount, 0)
  const totalOverdue = receivables.filter(r => r.status === 'overdue').reduce((s, r) => s + r.amount, 0)
  const totalPayables = payables.filter(p => p.status !== 'paid').reduce((s, p) => s + p.amount, 0)

  return NextResponse.json({
    receivables,
    payables,
    summary: { totalOutstanding, totalOverdue, totalPayables, netPosition: totalOutstanding - totalPayables }
  })
}

export async function POST(req: NextRequest) {
  const payload = getTokenFromRequest(req)
  if (!payload || payload.role !== 'owner') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()
  const data = await req.json()
  const entry = await Cashflow.create(data)
  return NextResponse.json(entry, { status: 201 })
}
