import { NextRequest, NextResponse } from 'next/server'
import { getTokenFromRequest } from '@/lib/auth'
import { getBusinessSummary, calculateBusinessHealthScore } from '@/modules/profitPulse/services/profitAnalysisService'
import { getTopSellingProducts, getMonthlyReport } from '@/services/profitPulseService'
import { generateAIResponse } from '@/modules/profitPulse/services/openaiService'

export async function POST(req: NextRequest) {
  const payload = getTokenFromRequest(req)
  if (!payload || payload.role !== 'owner') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { question } = await req.json()
    if (!question?.trim()) {
      return NextResponse.json({ error: 'Question is required' }, { status: 400 })
    }

    // Fetch business context in parallel
    const [summary, health, trend, topProducts] = await Promise.all([
      getBusinessSummary(),
      calculateBusinessHealthScore(),
      getMonthlyReport(2),
      getTopSellingProducts(5),
    ])

    const answer = await generateAIResponse(question, { summary, health, trend, topProducts })
    return NextResponse.json({ answer })
  } catch (err: unknown) {
    console.error('[profit-pulse/chat]', err)
    const msg = err instanceof Error ? err.message : 'Server error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
