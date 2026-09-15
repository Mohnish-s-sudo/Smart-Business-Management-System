import { NextRequest, NextResponse } from 'next/server'
import { getTokenFromRequest } from '@/lib/auth'
import { getMonthlyReport } from '@/services/profitPulseService'

export async function GET(req: NextRequest) {
  const payload = getTokenFromRequest(req)
  if (!payload || payload.role !== 'owner') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const months = parseInt(new URL(req.url).searchParams.get('months') || '6')
    const trend = await getMonthlyReport(months)
    return NextResponse.json(trend)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
