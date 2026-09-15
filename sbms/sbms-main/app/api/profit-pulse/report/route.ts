import { NextRequest, NextResponse } from 'next/server'
import { getTokenFromRequest } from '@/lib/auth'
import { getBusinessSummary, calculateBusinessHealthScore } from '@/modules/profitPulse/services/profitAnalysisService'
import { generateInsights } from '@/modules/profitPulse/services/aiInsightService'
import { generateSuggestions } from '@/modules/profitPulse/services/aiSuggestionService'
import { getMonthlyReport, getDeadStock, getLowStock, getTopSellingProducts } from '@/services/profitPulseService'

export async function GET(req: NextRequest) {
  const payload = getTokenFromRequest(req)
  if (!payload || payload.role !== 'owner') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const [summary, health, trend, insights, suggestions, deadStock, lowStock, topProducts] = await Promise.all([
      getBusinessSummary(), calculateBusinessHealthScore(), getMonthlyReport(6),
      generateInsights(), generateSuggestions(), getDeadStock(), getLowStock(), getTopSellingProducts(5)
    ])
    const month = new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
    return NextResponse.json({ month, summary, health, trend, insights, suggestions, deadStock, lowStock, topProducts })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
