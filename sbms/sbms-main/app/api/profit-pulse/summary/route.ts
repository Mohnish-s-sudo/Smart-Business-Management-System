import { NextRequest, NextResponse } from 'next/server'
import { getTokenFromRequest } from '@/lib/auth'
import { getBusinessSummary, calculateBusinessHealthScore } from '@/modules/profitPulse/services/profitAnalysisService'

export async function GET(req: NextRequest) {
  const payload = getTokenFromRequest(req)
  if (!payload || payload.role !== 'owner') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const [summary, health] = await Promise.all([getBusinessSummary(), calculateBusinessHealthScore()])
    return NextResponse.json({ summary, health })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
