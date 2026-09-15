import { NextRequest, NextResponse } from 'next/server'
import { getTokenFromRequest } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import Sale from '@/lib/models/Sale'
import Expense from '@/lib/models/Expense'
import Product from '@/lib/models/Product'
import Alert from '@/lib/models/Alert'
import Recommendation from '@/lib/models/Recommendation'
import Cashflow from '@/lib/models/Cashflow'
import User from '@/lib/models/User'

export async function GET(req: NextRequest) {
  const payload = getTokenFromRequest(req)
  if (!payload || payload.role !== 'owner') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await connectDB()

  const now = new Date()
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0)
  const weekAgo = new Date(now); weekAgo.setDate(now.getDate() - 7)
  const thirtyDaysAgo = new Date(now); thirtyDaysAgo.setDate(now.getDate() - 30)

  // KPIs
  const [todayAgg, monthAgg, products, receivablesAgg, totalStaff] = await Promise.all([
    Sale.aggregate([
      { $match: { saleDate: { $gte: todayStart } } },
      { $group: { _id: null, revenue: { $sum: '$totalAmount' }, margin: { $sum: '$grossMargin' }, count: { $sum: 1 } } }
    ]),
    Sale.aggregate([
      { $match: { saleDate: { $gte: thirtyDaysAgo } } },
      { $group: { _id: null, revenue: { $sum: '$totalAmount' }, margin: { $sum: '$grossMargin' } } }
    ]),
    Product.find({ isActive: true }),
    Cashflow.aggregate([
      { $match: { type: 'receivable', status: { $in: ['pending', 'overdue'] } } },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }
    ]),
    User.countDocuments({ isActive: true })
  ])

  const todayStats = todayAgg[0] || { revenue: 0, margin: 0, count: 0 }
  const monthStats = monthAgg[0] || { revenue: 0, margin: 0 }
  const lowStockProducts = products.filter(p => p.stockQuantity <= p.reorderThreshold && p.stockQuantity > 0)
  const outOfStockProducts = products.filter(p => p.stockQuantity === 0)
  const alertsCount = lowStockProducts.length + outOfStockProducts.length
  const receivablesStats = receivablesAgg[0] || { total: 0, count: 0 }
  const marginPct = monthStats.revenue > 0 ? (monthStats.margin / monthStats.revenue) * 100 : 0

  // 7-day revenue chart
  const sevenDaySales = await Sale.aggregate([
    { $match: { saleDate: { $gte: weekAgo } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$saleDate' } },
        revenue: { $sum: '$totalAmount' },
        margin: { $sum: '$grossMargin' }
      }
    },
    { $sort: { _id: 1 } }
  ])

  const dailyMap: Record<string, { revenue: number; margin: number }> = {}
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now); d.setDate(d.getDate() - i)
    dailyMap[d.toISOString().split('T')[0]] = { revenue: 0, margin: 0 }
  }
  sevenDaySales.forEach(s => {
    if (dailyMap[s._id]) {
      dailyMap[s._id].revenue = Math.round(s.revenue)
      dailyMap[s._id].margin = Math.round(s.margin)
    }
  })
  const revenueChart = Object.entries(dailyMap).map(([date, v]) => ({
    date: new Date(date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' }),
    revenue: v.revenue,
    margin: v.margin
  }))

  // Expense breakdown (30 days)
  const expenseBreakdown = await Expense.aggregate([
    { $match: { expenseDate: { $gte: thirtyDaysAgo } } },
    { $group: { _id: '$category', amount: { $sum: '$amount' } } },
    { $project: { category: '$_id', amount: { $round: ['$amount', 0] }, _id: 0 } }
  ])

  // Top 5 products by margin (30 days)
  const topProducts = await Sale.aggregate([
    { $match: { saleDate: { $gte: thirtyDaysAgo } } },
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.productId',
        name: { $first: '$items.productName' },
        margin: { $sum: '$items.lineMargin' },
        revenue: { $sum: { $multiply: ['$items.unitPrice', '$items.quantity'] } }
      }
    },
    { $addFields: { marginPct: { $cond: [{ $gt: ['$revenue', 0] }, { $multiply: [{ $divide: ['$margin', '$revenue'] }, 100] }, 0] } } },
    { $sort: { margin: -1 } },
    { $limit: 5 },
    { $project: { _id: 0, name: 1, margin: { $round: ['$margin', 0] }, revenue: { $round: ['$revenue', 0] }, marginPct: { $round: ['$marginPct', 1] } } }
  ])

  // Recent sales, alerts, recommendations
  const recentSales = await Sale.find().sort({ saleDate: -1 }).limit(5).populate('staffId', 'name')
  const [recentAlerts, recommendations] = await Promise.all([
    Alert.find().sort({ createdAt: -1 }).limit(5),
    Recommendation.find({ status: 'active' }).sort({ createdAt: -1 }).limit(3)
  ])

  // All-time totals
  const [totalSalesAgg, totalExpensesAgg] = await Promise.all([
    Sale.aggregate([{ $group: { _id: null, total: { $sum: '$totalAmount' } } }]),
    Expense.aggregate([{ $group: { _id: null, total: { $sum: '$amount' } } }])
  ])
  const totalSales = totalSalesAgg[0]?.total || 0
  const totalExpenses = totalExpensesAgg[0]?.total || 0
  return NextResponse.json({
    totalSales: Math.round(totalSales),
    totalExpenses: Math.round(totalExpenses),
    totalProfit: Math.round(totalSales - totalExpenses),
    totalProducts: products.length,
    totalStaff,
    alertsCount,
    lowStockProducts: lowStockProducts.map(p => ({
      _id: p._id,
      name: p.name,
      stockQuantity: p.stockQuantity,
      reorderThreshold: p.reorderThreshold
    })),
    recentSales,
    kpis: {
      todayRevenue: Math.round(todayStats.revenue),
      todayTransactions: todayStats.count,
      todayMargin: Math.round(todayStats.margin),
      marginPct: Math.round(marginPct * 10) / 10,
      activeReceivables: Math.round(receivablesStats.total),
      receivablesCount: receivablesStats.count,
      lowStockCount: lowStockProducts.length,
      outOfStockCount: outOfStockProducts.length
    },
    revenueChart,
    expenseBreakdown,
    topProducts,
    recentAlerts,
    recommendations
  })
}
