import { getBusinessSummary } from './profitAnalysisService'
import { getMonthlyReport, getDeadStock, getLowStock } from '@/services/profitPulseService'

export interface AIInsight {
  icon: string
  type: 'positive' | 'negative' | 'neutral' | 'alert'
  text: string
}

export async function generateInsights(): Promise<AIInsight[]> {
  const [summary, monthly, deadStock, lowStock] = await Promise.all([
    getBusinessSummary(),
    getMonthlyReport(3),
    getDeadStock(),
    getLowStock()
  ])

  const insights: AIInsight[] = []

  // Profit trend
  if (monthly.length >= 2) {
    const [prev, curr] = monthly.slice(-2)
    if (curr.profit > prev.profit) {
      insights.push({ icon: '📈', type: 'positive', text: `Profit increased by ₹${(curr.profit - prev.profit).toLocaleString()} compared to last month. Business is growing.` })
    } else if (curr.profit < prev.profit) {
      insights.push({ icon: '📉', type: 'negative', text: `Profit decreased by ₹${(prev.profit - curr.profit).toLocaleString()} compared to last month. Review expenses and sales.` })
    }

    // Expense trend
    if (curr.expenses > prev.expenses * 1.15) {
      insights.push({ icon: '💸', type: 'alert', text: `Expenses increased by ${Math.round(((curr.expenses - prev.expenses) / prev.expenses) * 100)}% this month. Identify and reduce unnecessary costs.` })
    }

    // Revenue trend
    if (curr.revenue > prev.revenue * 1.1) {
      insights.push({ icon: '🚀', type: 'positive', text: `Revenue grew by ${Math.round(((curr.revenue - prev.revenue) / prev.revenue) * 100)}% this month. Sales momentum is strong.` })
    } else if (curr.revenue < prev.revenue * 0.9) {
      insights.push({ icon: '⚠️', type: 'negative', text: `Revenue dropped by ${Math.round(((prev.revenue - curr.revenue) / prev.revenue) * 100)}% this month. Investigate sales performance.` })
    }
  }

  // Dead stock
  if (deadStock.length > 0) {
    insights.push({ icon: '📦', type: 'alert', text: `${deadStock.length} products have not sold in 90+ days. Dead stock value: ₹${summary.deadStockValue.toLocaleString()}. Consider clearance sales.` })
  }

  // Inventory mismatch / damage
  if (summary.damagedStockValue > 0) {
    insights.push({ icon: '🔴', type: 'negative', text: `Inventory loss of ₹${summary.damagedStockValue.toLocaleString()} detected from damaged goods. Improve storage and handling.` })
  }

  // Low stock
  const outOfStock = lowStock.filter(p => p.stockQuantity === 0)
  if (outOfStock.length > 0) {
    insights.push({ icon: '🚨', type: 'alert', text: `${outOfStock.length} products are completely out of stock. This is causing missed sales opportunities.` })
  }

  // Profit margin
  if (summary.profitMargin < 10) {
    insights.push({ icon: '⚡', type: 'alert', text: `Profit margin is critically low at ${summary.profitMargin}%. Immediate action required on pricing and cost reduction.` })
  } else if (summary.profitMargin > 30) {
    insights.push({ icon: '✅', type: 'positive', text: `Excellent profit margin of ${summary.profitMargin}%. Business is highly profitable. Consider reinvesting in growth.` })
  }

  // Loss analysis
  if (summary.loss > summary.revenue * 0.1) {
    insights.push({ icon: '📊', type: 'negative', text: `Total loss (₹${summary.loss.toLocaleString()}) exceeds 10% of revenue. Loss is primarily from damaged and dead stock.` })
  }

  if (insights.length === 0) {
    insights.push({ icon: '✅', type: 'positive', text: 'Business data looks healthy. Keep monitoring regularly for early detection of issues.' })
  }

  return insights
}
