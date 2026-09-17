/**
 * liveDataService.ts
 *
 * Fetches granular, record-level live data from MongoDB for Profit Pulse AI.
 * All functions return plain serialisable objects (no Mongoose Documents).
 * Each function is efficient — it queries only what it needs with sorting/limits.
 */

import { connectDB } from '@/lib/mongodb'
import Sale from '@/lib/models/Sale'
import Product from '@/lib/models/Product'
import Expense from '@/lib/models/Expense'
import StockTransaction from '@/lib/models/StockTransaction'
import Alert from '@/lib/models/Alert'
import Cashflow from '@/lib/models/Cashflow'

// ─── Utility ─────────────────────────────────────────────────────────────────

function dateRange(period: 'today' | 'yesterday' | 'week' | 'month' | 'lastMonth' | 'year'): { from: Date; to: Date } {
  const now = new Date()
  const y = now.getFullYear(), m = now.getMonth(), d = now.getDate()
  switch (period) {
    case 'today':
      return { from: new Date(y, m, d, 0, 0, 0), to: new Date(y, m, d, 23, 59, 59, 999) }
    case 'yesterday':
      return { from: new Date(y, m, d - 1, 0, 0, 0), to: new Date(y, m, d - 1, 23, 59, 59, 999) }
    case 'week': {
      const dayOfWeek = now.getDay()
      const monday = new Date(y, m, d - ((dayOfWeek + 6) % 7), 0, 0, 0)
      return { from: monday, to: now }
    }
    case 'month':
      return { from: new Date(y, m, 1, 0, 0, 0), to: new Date(y, m + 1, 0, 23, 59, 59, 999) }
    case 'lastMonth':
      return { from: new Date(y, m - 1, 1, 0, 0, 0), to: new Date(y, m, 0, 23, 59, 59, 999) }
    case 'year':
      return { from: new Date(y, 0, 1, 0, 0, 0), to: new Date(y, 11, 31, 23, 59, 59, 999) }
  }
}

function fmtDate(d: Date | string | undefined): string {
  if (!d) return 'unknown date'
  const dt = d instanceof Date ? d : new Date(d)
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' at ' + dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
}

// ─── Sales ────────────────────────────────────────────────────────────────────

export interface LatestSaleResult {
  found: boolean
  transactionRef?: string
  saleDate?: string
  paymentMethod?: string
  totalAmount?: number
  items?: { productName: string; quantity: number; unitPrice: number }[]
  notes?: string
}

export async function getLatestSale(): Promise<LatestSaleResult> {
  await connectDB()
  const sale = await Sale.findOne().sort({ saleDate: -1 }).limit(1).lean()
  if (!sale) return { found: false }
  return {
    found: true,
    transactionRef: sale.transactionRef,
    saleDate: fmtDate(sale.saleDate),
    paymentMethod: sale.paymentMethod,
    totalAmount: sale.totalAmount,
    items: sale.items?.map((i: { productName: string; quantity: number; unitPrice: number }) => ({
      productName: i.productName,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
    })) ?? [],
    notes: sale.notes ?? undefined,
  }
}

export interface RecentSalesResult {
  found: boolean
  count: number
  sales: {
    transactionRef: string
    saleDate: string
    totalAmount: number
    paymentMethod: string
    itemSummary: string
  }[]
}

export async function getRecentSales(limit = 5): Promise<RecentSalesResult> {
  await connectDB()
  const sales = await Sale.find().sort({ saleDate: -1 }).limit(limit).lean()
  if (!sales.length) return { found: false, count: 0, sales: [] }
  return {
    found: true,
    count: sales.length,
    sales: sales.map(s => ({
      transactionRef: s.transactionRef,
      saleDate: fmtDate(s.saleDate),
      totalAmount: s.totalAmount,
      paymentMethod: s.paymentMethod,
      itemSummary: s.items?.map((i: { productName: string; quantity: number }) => `${i.productName} ×${i.quantity}`).join(', ') ?? '',
    })),
  }
}

export interface SalesPeriodResult {
  period: string
  totalRevenue: number
  totalTransactions: number
  averageOrderValue: number
  topItems: { productName: string; quantity: number; revenue: number }[]
}

