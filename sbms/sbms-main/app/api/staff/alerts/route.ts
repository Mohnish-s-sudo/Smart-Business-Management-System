import { NextRequest, NextResponse } from 'next/server'
import { getTokenFromRequest } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import Alert from '@/lib/models/Alert'

export async function GET(req: NextRequest) {
  try {
    const payload = getTokenFromRequest(req)
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()
    const alerts = await Alert.find({ acknowledgedAt: null })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean()

    return NextResponse.json(alerts)
  } catch (err) {
    console.error('[staff/alerts]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
