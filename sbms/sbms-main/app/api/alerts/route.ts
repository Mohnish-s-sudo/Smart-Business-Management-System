import { NextRequest, NextResponse } from 'next/server'
import { getTokenFromRequest } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import Alert from '@/lib/models/Alert'

export async function GET(req: NextRequest) {
  const payload = getTokenFromRequest(req)
  if (!payload || payload.role !== 'owner') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()
  const alerts = await Alert.find().sort({ createdAt: -1 }).limit(50)
  return NextResponse.json(alerts)
}

export async function PATCH(req: NextRequest) {
  const payload = getTokenFromRequest(req)
  if (!payload || payload.role !== 'owner') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()
  const { id } = await req.json()
  const alert = await Alert.findByIdAndUpdate(id, { acknowledgedAt: new Date() }, { new: true })
  if (!alert) return NextResponse.json({ error: 'Alert not found' }, { status: 404 })
  return NextResponse.json(alert)
}
