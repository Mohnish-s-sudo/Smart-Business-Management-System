/**
 * openaiService.ts
 *
 * Profit Pulse AI — data-aware chat engine.
 *
 * Flow per question:
 *  1. Detect intents from the user question (keyword matching).
 *  2. Fetch only the live data needed for those intents.
 *  3. Build a context block with both aggregate summary AND live records.
 *  4. Send to the existing Groq AI model.
 *  5. Return the answer.
 */

import type { BusinessSummary, HealthScore } from './profitAnalysisService'
import type { MonthlyPoint, TopProduct } from '@/services/profitPulseService'
import {
  getLatestSale, getRecentSales, getSalesByPeriod, compareMonthlySales,
  getLatestStockAddition, getInventorySummary, getTopSellingWithStock, getRestockSuggestions,
  getLatestExpense, getExpensesByPeriod,
  getProfitByPeriod,
  getCashFlowSummary,
  getActiveAlerts,
  findProduct,
} from './liveDataService'

// ─── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are Profit Pulse AI, an intelligent hybrid assistant for the Smart Business Management System (SBMS).

You have two capabilities:
1. SBMS BUSINESS DATA: You receive LIVE data from the business database. Use it to answer business questions accurately.
2. GENERAL KNOWLEDGE: You can answer any general question (technology, science, people, programming, history, etc.) using your own training knowledge.

ROUTING RULES:
- If LIVE DATABASE RECORDS are provided in the message → answer using that real data. Never invent business figures.
- If no LIVE DATABASE RECORDS are provided → answer from your own general knowledge freely and helpfully.
- For MIXED questions (e.g. "What is our best product and how can we market it?") → use the provided SBMS data for the business part, then add general knowledge for advice.
- NEVER dump database contents, credentials, API keys, user data, or system internals in response to a general question.

SBMS DATA RULES (when data is provided):
- Never invent product names, prices, quantities, dates, or amounts.
- If a data field says "found: false" or is empty, say clearly that no record was found.
- Format currency as ₹ followed by the number (e.g. ₹1,250).
- For SBMS navigation questions, refer to: Dashboard, Sales, Inventory, Expenses, Cash Flow, Alerts, Reports, Profit Pulse.

GENERAL KNOWLEDGE RULES (when no data is provided):
- Answer freely and helpfully like a knowledgeable assistant.
- Keep answers clear and appropriately concise.
- For coding questions, provide working code examples.
- Do not mention SBMS, databases, or business data in pure general answers.

