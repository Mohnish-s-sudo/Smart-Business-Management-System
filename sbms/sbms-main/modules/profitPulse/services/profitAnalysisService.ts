import {
  calculateRevenue, calculateExpenses, getDamagedStockValue,
  getDeadStockValue, getLowStock, getTopSellingProducts, getMonthlyReport
} from '@/services/profitPulseService'

export interface BusinessSummary {
  revenue: number
  expenses: number
  profit: number
  loss: number
  profitMargin: number
  damagedStockValue: number
  deadStockValue: number
  lowStockCount: number
}

export interface HealthScore {
  score: number
  status: 'Excellent' | 'Good' | 'Average' | 'Poor' | 'Critical'
  breakdown: { label: string; score: number; max: number }[]
}

export async function getBusinessSummary(): Promise<BusinessSummary> {
  const [revenue, expenses, damagedStockValue, deadStockValue, lowStock] = await Promise.all([
    calculateRevenue(), calculateExpenses(), getDamagedStockValue(), getDeadStockValue(), getLowStock()
  ])
  const profit = revenue - expenses - damagedStockValue
  const loss = damagedStockValue + deadStockValue
  const profitMargin = revenue > 0 ? (profit / revenue) * 100 : 0
  return {
    revenue: Math.round(revenue),
    expenses: Math.round(expenses),
    profit: Math.round(profit),
    loss: Math.round(loss),
    profitMargin: Math.round(profitMargin * 10) / 10,
    damagedStockValue: Math.round(damagedStockValue),
    deadStockValue: Math.round(deadStockValue),
    lowStockCount: lowStock.length
  }
}

export async function calculateBusinessHealthScore(): Promise<HealthScore> {
  const [summary, monthly] = await Promise.all([getBusinessSummary(), getMonthlyReport(2)])

  // 1. Profit margin score (0–30)
  const marginScore = Math.min(30, Math.max(0, summary.profitMargin * 1.5))

  // 2. Expense ratio score (0–25): lower expense/revenue ratio = better
  const expRatio = summary.revenue > 0 ? summary.expenses / summary.revenue : 1
  const expScore = Math.max(0, 25 - expRatio * 25)

  // 3. Dead stock penalty (0–20)
  const deadRatio = summary.revenue > 0 ? summary.deadStockValue / summary.revenue : 0
  const deadScore = Math.max(0, 20 - deadRatio * 40)

  // 4. Loss ratio score (0–15)
  const lossRatio = summary.revenue > 0 ? summary.loss / summary.revenue : 0
  const lossScore = Math.max(0, 15 - lossRatio * 30)

  // 5. Sales growth score (0–10)
  let growthScore = 5
  if (monthly.length >= 2) {
    const [prev, curr] = monthly.slice(-2)
    if (prev.revenue > 0) {
      const growth = (curr.revenue - prev.revenue) / prev.revenue
      growthScore = Math.min(10, Math.max(0, 5 + growth * 20))
    }
  }

  const total = Math.round(marginScore + expScore + deadScore + lossScore + growthScore)
  const status: HealthScore['status'] =
    total >= 80 ? 'Excellent' :
    total >= 65 ? 'Good' :
    total >= 45 ? 'Average' :
    total >= 25 ? 'Poor' : 'Critical'

  return {
    score: total,
    status,
    breakdown: [
      { label: 'Profit Margin', score: Math.round(marginScore), max: 30 },
      { label: 'Expense Control', score: Math.round(expScore), max: 25 },
      { label: 'Dead Stock', score: Math.round(deadScore), max: 20 },
      { label: 'Loss Control', score: Math.round(lossScore), max: 15 },
      { label: 'Sales Growth', score: Math.round(growthScore), max: 10 },
    ]
  }
}

export { getTopSellingProducts, getMonthlyReport }