export async function getSalesByPeriod(period: 'today' | 'yesterday' | 'week' | 'month' | 'lastMonth'): Promise<SalesPeriodResult> {
  await connectDB()
  const { from, to } = dateRange(period)
  const sales = await Sale.find({ saleDate: { $gte: from, $lte: to } }).lean()

  const totalRevenue = sales.reduce((s, r) => s + r.totalAmount, 0)
  const totalTransactions = sales.length

  // Aggregate item-level data
  const itemMap: Record<string, { quantity: number; revenue: number }> = {}
  for (const sale of sales) {
    for (const item of (sale.items ?? [])) {
      if (!itemMap[item.productName]) itemMap[item.productName] = { quantity: 0, revenue: 0 }
      itemMap[item.productName].quantity += item.quantity
      itemMap[item.productName].revenue += item.unitPrice * item.quantity
    }
  }
  const topItems = Object.entries(itemMap)
    .map(([productName, v]) => ({ productName, ...v }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5)

  const periodLabels: Record<string, string> = {
    today: 'today', yesterday: 'yesterday', week: 'this week',
    month: 'this month', lastMonth: 'last month',
  }

  return {
    period: periodLabels[period],
    totalRevenue: Math.round(totalRevenue),
    totalTransactions,
    averageOrderValue: totalTransactions > 0 ? Math.round(totalRevenue / totalTransactions) : 0,
    topItems,
  }
}

export interface MonthlySalesComparison {
  thisMonth: { revenue: number; transactions: number }
  lastMonth: { revenue: number; transactions: number }
  changePercent: number
  trend: 'up' | 'down' | 'flat'
}

export async function compareMonthlySales(): Promise<MonthlySalesComparison> {
  await connectDB()
  const { from: f1, to: t1 } = dateRange('month')
  const { from: f2, to: t2 } = dateRange('lastMonth')
  const [curr, prev] = await Promise.all([
    Sale.aggregate([{ $match: { saleDate: { $gte: f1, $lte: t1 } } }, { $group: { _id: null, rev: { $sum: '$totalAmount' }, cnt: { $sum: 1 } } }]),
    Sale.aggregate([{ $match: { saleDate: { $gte: f2, $lte: t2 } } }, { $group: { _id: null, rev: { $sum: '$totalAmount' }, cnt: { $sum: 1 } } }]),
  ])
  const thisRev = Math.round(curr[0]?.rev ?? 0)
  const prevRev = Math.round(prev[0]?.rev ?? 0)
  const change = prevRev > 0 ? ((thisRev - prevRev) / prevRev) * 100 : 0
  return {
    thisMonth: { revenue: thisRev, transactions: curr[0]?.cnt ?? 0 },
    lastMonth: { revenue: prevRev, transactions: prev[0]?.cnt ?? 0 },
    changePercent: Math.round(change * 10) / 10,
    trend: change > 1 ? 'up' : change < -1 ? 'down' : 'flat',
  }
}

// ─── Inventory / Stock ────────────────────────────────────────────────────────

export interface LatestStockAdditionResult {
  found: boolean
  productName?: string
  quantity?: number
  note?: string
  addedOn?: string
}

export async function getLatestStockAddition(): Promise<LatestStockAdditionResult> {
  await connectDB()
  const tx = await StockTransaction.findOne({ type: 'add' })
    .sort({ createdAt: -1 })
    .populate('productId', 'name')
    .limit(1)
    .lean()
  if (!tx) return { found: false }
  const productName = (tx.productId as unknown as { name?: string })?.name ?? 'Unknown product'
  return {
    found: true,
    productName,
    quantity: tx.quantity ?? 0,
    note: tx.note ?? undefined,
    addedOn: fmtDate(tx.createdAt as Date | undefined),
  }
}

export interface InventorySummaryResult {
  totalProducts: number
  totalStockUnits: number
  outOfStockCount: number
  lowStockCount: number
  outOfStockProducts: { name: string; category: string }[]
  lowStockProducts: { name: string; stockQuantity: number; reorderThreshold: number }[]
}

export async function getInventorySummary(): Promise<InventorySummaryResult> {
  await connectDB()
  const products = await Product.find({ isActive: true }, 'name category stockQuantity reorderThreshold').lean()
  const outOfStock = products.filter(p => p.stockQuantity === 0)
  const lowStock = products.filter(p => p.stockQuantity > 0 && p.stockQuantity <= p.reorderThreshold)
  return {
    totalProducts: products.length,
    totalStockUnits: products.reduce((s, p) => s + p.stockQuantity, 0),
    outOfStockCount: outOfStock.length,
    lowStockCount: lowStock.length,
    outOfStockProducts: outOfStock.slice(0, 10).map(p => ({ name: p.name, category: p.category })),
    lowStockProducts: lowStock.slice(0, 10).map(p => ({ name: p.name, stockQuantity: p.stockQuantity, reorderThreshold: p.reorderThreshold })),
  }
}

export interface TopSellingWithStockResult {
  name: string
  revenue: number
  quantity: number
  currentStock: number
  isLowStock: boolean
  isOutOfStock: boolean
}

export async function getTopSellingWithStock(limit = 8): Promise<TopSellingWithStockResult[]> {
  await connectDB()
  const top = await Sale.aggregate([
    { $unwind: '$items' },
    { $group: { _id: '$items.productId', name: { $first: '$items.productName' }, revenue: { $sum: { $multiply: ['$items.unitPrice', '$items.quantity'] } }, quantity: { $sum: '$items.quantity' } } },
    { $sort: { revenue: -1 } },
    { $limit: limit },
  ])

  const results: TopSellingWithStockResult[] = []
  for (const item of top) {
    const product = await Product.findById(item._id, 'stockQuantity reorderThreshold').lean()
    const stock = product?.stockQuantity ?? 0
    const threshold = product?.reorderThreshold ?? 10
    results.push({
      name: item.name,
      revenue: Math.round(item.revenue),
      quantity: item.quantity,
      currentStock: stock,
      isLowStock: stock > 0 && stock <= threshold,
      isOutOfStock: stock === 0,
    })
  }
  return results
}

export interface RestockSuggestion {
  name: string
  currentStock: number
  reorderThreshold: number
  reason: string
  priority: 'critical' | 'high' | 'medium'
}

export async function getRestockSuggestions(): Promise<RestockSuggestion[]> {
  await connectDB()
  const products = await Product.find({ isActive: true }, 'name stockQuantity reorderThreshold').lean()
  const out = products.filter(p => p.stockQuantity === 0).map(p => ({
    name: p.name, currentStock: 0, reorderThreshold: p.reorderThreshold,
    reason: 'Out of stock — cannot sell', priority: 'critical' as const,
  }))
  const low = products.filter(p => p.stockQuantity > 0 && p.stockQuantity <= p.reorderThreshold).map(p => ({
    name: p.name, currentStock: p.stockQuantity, reorderThreshold: p.reorderThreshold,
    reason: `Only ${p.stockQuantity} units left (threshold: ${p.reorderThreshold})`, priority: 'high' as const,
  }))
  return [...out, ...low].slice(0, 12)
}

// ─── Expenses ─────────────────────────────────────────────────────────────────

export interface LatestExpenseResult {
  found: boolean
  category?: string
  amount?: number
  vendor?: string
  date?: string
  notes?: string
}

export async function getLatestExpense(): Promise<LatestExpenseResult> {
  await connectDB()
  const exp = await Expense.findOne().sort({ expenseDate: -1 }).limit(1).lean()
  if (!exp) return { found: false }
  return {
    found: true,
    category: exp.category,
    amount: exp.amount,
    vendor: exp.vendorName ?? undefined,
    date: fmtDate(exp.expenseDate),
    notes: exp.notes ?? undefined,
  }
}

export interface ExpensePeriodResult {
  period: string
  totalAmount: number
  transactionCount: number
  breakdown: { category: string; amount: number }[]
  largest: { category: string; amount: number; vendor?: string; date: string } | null
}

export async function getExpensesByPeriod(period: 'today' | 'yesterday' | 'week' | 'month' | 'lastMonth'): Promise<ExpensePeriodResult> {
  await connectDB()
  const { from, to } = dateRange(period)
  const expenses = await Expense.find({ expenseDate: { $gte: from, $lte: to } }).sort({ amount: -1 }).lean()

  const breakdown: Record<string, number> = {}
  for (const e of expenses) {
    breakdown[e.category] = (breakdown[e.category] ?? 0) + e.amount
  }

  const largest = expenses[0] ? {
    category: expenses[0].category,
    amount: expenses[0].amount,
    vendor: expenses[0].vendorName ?? undefined,
    date: fmtDate(expenses[0].expenseDate),
  } : null

  const periodLabels: Record<string, string> = {
    today: 'today', yesterday: 'yesterday', week: 'this week',
    month: 'this month', lastMonth: 'last month',
  }

  return {
    period: periodLabels[period],
    totalAmount: Math.round(expenses.reduce((s, e) => s + e.amount, 0)),
    transactionCount: expenses.length,
    breakdown: Object.entries(breakdown)
      .map(([category, amount]) => ({ category, amount: Math.round(amount) }))
      .sort((a, b) => b.amount - a.amount),
    largest,
  }
}

// ─── Profit ───────────────────────────────────────────────────────────────────

export interface ProfitPeriodResult {
  period: string
  revenue: number
  expenses: number
  profit: number
  profitMargin: number
}

export async function getProfitByPeriod(period: 'today' | 'week' | 'month' | 'lastMonth'): Promise<ProfitPeriodResult> {
  await connectDB()
  const { from, to } = dateRange(period)

  const [salesAgg, expAgg] = await Promise.all([
    Sale.aggregate([{ $match: { saleDate: { $gte: from, $lte: to } } }, { $group: { _id: null, total: { $sum: '$totalAmount' } } }]),
    Expense.aggregate([{ $match: { expenseDate: { $gte: from, $lte: to } } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
  ])

  const revenue = Math.round(salesAgg[0]?.total ?? 0)
  const expenses = Math.round(expAgg[0]?.total ?? 0)
  const profit = revenue - expenses
  const profitMargin = revenue > 0 ? Math.round((profit / revenue) * 1000) / 10 : 0

  const periodLabels: Record<string, string> = {
    today: 'today', week: 'this week', month: 'this month', lastMonth: 'last month',
  }

  return { period: periodLabels[period] ?? period, revenue, expenses, profit, profitMargin }
}

// ─── Cash Flow ────────────────────────────────────────────────────────────────

export interface CashFlowResult {
  pendingReceivables: number
  pendingPayables: number
  overdueReceivables: number
  netCashPosition: number
  recentEntries: { type: string; party: string; amount: number; dueDate: string; status: string }[]
}

export async function getCashFlowSummary(): Promise<CashFlowResult> {
  await connectDB()
  const entries = await Cashflow.find().sort({ createdAt: -1 }).limit(20).lean()

  let pendingReceivables = 0, pendingPayables = 0, overdueReceivables = 0
  const now = new Date()

  for (const e of entries) {
    if (e.status === 'pending' || e.status === 'overdue') {
      if (e.type === 'receivable') {
        pendingReceivables += e.amount
        if (new Date(e.dueDate) < now) overdueReceivables += e.amount
      } else {
        pendingPayables += e.amount
      }
    }
  }

  return {
    pendingReceivables: Math.round(pendingReceivables),
    pendingPayables: Math.round(pendingPayables),
    overdueReceivables: Math.round(overdueReceivables),
    netCashPosition: Math.round(pendingReceivables - pendingPayables),
    recentEntries: entries.slice(0, 5).map(e => ({
      type: e.type,
      party: e.customerOrVendor,
      amount: e.amount,
      dueDate: fmtDate(e.dueDate),
      status: e.status,
    })),
  }
}

// ─── Alerts ───────────────────────────────────────────────────────────────────

export interface AlertsResult {
  total: number
  critical: number
  warnings: number
  alerts: { severity: string; message: string; alertType: string; createdAt: string }[]
}

export async function getActiveAlerts(): Promise<AlertsResult> {
  await connectDB()
  const alerts = await Alert.find({ acknowledgedAt: null }).sort({ createdAt: -1 }).limit(15).lean()
  return {
    total: alerts.length,
    critical: alerts.filter(a => a.severity === 'critical').length,
    warnings: alerts.filter(a => a.severity === 'warning').length,
    alerts: alerts.map(a => ({
      severity: a.severity,
      message: a.message,
      alertType: a.alertType,
      createdAt: fmtDate(a.createdAt as Date | undefined),
    })),
  }
}

// ─── Products ────────────────────────────────────────────────────────────────

export interface ProductSearchResult {
  found: boolean
  name?: string
  category?: string
  retailPrice?: number
  unitCost?: number
  stockQuantity?: number
  sku?: string
  isActive?: boolean
  stockStatus?: string
}

export async function findProduct(nameOrSku: string): Promise<ProductSearchResult> {
  await connectDB()
  const product = await Product.findOne({
    $or: [
      { name: { $regex: nameOrSku, $options: 'i' } },
      { sku: { $regex: nameOrSku, $options: 'i' } },
    ],
  }).lean()
  if (!product) return { found: false }
  const status = product.stockQuantity === 0 ? 'Out of Stock' : product.stockQuantity <= product.reorderThreshold ? 'Low Stock' : 'In Stock'
  return {
    found: true, name: product.name, category: product.category,
    retailPrice: product.retailPrice, unitCost: product.unitCost,
    stockQuantity: product.stockQuantity, sku: product.sku,
    isActive: product.isActive, stockStatus: status,
  }
}
