import { NextRequest, NextResponse } from 'next/server'
import { getTokenFromRequest } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import Sale from '@/lib/models/Sale'
import Expense from '@/lib/models/Expense'
import Product from '@/lib/models/Product'
import StockTransaction from '@/lib/models/StockTransaction'

/**
 * GET /api/business-timeline/snapshot?date=YYYY-MM-DD
 *
 * Returns a point-in-time business snapshot for the owner.
 * Owner-only — returns 403 for staff.
 */
export async function GET(req: NextRequest) {
  const payload = getTokenFromRequest(req)

  // Debug log (safe — no secrets)
  console.log('[business-timeline] JWT payload:', payload ? { userId: payload.userId, role: payload.role } : null)

  if (!payload) {
    return NextResponse.json({ error: 'Unauthorized — please log in' }, { status: 401 })
  }

  // Strict owner check using the canonical `role` field from the SBMS JWT
  if (payload.role !== 'owner') {
    return NextResponse.json({ error: 'Owner access required' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const dateParam = searchParams.get('date')

  if (!dateParam) {
    return NextResponse.json({ error: 'date query parameter is required (YYYY-MM-DD)' }, { status: 400 })
  }

  const snapshotDate = new Date(dateParam)
  if (isNaN(snapshotDate.getTime())) {
    return NextResponse.json({ error: 'Invalid date format — use YYYY-MM-DD' }, { status: 400 })
  }

  // End of the snapshot day (23:59:59.999)
  const dayEnd = new Date(snapshotDate)
  dayEnd.setHours(23, 59, 59, 999)

  // Start of the snapshot day
  const dayStart = new Date(snapshotDate)
  dayStart.setHours(0, 0, 0, 0)

  // 30 days before the snapshot date for trend context
  const thirtyDaysBefore = new Date(snapshotDate)
  thirtyDaysBefore.setDate(thirtyDaysBefore.getDate() - 29)
  thirtyDaysBefore.setHours(0, 0, 0, 0)

  await connectDB()

  try {
    // ── All-time up to snapshot date ──────────────────────────────────────
    const [totalSalesAgg, totalExpensesAgg] = await Promise.all([
      Sale.aggregate([
        { $match: { saleDate: { $lte: dayEnd } } },
        { $group: { _id: null, total: { $sum: '$totalAmount' }, margin: { $sum: '$grossMargin' }, count: { $sum: 1 } } },
      ]),
      Expense.aggregate([
        { $match: { expenseDate: { $lte: dayEnd } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
    ])

    const totalRevenue = Math.round(totalSalesAgg[0]?.total ?? 0)
    const totalExpenses = Math.round(totalExpensesAgg[0]?.total ?? 0)
    const totalTransactions = totalSalesAgg[0]?.count ?? 0
    const totalProfit = totalRevenue - totalExpenses

    // ── Day's activity ─────────────────────────────────────────────────────
    const [daySalesAgg, dayExpensesAgg, dayItemsAgg] = await Promise.all([
      Sale.aggregate([
        { $match: { saleDate: { $gte: dayStart, $lte: dayEnd } } },
        { $group: { _id: null, revenue: { $sum: '$totalAmount' }, margin: { $sum: '$grossMargin' }, count: { $sum: 1 } } },
      ]),
      Expense.aggregate([
        { $match: { expenseDate: { $gte: dayStart, $lte: dayEnd } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      Sale.aggregate([
        { $match: { saleDate: { $gte: dayStart, $lte: dayEnd } } },
        { $unwind: '$items' },
        { $group: { _id: null, totalItems: { $sum: '$items.quantity' } } },
      ]),
    ])

    const dayRevenue = Math.round(daySalesAgg[0]?.revenue ?? 0)
    const dayTransactions = daySalesAgg[0]?.count ?? 0
    const dayExpenses = Math.round(dayExpensesAgg[0]?.total ?? 0)
    const dayMargin = Math.round(daySalesAgg[0]?.margin ?? 0)
    const itemsSold = dayItemsAgg[0]?.totalItems ?? 0
    const avgBill = dayTransactions > 0 ? Math.round(dayRevenue / dayTransactions) : 0

    // ── Top products on that day ───────────────────────────────────────────
    const topProductsOnDay = await Sale.aggregate([
      { $match: { saleDate: { $gte: dayStart, $lte: dayEnd } } },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.productId',
          name: { $first: '$items.productName' },
          revenue: { $sum: { $multiply: ['$items.unitPrice', '$items.quantity'] } },
          quantity: { $sum: '$items.quantity' },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: 5 },
      { $project: { _id: 0, name: 1, revenue: { $round: ['$revenue', 0] }, quantity: 1 } },
    ])

    // ── Recent sales on that day ───────────────────────────────────────────
    const recentSalesOnDay = await Sale.find({
      saleDate: { $gte: dayStart, $lte: dayEnd },
    })
      .sort({ saleDate: -1 })
      .limit(5)
      .populate('staffId', 'name')
      .lean()

    // ── 30-day revenue trend leading up to the snapshot date ──────────────
    const trendSales = await Sale.aggregate([
      { $match: { saleDate: { $gte: thirtyDaysBefore, $lte: dayEnd } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$saleDate' } },
          revenue: { $sum: '$totalAmount' },
        },
      },
      { $sort: { _id: 1 } },
    ])

    // Fill every day in the 30-day window
    const trendMap: Record<string, number> = {}
    for (let i = 29; i >= 0; i--) {
      const d = new Date(snapshotDate)
      d.setDate(d.getDate() - i)
      trendMap[d.toISOString().split('T')[0]] = 0
    }
    trendSales.forEach(s => { if (trendMap[s._id] !== undefined) trendMap[s._id] = Math.round(s.revenue) })

    const revenueTrend = Object.entries(trendMap).map(([date, revenue]) => ({
      date: new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      revenue,
    }))

    // ── Expense breakdown on that day's 30-day window ──────────────────────
    const expenseBreakdown = await Expense.aggregate([
      { $match: { expenseDate: { $gte: thirtyDaysBefore, $lte: dayEnd } } },
      { $group: { _id: '$category', amount: { $sum: '$amount' } } },
      { $project: { category: '$_id', amount: { $round: ['$amount', 0] }, _id: 0 } },
      { $sort: { amount: -1 } },
    ])

    // ── Stock transactions on that day ────────────────────────────────────
    const stockActivity = await StockTransaction.find({
      createdAt: { $gte: dayStart, $lte: dayEnd },
    })
      .populate('productId', 'name')
      .sort({ createdAt: -1 })
      .limit(10)
      .lean()

    return NextResponse.json({
      snapshotDate: snapshotDate.toISOString().split('T')[0],
      // Cumulative totals up to this date
      cumulative: {
        totalRevenue,
        totalExpenses,
        totalProfit,
        totalTransactions,
        profitMargin: totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 1000) / 10 : 0,
      },
      // Activity on this specific day
      dayActivity: {
        revenue: dayRevenue,
        expenses: dayExpenses,
        transactions: dayTransactions,
        margin: dayMargin,
        itemsSold,
        avgBill,
        profitMargin: dayRevenue > 0 ? Math.round((dayMargin / dayRevenue) * 1000) / 10 : 0,
        topProducts: topProductsOnDay,
        recentSales: recentSalesOnDay.map(s => ({
          transactionRef: s.transactionRef,
          totalAmount: s.totalAmount,
          paymentMethod: s.paymentMethod,
          saleDate: s.saleDate,
          staffName: (s.staffId as any)?.name ?? 'Unknown',
        })),
        stockActivity: stockActivity.map(t => ({
          type: t.type,
          quantity: t.quantity,
          productName: (t.productId as any)?.name ?? 'Unknown',
          note: t.note,
          createdAt: t.createdAt,
        })),
      },
      // 30-day trend leading to this date
      revenueTrend,
      expenseBreakdown,
    })
  } catch (err) {
    console.error('[business-timeline/snapshot]', err)
    return NextResponse.json({ error: 'Failed to load timeline snapshot' }, { status: 500 })
  }
}