RESPONSE LENGTH:
- Business data answers: 3-6 lines, focused on the numbers.
- General knowledge: as long as needed to be genuinely helpful.`

// ─── Intent detection ─────────────────────────────────────────────────────────

type Intent =
  | 'latest_sale'
  | 'recent_sales'
  | 'sales_today'
  | 'sales_yesterday'
  | 'sales_week'
  | 'sales_month'
  | 'sales_lastmonth'
  | 'sales_compare'
  | 'latest_stock'
  | 'inventory_summary'
  | 'low_stock'
  | 'out_of_stock'
  | 'top_products'
  | 'restock'
  | 'latest_expense'
  | 'expense_today'
  | 'expense_week'
  | 'expense_month'
  | 'profit_today'
  | 'profit_week'
  | 'profit_month'
  | 'profit_lastmonth'
  | 'cashflow'
  | 'alerts'
  | 'product_lookup'
  | 'business_health'
  | 'general_knowledge'  // ← NEW: pure general question, no DB needed

/**
 * Returns true if the question is clearly about general knowledge
 * and contains NO SBMS-business signals.
 * This check runs BEFORE SBMS intent detection.
 */
function isGeneralKnowledgeOnly(q: string): boolean {
  const t = q.toLowerCase()

  // Hard SBMS signals — if any are present, NOT a pure general question
  const hasSBMSSignal = /\b(sale|sell|sold|revenue|profit|expense|stock|inventory|product|bill|billing|transaction|cashflow|receivable|payable|alert|customer|supplier|restock|margin|cost|purchase)\b/.test(t)
  if (hasSBMSSignal) return false

  // Strong general-knowledge signals
  const generalPatterns = [
    // People / entities
    /who\s+(is|are|was|were)\b/,
    /what\s+(is|are|was|were)\s+(a|an|the)?\s*[a-z]/,
    // Tech / programming
    /what\s+is\s+(java|python|javascript|c\+\+|html|css|sql|react|node|ai|ml|machine learning|deep learning|blockchain|cloud|api|database|algorithm|data structure)/,
    /explain\s+(machine learning|artificial intelligence|deep learning|neural|blockchain|quantum|algorithm)/,
    /write\s+(a|an)?\s*(program|code|function|script|example)/,
    /how\s+(do|does|to)\s+(program|code|implement|create|build|write)/,
    // Geography / history / science
    /capital\s+of/,
    /who\s+invented/,
    /who\s+founded/,
    /history\s+of/,
    /what\s+year/,
    /\b(fibonacci|prime|sort|search|recursion|oop|object.oriented)\b/,
    // General "what is X" where X is not a business term
    /what\s+is\s+(the\s+)?(meaning|definition|difference|concept)\s+of/,
    // Coding tasks
    /fibonacci|factorial|palindrome|anagram|binary search|bubble sort|merge sort/,
  ]

  return generalPatterns.some(p => p.test(t))
}

function detectIntents(q: string): Intent[] {
  // ── Check for pure general knowledge FIRST ──
  if (isGeneralKnowledgeOnly(q)) {
    console.log(`[Profit Pulse AI] Classified as GENERAL_KNOWLEDGE`)
    return ['general_knowledge']
  }

  const t = q.toLowerCase()
  const intents: Intent[] = []

  // ── Sales intents ──
  if (/last(est)?\s+sale|latest\s+sale|last\s+transaction|last\s+sell|last\s+sold|recent(ly)?\s+(sell|sold)|last\s+order/.test(t)) intents.push('latest_sale')
  if (/recent\s+sales?|show\s+(my\s+)?sales|list\s+sales/.test(t) && !intents.includes('latest_sale')) intents.push('recent_sales')
  if (/\btoday\b.*(sale|sell|sold|revenue|transaction)|(sale|sell|sold|revenue|transaction).*\btoday\b/.test(t)) intents.push('sales_today')
  if (/yesterday.*(sale|sell|sold)|(sale|sell|sold).*yesterday/.test(t)) intents.push('sales_yesterday')
  if (/(this\s+)?week.*(sale|sell|sold)|(sale|sell|sold).*(this\s+)?week/.test(t)) intents.push('sales_week')
  if (/(this\s+)?month.*(sale|sell|sold|revenue|made|earn)|(sale|sell|sold|revenue|made|earn).*(this\s+)?month/.test(t)) intents.push('sales_month')
  if (/last\s+month.*(sale|sell|sold|revenue)|(sale|sell|sold|revenue).*last\s+month/.test(t)) intents.push('sales_lastmonth')
  if (/compare|vs\.?|versus|compared\s+to|month.over.month|growth/.test(t) && /sale|revenue/.test(t)) intents.push('sales_compare')

  // ── Stock / inventory ──
  if (/last(est)?\s+stock\s+(add|receiv)|stock\s+(i\s+)?add|last\s+restock|recently\s+(added|restocked)/.test(t)) intents.push('latest_stock')
  if (/current\s+inventory|total\s+(stock|inventory|products?)|inventory\s+(status|summary|overview)|how\s+many\s+products?/.test(t)) intents.push('inventory_summary')
  if (/low\s*([-\s])?stock|running\s+(low|out)|almost\s+out|nearly\s+empty/.test(t)) intents.push('low_stock')
  if (/out\s+of\s+stock|finish(ed)?|zero\s+stock|no\s+stock|empty\s+stock|products?\s+(that\s+are\s+)?finish/.test(t)) intents.push('out_of_stock')
  if (/top\s+(selling|sell|products?)|best\s+(selling|sell|products?)|most\s+(popular|sold)|highest\s+sales/.test(t)) intents.push('top_products')
  if (/restock|reorder|should\s+(i\s+)?buy|need\s+to\s+order|which\s+products?\s+(need|should)/.test(t)) intents.push('restock')

  // ── Expenses ──
  if (/last(est)?\s+expense|latest\s+expense/.test(t)) intents.push('latest_expense')
  if (/expense.*today|today.*expense|spent.*today/.test(t)) intents.push('expense_today')
  if (/expense.*(this\s+)?week|(this\s+)?week.*expense|spent.*(this\s+)?week/.test(t)) intents.push('expense_week')
  if (/expense.*(this\s+)?month|(this\s+)?month.*expense|spent.*(this\s+)?month|cost.*month/.test(t)) intents.push('expense_month')

  // ── Profit ──
  if (/profit.*today|today.*profit|made.*today|earn.*today/.test(t)) intents.push('profit_today')
  if (/profit.*(this\s+)?week|(this\s+)?week.*profit/.test(t)) intents.push('profit_week')
  if (/profit.*(this\s+)?month|(this\s+)?month.*profit|how\s+(much|is).*profit|earn.*(this\s+)?month|made.*(this\s+)?month/.test(t)) intents.push('profit_month')
  if (/profit.*last\s+month|last\s+month.*profit/.test(t)) intents.push('profit_lastmonth')

  // ── Cash flow ──
  if (/cash\s*([-\s])?flow|receivable|payable|pending\s+payment|cash\s+position/.test(t)) intents.push('cashflow')

  // ── Alerts ──
  if (/alert|warning|critical|notification|what\s+(alerts|warnings)/.test(t)) intents.push('alerts')

  // ── Business health ──
  if (/how\s+(is|are).*business|business\s+(doing|health|performance|status)|health\s+score|overall|overview|summary/.test(t)) intents.push('business_health')

  // ── Top products (standalone) ──
  if (/what\s+product|which\s+product|product.*attention|needs?\s+attention/.test(t) && !intents.includes('top_products') && !intents.includes('restock') && !intents.includes('low_stock')) {
    intents.push('top_products')
    intents.push('low_stock')
  }

  // ── Fallback for unrecognised questions that DO contain business signals ──
  // (keeps existing behavior for ambiguous SBMS questions)
  if (intents.length === 0) {
    intents.push('business_health')
  }

  // Deduplicate
  return [...new Set(intents)]
}

// ─── Product name extraction ──────────────────────────────────────────────────

function extractProductName(q: string): string | null {
  const match = q.match(/(?:stock|price|quantity|details?|about|for|of)\s+[""']?([A-Za-z0-9\s\-]+)[""']?/i)
  if (match) return match[1].trim()
  return null
}

// ─── Context building ─────────────────────────────────────────────────────────

export interface BusinessContext {
  summary: BusinessSummary
  health: HealthScore
  trend: MonthlyPoint[]
  topProducts: TopProduct[]
}

async function fetchLiveData(intents: Intent[], question: string): Promise<Record<string, unknown>> {
  const data: Record<string, unknown> = {}
  const fetches: Promise<void>[] = []

  const add = (key: string, fn: () => Promise<unknown>) =>
    fetches.push(fn().then(v => { data[key] = v }).catch(err => {
      console.error(`[Profit Pulse AI] Failed fetching ${key}:`, err)
      data[key] = { error: 'data unavailable' }
    }))

  // ── Map intents to fetchers ──

  if (intents.includes('latest_sale'))      add('latestSale',      () => getLatestSale())
  if (intents.includes('recent_sales'))     add('recentSales',     () => getRecentSales(5))
  if (intents.includes('sales_today'))      add('salesToday',      () => getSalesByPeriod('today'))
  if (intents.includes('sales_yesterday'))  add('salesYesterday',  () => getSalesByPeriod('yesterday'))
  if (intents.includes('sales_week'))       add('salesWeek',       () => getSalesByPeriod('week'))
  if (intents.includes('sales_month'))      add('salesMonth',      () => getSalesByPeriod('month'))
  if (intents.includes('sales_lastmonth'))  add('salesLastMonth',  () => getSalesByPeriod('lastMonth'))
  if (intents.includes('sales_compare'))    add('salesComparison', () => compareMonthlySales())

  if (intents.includes('latest_stock'))     add('latestStockAddition', () => getLatestStockAddition())
  if (intents.includes('inventory_summary'))add('inventorySummary',    () => getInventorySummary())
  if (intents.includes('low_stock'))        add('inventorySummary',    () => getInventorySummary())
  if (intents.includes('out_of_stock'))     add('inventorySummary',    () => getInventorySummary())
  if (intents.includes('top_products'))     add('topSellingWithStock',  () => getTopSellingWithStock(8))
  if (intents.includes('restock'))          add('restockSuggestions',   () => getRestockSuggestions())

  if (intents.includes('latest_expense'))   add('latestExpense',   () => getLatestExpense())
  if (intents.includes('expense_today'))    add('expensesToday',   () => getExpensesByPeriod('today'))
  if (intents.includes('expense_week'))     add('expensesWeek',    () => getExpensesByPeriod('week'))
  if (intents.includes('expense_month'))    add('expensesMonth',   () => getExpensesByPeriod('month'))

  if (intents.includes('profit_today'))     add('profitToday',     () => getProfitByPeriod('today'))
  if (intents.includes('profit_week'))      add('profitWeek',      () => getProfitByPeriod('week'))
  if (intents.includes('profit_month'))     add('profitMonth',     () => getProfitByPeriod('month'))
  if (intents.includes('profit_lastmonth')) add('profitLastMonth', () => getProfitByPeriod('lastMonth'))

  if (intents.includes('cashflow'))         add('cashFlow',        () => getCashFlowSummary())
  if (intents.includes('alerts'))           add('activeAlerts',    () => getActiveAlerts())

  // business_health relies on aggregate context passed in — no extra fetch needed

  // Product lookup: try to extract product name from question
  if (intents.includes('inventory_summary') || /stock of|price of|details? of|about/.test(question.toLowerCase())) {
    const pName = extractProductName(question)
    if (pName) add('productSearch', () => findProduct(pName))
  }

  await Promise.all(fetches)
  return data
}

function buildUserMessage(
  question: string,
  ctx: BusinessContext,
  liveData: Record<string, unknown>,
  isGeneral: boolean
): string {
  // ── Pure general question: just pass the question, no business data ──
  if (isGeneral) {
    return question
  }

  // ── SBMS / mixed question: include aggregate summary + live records ──
  const curr = ctx.trend.at(-1)
  const prev = ctx.trend.at(-2)
  const trendSummary = curr && prev
    ? `Last month: Revenue ₹${prev.revenue.toLocaleString()}, Profit ₹${prev.profit.toLocaleString()} | This month: Revenue ₹${curr.revenue.toLocaleString()}, Profit ₹${curr.profit.toLocaleString()}`
    : curr
    ? `This month: Revenue ₹${curr.revenue.toLocaleString()}, Profit ₹${curr.profit.toLocaleString()}`
    : 'No trend data'

  const topList = ctx.topProducts.length
    ? ctx.topProducts.map(p => `${p.name} (₹${p.revenue.toLocaleString()}, qty: ${p.quantity})`).join('; ')
    : 'No data'

  const aggregateBlock = `
