import { NextRequest, NextResponse } from 'next/server'
import { getTokenFromRequest } from '@/lib/auth'
import { getProfitSummary, getLowStock, getDeadStock } from '@/services/profitPulseService'
import { generateSuggestions } from '@/services/aiSuggestionService'

export async function GET(req: NextRequest) {
  const payload = getTokenFromRequest(req)
  if (!payload || payload.role !== 'owner') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const [summary, lowStock, deadStock, suggestions] = await Promise.all([
      getProfitSummary(),
      getLowStock(),
      getDeadStock(),
      generateSuggestions()
    ])

    const month = new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })

    return NextResponse.json({ month, summary, lowStock, deadStock, suggestions })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
