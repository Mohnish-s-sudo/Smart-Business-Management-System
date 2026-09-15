import OpenAI from 'openai'
import type { BusinessSummary, HealthScore } from './profitAnalysisService'
import type { MonthlyPoint, TopProduct } from '@/services/profitPulseService'

const SYSTEM_PROMPT = `You are Profit Pulse AI, a business intelligence assistant for small businesses. You analyze revenue, expenses, profit, loss, inventory, and sales data. You provide insights, business advice, profit improvement suggestions, and loss reduction strategies. Always give clear business advice, not just numbers. Explain reasons and give suggestions to improve business performance. Keep responses concise (3-5 sentences max) and actionable.`

export interface BusinessContext {
  summary: BusinessSummary
  health: HealthScore
  trend: MonthlyPoint[]
  topProducts: TopProduct[]
}

function buildUserMessage(question: string, ctx: BusinessContext): string {
  const curr = ctx.trend.at(-1)
  const prev = ctx.trend.at(-2)
  const topList = ctx.topProducts.map(p => `${p.name} (₹${p.revenue.toLocaleString()})`).join(', ') || 'No data'
  const trendSummary = curr && prev
    ? `Last month: Revenue ₹${prev.revenue.toLocaleString()}, Profit ₹${prev.profit.toLocaleString()} → This month: Revenue ₹${curr.revenue.toLocaleString()}, Profit ₹${curr.profit.toLocaleString()}`
    : curr ? `This month: Revenue ₹${curr.revenue.toLocaleString()}, Profit ₹${curr.profit.toLocaleString()}` : 'No trend data'

  return `Business Data:
- Revenue: ₹${ctx.summary.revenue.toLocaleString()}
- Expenses: ₹${ctx.summary.expenses.toLocaleString()}
- Profit: ₹${ctx.summary.profit.toLocaleString()}
- Loss: ₹${ctx.summary.loss.toLocaleString()}
- Profit Margin: ${ctx.summary.profitMargin}%
- Dead Stock Value: ₹${ctx.summary.deadStockValue.toLocaleString()}
- Low Stock Items: ${ctx.summary.lowStockCount}
- Top Selling Products: ${topList}
- Profit Trend: ${trendSummary}
- Business Health Score: ${ctx.health.score}/100 (${ctx.health.status})

User Question: ${question}`
}

export async function generateAIResponse(question: string, ctx: BusinessContext): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return 'OpenAI API key is not configured. Please add OPENAI_API_KEY to your environment variables.'
  }

  const client = new OpenAI({ apiKey })

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildUserMessage(question, ctx) }
    ],
    max_tokens: 300,
    temperature: 0.7,
  })

  return response.choices[0]?.message?.content?.trim() || 'I could not generate a response. Please try again.'
}
