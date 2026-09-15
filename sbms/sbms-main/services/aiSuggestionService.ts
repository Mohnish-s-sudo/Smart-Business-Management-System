import { getProfitSummary, getLowStock, getDeadStock, getMonthlyReport } from './profitPulseService'

export interface AISuggestion {
  type: 'warning' | 'info' | 'success' | 'critical'
  title: string
  message: string
}

export async function generateSuggestions(): Promise<AISuggestion[]> {
  const [summary, lowStock, deadStock, monthly] = await Promise.all([
    getProfitSummary(),
    getLowStock(),
    getDeadStock(),
    getMonthlyReport(2)
  ])

  const suggestions: AISuggestion[] = []
  const marginPct = summary.totalRevenue > 0 ? (summary.totalProfit / summary.totalRevenue) * 100 : 0

  // Profit margin
  if (marginPct < 10) {
    suggestions.push({ type: 'critical', title: 'Critical: Low Profit Margin', message: `Profit margin is only ${marginPct.toFixed(1)}%. Review pricing and cut unnecessary expenses immediately.` })
  } else if (marginPct < 20) {
    suggestions.push({ type: 'warning', title: 'Low Profit Margin Warning', message: `Profit margin is ${marginPct.toFixed(1)}%. Consider increasing prices or reducing costs to improve profitability.` })
  } else {
    suggestions.push({ type: 'success', title: 'Healthy Profit Margin', message: `Profit margin is ${marginPct.toFixed(1)}%. Business is performing well. Keep monitoring expenses.` })
  }

  // Damaged stock
  if (summary.damagedStockValue > 0) {
    suggestions.push({ type: 'warning', title: 'Damaged Stock Loss Detected', message: `₹${summary.damagedStockValue.toLocaleString()} lost to damaged goods. Improve storage conditions and handling procedures.` })
  }

  // Dead stock
  if (deadStock.length > 0) {
    const topDead = deadStock.slice(0, 3).map(d => d.name).join(', ')
    suggestions.push({ type: 'warning', title: 'Dead Stock Detected', message: `${deadStock.length} products haven't sold in 90+ days (${topDead}). Consider discounts or bundle offers to clear inventory.` })
  }

  // Low stock
  if (lowStock.length > 0) {
    const critical = lowStock.filter(p => p.stockQuantity === 0)
    if (critical.length > 0) {
      suggestions.push({ type: 'critical', title: 'Out of Stock Alert', message: `${critical.length} products are completely out of stock. Reorder immediately to avoid lost sales.` })
    }
    const low = lowStock.filter(p => p.stockQuantity > 0)
    if (low.length > 0) {
      suggestions.push({ type: 'warning', title: 'Reorder Low Stock Items', message: `${low.length} products are below reorder threshold. Place purchase orders soon.` })
    }
  }

  // Expense trend
  if (monthly.length >= 2) {
    const [prev, curr] = monthly.slice(-2)
    if (curr.expenses > prev.expenses * 1.2) {
      suggestions.push({ type: 'warning', title: 'High Expense Spike Detected', message: `Expenses increased by ${Math.round(((curr.expenses - prev.expenses) / prev.expenses) * 100)}% this month vs last month. Review spending categories.` })
    }
    if (curr.revenue < prev.revenue * 0.8) {
      suggestions.push({ type: 'critical', title: 'Revenue Drop Alert', message: `Revenue dropped by ${Math.round(((prev.revenue - curr.revenue) / prev.revenue) * 100)}% compared to last month. Investigate sales performance.` })
    }
  }

  // Top products
  if (summary.topProducts.length > 0) {
    const top = summary.topProducts[0]
    suggestions.push({ type: 'info', title: 'Top Performer', message: `"${top.name}" is your best seller with ₹${top.revenue.toLocaleString()} revenue. Ensure adequate stock levels.` })
  }

  // Overstock warning (dead stock value > 20% of total inventory value)
  if (summary.deadStockValue > summary.totalRevenue * 0.15) {
    suggestions.push({ type: 'warning', title: 'Overstock Warning', message: `Dead stock value (₹${summary.deadStockValue.toLocaleString()}) is significant. Reduce purchase orders for slow-moving items.` })
  }

  return suggestions
}
