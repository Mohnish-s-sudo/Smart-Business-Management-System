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
    const body = await req.json()
    const { question, history } = body as {
      question?: string
      history?: { role: 'user' | 'ai'; text: string }[]
    }

    if (!question?.trim()) {
      return NextResponse.json({ error: 'Question is required' }, { status: 400 })
    }

    // Build a context-enriched question using recent chat history
    // so the AI can resolve pronouns like "it", "that", "which one"
    let enrichedQuestion = question.trim()
    if (history && history.length >= 2) {
      const recent = history.slice(-4) // last 2 exchanges
      const historyText = recent
        .map(m => `${m.role === 'user' ? 'User' : 'AI'}: ${m.text}`)
        .join('\n')
      enrichedQuestion = `[Previous context:\n${historyText}\n]\n\nNew question: ${question.trim()}`
    }

    // Fetch aggregate business context in parallel (used as background summary)
    const [summary, health, trend, topProducts] = await Promise.all([
      getBusinessSummary(),
      calculateBusinessHealthScore(),
      getMonthlyReport(2),
      getTopSellingProducts(5),
    ])

    const answer = await generateAIResponse(enrichedQuestion, {
      summary, health, trend, topProducts,
    })

    return NextResponse.json({ answer })

  } catch (err: unknown) {
    console.error('[profit-pulse/chat]', err)
    const msg = err instanceof Error ? err.message : 'Server error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
