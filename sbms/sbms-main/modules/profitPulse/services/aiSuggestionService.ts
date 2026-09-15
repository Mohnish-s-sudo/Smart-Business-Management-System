import { getBusinessSummary } from './profitAnalysisService'
import { getMonthlyReport, getDeadStock, getLowStock, getTopSellingProducts } from '@/services/profitPulseService'

export interface Suggestion {
  priority: 'high' | 'medium' | 'low'
  category: string
  action: string
  reason: string
}

export async function generateSuggestions(): Promise<Suggestion[]> {
  const [summary, monthly, deadStock, lowStock, topProducts] = await Promise.all([
    getBusinessSummary(),
    getMonthlyReport(2),
    getDeadStock(),
    getLowStock(),
    getTopSellingProducts(3)
  ])

  const suggestions: Suggestion[] = []

  // Fast selling — ensure stock
  topProducts.forEach(p => {
    suggestions.push({ priority: 'high', category: 'Inventory', action: `Increase stock for "${p.name}"`, reason: `Top seller with ₹${p.revenue.toLocaleString()} revenue. Running out will cause lost sales.` })
  })

  // Dead stock — discount
  if (deadStock.length > 0) {
    suggestions.push({ priority: 'high', category: 'Sales', action: `Run discount offers on ${deadStock.length} dead stock items`, reason: `₹${summary.deadStockValue.toLocaleString()} is locked in unsold inventory for 90+ days. Recover cash flow.` })
    suggestions.push({ priority: 'medium', category: 'Purchasing', action: 'Stop reordering slow-moving products', reason: 'Reduce purchase of items that are not selling to prevent further dead stock accumulation.' })
  }

  // Low margin — increase price
  if (summary.profitMargin < 15) {
    suggestions.push({ priority: 'high', category: 'Pricing', action: 'Review and increase prices for low-margin products', reason: `Current profit margin is ${summary.profitMargin}%. Target minimum 20% margin per product.` })
  }

  // Expense control
  if (monthly.length >= 2) {
    const [prev, curr] = monthly.slice(-2)
    if (curr.expenses > prev.expenses * 1.1) {
      suggestions.push({ priority: 'high', category: 'Expenses', action: 'Audit and reduce unnecessary expenses', reason: `Expenses rose ${Math.round(((curr.expenses - prev.expenses) / prev.expenses) * 100)}% this month. Identify non-essential costs.` })
    }
  }

  // Focus on top sellers
  if (topProducts.length > 0) {
    suggestions.push({ priority: 'medium', category: 'Strategy', action: `Focus marketing on top ${topProducts.length} selling products`, reason: 'Amplify what is already working to maximize revenue with minimal effort.' })
  }

  // Overstock
  if (summary.deadStockValue > 5000) {
    suggestions.push({ priority: 'medium', category: 'Inventory', action: 'Implement FIFO inventory management', reason: 'First-In-First-Out reduces dead stock and improves inventory turnover ratio.' })
  }

  // Low stock reorder
  const criticalLow = lowStock.filter(p => p.stockQuantity === 0)
  if (criticalLow.length > 0) {
    suggestions.push({ priority: 'high', category: 'Inventory', action: `Immediately reorder ${criticalLow.length} out-of-stock items`, reason: 'Out-of-stock products are causing direct revenue loss right now.' })
  }

  return suggestions
}
