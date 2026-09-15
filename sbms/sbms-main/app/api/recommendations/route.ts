import { NextRequest, NextResponse } from 'next/server'
import { getTokenFromRequest } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import Recommendation from '@/lib/models/Recommendation'

const urgencyOrder: Record<string, number> = { urgent: 0, monitor: 1, informational: 2 }

export async function GET(req: NextRequest) {
  const payload = getTokenFromRequest(req)
  if (!payload || payload.role !== 'owner') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()
  const { searchParams } = new URL(req.url)
  const module = searchParams.get('module')
  const urgency = searchParams.get('urgency')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filter: Record<string, any> = { status: 'active' }
  if (module) filter.module = module
  if (urgency) filter.urgency = urgency

  const recs = await Recommendation.find(filter).sort({ createdAt: -1 })
  recs.sort((a, b) => (urgencyOrder[a.urgency] ?? 3) - (urgencyOrder[b.urgency] ?? 3))

  return NextResponse.json(recs)
}

export async function PATCH(req: NextRequest) {
  const payload = getTokenFromRequest(req)
  if (!payload || payload.role !== 'owner') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()
  const { id, status } = await req.json()
  const rec = await Recommendation.findByIdAndUpdate(id, { status }, { new: true })
  if (!rec) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(rec)
}
