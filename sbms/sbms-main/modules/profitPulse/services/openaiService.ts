import type { BusinessSummary, HealthScore } from './profitAnalysisService'
import type { MonthlyPoint, TopProduct } from '@/services/profitPulseService'

const SYSTEM_PROMPT = `You are Profit Pulse AI, an intelligent business assistant for the Smart Business Management System. You help the business owner understand sales, revenue, expenses, profit, inventory, stock, alerts and business performance. Use the supplied business data to answer questions accurately. Never invent business numbers. If the required data is unavailable, clearly say that the information is not available. When useful, provide a short explanation, important numbers, simple insights, and practical recommendations. Keep responses clear and beginner-friendly. When calculating values, use the supplied data accurately. Keep responses concise (3-5 sentences max) and actionable.`

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
    : curr
    ? `This month: Revenue ₹${curr.revenue.toLocaleString()}, Profit ₹${curr.profit.toLocaleString()}`
    : 'No trend data'

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

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'

export async function generateAIResponse(question: string, ctx: BusinessContext): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY
  const model = process.env.GROQ_MODEL || 'openai/gpt-oss-20b'

  if (!apiKey) {
    console.error('[Profit Pulse AI] GROQ_API_KEY is not set in environment variables.')
    return 'AI service is not configured. Please contact the administrator.'
  }

  if (!model) {
    console.error('[Profit Pulse AI] GROQ_MODEL is not set in environment variables.')
    return 'AI service is not configured correctly. Please contact the administrator.'
  }

  let response: Response
  try {
    response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: buildUserMessage(question, ctx) },
        ],
        max_tokens: 400,
        temperature: 0.7,
      }),
      signal: AbortSignal.timeout(30_000),
    })
  } catch (err: unknown) {
    const isTimeout = err instanceof Error && err.name === 'TimeoutError'
    if (isTimeout) {
      console.error('[Profit Pulse AI] Request to Groq timed out.')
      return 'AI service timed out. Please try again in a moment.'
    }
    console.error('[Profit Pulse AI] Network error reaching Groq API:', err instanceof Error ? err.message : err)
    return 'AI service is currently unavailable. Please try again.'
  }

  if (response.status === 401) {
    console.error('[Profit Pulse AI] Groq API returned 401 Unauthorized. Check GROQ_API_KEY.')
    return 'AI service authentication failed. Please contact the administrator.'
  }

  if (response.status === 404) {
    console.error(`[Profit Pulse AI] Groq model "${model}" not found (404).`)
    return `AI model is not available. Please contact the administrator.`
  }

  if (response.status === 429) {
    console.error('[Profit Pulse AI] Groq rate limit exceeded (429).')
    return 'AI service is busy. Please wait a moment and try again.'
  }

  if (!response.ok) {
    console.error(`[Profit Pulse AI] Groq API returned HTTP ${response.status}.`)
    return 'AI service is currently unavailable. Please try again.'
  }

  let data: unknown
  try {
    data = await response.json()
  } catch {
    console.error('[Profit Pulse AI] Failed to parse Groq API response as JSON.')
    return 'AI service returned an unexpected response. Please try again.'
  }

  // Parse OpenAI-compatible response format (Groq uses the same format)
  if (
    typeof data === 'object' &&
    data !== null &&
    'choices' in data &&
    Array.isArray((data as { choices: unknown[] }).choices) &&
    (data as { choices: unknown[] }).choices.length > 0
  ) {
    const firstChoice = (data as { choices: { message?: { content?: unknown } }[] }).choices[0]
    const content = firstChoice?.message?.content
    if (typeof content === 'string' && content.trim()) {
      return content.trim()
    }
  }

  console.error('[Profit Pulse AI] Unexpected response structure from Groq:', JSON.stringify(data))
  return 'I could not generate a response. Please try again.'
}
