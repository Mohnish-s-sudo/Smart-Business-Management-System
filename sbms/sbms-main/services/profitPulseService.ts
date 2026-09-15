import { connectDB } from '@/lib/mongodb'
import Sale from '@/lib/models/Sale'
import Expense from '@/lib/models/Expense'
import Product from '@/lib/models/Product'
import StockTransaction from '@/lib/models/StockTransaction'

export interface MonthlyPoint { month: string; revenue: number; expenses: number; profit: number }
export interface TopProduct { name: string; revenue: number; quantity: number; margin: number }
export interface ProfitSummary {
  totalRevenue: number
  totalExpenses: number
  totalProfit: number
  totalLoss: number
  damagedStockValue: number
  deadStockValue: number
  lowStockCount: number
  topProducts: TopProduct[]
  monthlyData: MonthlyPoint[]
  expenseBreakdown: { category: string; amount: number }[]
}

export async function calculateRevenue(from?: Date, to?: Date): Promise<number> {
  await connectDB()
  const match: Record<string, unknown> = {}
  if (from || to) { match.saleDate = {}; if (from) (match.saleDate as Record<string, unknown>).$gte = from; if (to) (match.saleDate as Record<string, unknown>).$lte = to }
  const res = await Sale.aggregate([{ $match: match }, { $group: { _id: null, total: { $sum: '$totalAmount' } } }])
  return res[0]?.total || 0
}

export async function calculateExpenses(from?: Date, to?: Date): Promise<number> {
  await connectDB()
  const match: Record<string, unknown> = {}
  if (from || to) { match.expenseDate = {}; if (from) (match.expenseDate as Record<string, unknown>).$gte = from; if (to) (match.expenseDate as Record<string, unknown>).$lte = to }
  const res = await Expense.aggregate([{ $match: match }, { $group: { _id: null, total: { $sum: '$amount' } } }])
  return res[0]?.total || 0
}

export async function calculateProfit(from?: Date, to?: Date): Promise<number> {
  const [rev, exp, damaged] = await Promise.all([calculateRevenue(from, to), calculateExpenses(from, to), getDamagedStockValue(from, to)])
  return rev - exp - damaged
}

export async function calculateLoss(from?: Date, to?: Date): Promise<number> {
  await connectDB()
  const [damaged, deadStock] = await Promise.all([getDamagedStockValue(from, to), getDeadStockValue()])
  return damaged + deadStock
}

export async function getDamagedStockValue(from?: Date, to?: Date): Promise<number> {
  await connectDB()
  const match: Record<string, unknown> = { type: 'damage' }
  if (from || to) { match.createdAt = {}; if (from) (match.createdAt as Record<string, unknown>).$gte = from; if (to) (match.createdAt as Record<string, unknown>).$lte = to }
  const txns = await StockTransaction.find(match).populate('productId', 'unitCost')
  return txns.reduce((sum, t) => {
    const cost = (t.productId as unknown as { unitCost?: number })?.unitCost || 0
    return sum + Math.abs(t.quantity) * cost
  }, 0)
}

export async function getDeadStock(): Promise<{ name: string; sku: string; stockQuantity: number; value: number }[]> {
  await connectDB()
  const ninetyDaysAgo = new Date(); ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
  const soldProductIds = await Sale.distinct('items.productId', { saleDate: { $gte: ninetyDaysAgo } })
  const dead = await Product.find({ isActive: true, _id: { $nin: soldProductIds }, stockQuantity: { $gt: 0 } })
  return dead.map(p => ({ name: p.name, sku: p.sku, stockQuantity: p.stockQuantity, value: p.stockQuantity * p.unitCost }))
}

export async function getDeadStockValue(): Promise<number> {
  const dead = await getDeadStock()
  return dead.reduce((s, p) => s + p.value, 0)
}

export async function getLowStock(): Promise<{ name: string; stockQuantity: number; reorderThreshold: number }[]> {
  await connectDB()
  const products = await Product.find({ isActive: true })
  return products.filter(p => p.stockQuantity <= p.reorderThreshold).map(p => ({ name: p.name, stockQuantity: p.stockQuantity, reorderThreshold: p.reorderThreshold }))
}

export async function getTopSellingProducts(limit = 5): Promise<TopProduct[]> {
  await connectDB()
  const res = await Sale.aggregate([
    { $unwind: '$items' },
    { $group: { _id: '$items.productId', name: { $first: '$items.productName' }, revenue: { $sum: { $multiply: ['$items.unitPrice', '$items.quantity'] } }, quantity: { $sum: '$items.quantity' }, margin: { $sum: '$items.lineMargin' } } },
    { $sort: { revenue: -1 } },
    { $limit: limit },
    { $project: { _id: 0, name: 1, revenue: { $round: ['$revenue', 0] }, quantity: 1, margin: { $round: ['$margin', 0] } } }
  ])
  return res
}

export async function getMonthlyReport(months = 6): Promise<MonthlyPoint[]> {
  await connectDB()
  const points: MonthlyPoint[] = []
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i)
    const from = new Date(d.getFullYear(), d.getMonth(), 1)
    const to = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59)
    const [rev, exp] = await Promise.all([calculateRevenue(from, to), calculateExpenses(from, to)])
    points.push({ month: from.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }), revenue: Math.round(rev), expenses: Math.round(exp), profit: Math.round(rev - exp) })
  }
  return points
}

export async function getProfitSummary(): Promise<ProfitSummary> {
  await connectDB()
  const [totalRevenue, totalExpenses, damagedStockValue, deadStockValue, lowStock, topProducts, monthlyData, expBreakdown] = await Promise.all([
    calculateRevenue(),
    calculateExpenses(),
    getDamagedStockValue(),
    getDeadStockValue(),
    getLowStock(),
    getTopSellingProducts(),
    getMonthlyReport(),
    Expense.aggregate([{ $group: { _id: '$category', amount: { $sum: '$amount' } } }, { $project: { category: '$_id', amount: { $round: ['$amount', 0] }, _id: 0 } }])
  ])
  const totalProfit = totalRevenue - totalExpenses - damagedStockValue
  const totalLoss = damagedStockValue + deadStockValue
  return {
    totalRevenue: Math.round(totalRevenue),
    totalExpenses: Math.round(totalExpenses),
    totalProfit: Math.round(totalProfit),
    totalLoss: Math.round(totalLoss),
    damagedStockValue: Math.round(damagedStockValue),
    deadStockValue: Math.round(deadStockValue),
    lowStockCount: lowStock.length,
    topProducts,
    monthlyData,
    expenseBreakdown: expBreakdown
  }
}