AGGREGATE BUSINESS SUMMARY (all-time / current period):
- Revenue: ₹${ctx.summary.revenue.toLocaleString()}
- Expenses: ₹${ctx.summary.expenses.toLocaleString()}
- Profit: ₹${ctx.summary.profit.toLocaleString()}
- Profit Margin: ${ctx.summary.profitMargin}%
- Loss: ₹${ctx.summary.loss.toLocaleString()}
- Dead Stock Value: ₹${ctx.summary.deadStockValue.toLocaleString()}
- Low Stock Items: ${ctx.summary.lowStockCount}
- Business Health Score: ${ctx.health.score}/100 (${ctx.health.status})
- Profit Trend: ${trendSummary}
- Top Selling Products: ${topList}`.trim()

  const liveBlock = Object.keys(liveData).length > 0
    ? `\nLIVE DATABASE RECORDS:\n${JSON.stringify(liveData, null, 2)}`
    : ''

  return `${aggregateBlock}${liveBlock}\n\nUser Question: ${question}`
}

// ─── Main export ──────────────────────────────────────────────────────────────

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'

export async function generateAIResponse(question: string, ctx: BusinessContext): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY
  const model  = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'

  if (!apiKey) {
    console.error('[Profit Pulse AI] GROQ_API_KEY is not set.')
    return 'AI service is not configured. Please contact the administrator.'
  }

  // ── Step 1: Detect intents & question type ──
  const intents  = detectIntents(question)
  const isGeneral = intents.length === 1 && intents[0] === 'general_knowledge'
  console.log(`[Profit Pulse AI] Question: "${question}" | Intents: ${intents.join(', ')} | Type: ${isGeneral ? 'GENERAL' : 'SBMS/MIXED'}`)

  // ── Step 2: Fetch live data only for SBMS/mixed questions ──
  let liveData: Record<string, unknown> = {}
  if (!isGeneral) {
    try {
      liveData = await fetchLiveData(intents, question)
      console.log(`[Profit Pulse AI] Live data keys fetched: ${Object.keys(liveData).join(', ') || 'none'}`)
    } catch (err) {
      console.error('[Profit Pulse AI] Live data fetch error:', err)
      // For SBMS questions, warn if data unavailable — but still let the AI try with aggregate context
    }
  } else {
    console.log(`[Profit Pulse AI] Skipping DB fetch for general knowledge question.`)
  }

  // ── Step 3: Build message ──
  const userMessage = buildUserMessage(question, ctx, liveData, isGeneral)

  // ── Step 4: Call Groq ──
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
          { role: 'user',   content: userMessage },
        ],
        max_tokens: isGeneral ? 800 : 500,   // allow longer responses for general answers
        temperature: isGeneral ? 0.7 : 0.3,  // more creative for general, more factual for SBMS
      }),
      signal: AbortSignal.timeout(30_000),
    })
  } catch (err: unknown) {
    const isTimeout = err instanceof Error && err.name === 'TimeoutError'
    if (isTimeout) {
      console.error('[Profit Pulse AI] Groq request timed out.')
      return 'AI service timed out. Please try again in a moment.'
    }
    console.error('[Profit Pulse AI] Network error reaching Groq:', err instanceof Error ? err.message : err)
    // For SBMS questions, the error message is different from general ones
    return isGeneral
      ? 'AI service is currently unavailable. Please try again.'
      : "I couldn't retrieve the latest SBMS data right now. Please try again."
  }

  if (response.status === 401) {
    console.error('[Profit Pulse AI] Groq returned 401. Check GROQ_API_KEY.')
    return 'AI service authentication failed. Please contact the administrator.'
  }
  if (response.status === 404) {
    console.error(`[Profit Pulse AI] Groq model "${model}" not found (404).`)
    return 'AI model is not available. Please contact the administrator.'
  }
  if (response.status === 429) {
    console.error('[Profit Pulse AI] Groq rate limit exceeded.')
    return 'AI service is busy. Please wait a moment and try again.'
  }
  if (!response.ok) {
    const body = await response.text().catch(() => '')
    console.error(`[Profit Pulse AI] Groq returned HTTP ${response.status}:`, body)
    return 'AI service is currently unavailable. Please try again.'
  }

  // ── Step 5: Parse response ──
  let data: unknown
  try {
    data = await response.json()
  } catch {
    console.error('[Profit Pulse AI] Failed to parse Groq JSON response.')
    return 'AI service returned an unexpected response. Please try again.'
  }

  if (
    typeof data === 'object' && data !== null &&
    'choices' in data &&
    Array.isArray((data as { choices: unknown[] }).choices) &&
    (data as { choices: unknown[] }).choices.length > 0
  ) {
    const content = (data as { choices: { message?: { content?: unknown } }[] }).choices[0]?.message?.content
    if (typeof content === 'string' && content.trim()) {
      console.log(`[Profit Pulse AI] Response generated successfully.`)
      return content.trim()
    }
  }

  console.error('[Profit Pulse AI] Unexpected Groq response structure:', JSON.stringify(data))
  return 'I could not generate a response. Please try again.'
}
