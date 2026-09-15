import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import Product from '@/lib/models/Product'
import Expense from '@/lib/models/Expense'
import StockTransaction from '@/lib/models/StockTransaction'
import StaffShift from '@/lib/models/StaffShift'
import ActivityLog from '@/lib/models/ActivityLog'
import { getTokenFromRequest } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    const payload = getTokenFromRequest(req)
    if (!payload || (payload.role !== 'staff' && payload.role !== 'owner')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Today stock added
    const todayStock = await StockTransaction.aggregate([
      { $match: { type: 'add', createdAt: { $gte: today } } },
      { $group: { _id: null, total: { $sum: '$quantity' } } }
    ])

    // Today expenses
    const todayExpenses = await Expense.aggregate([
      { $match: { expenseDate: { $gte: today } } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ])

    // Low stock count
    const lowStockCount = await Product.countDocuments({
      $expr: { $lte: ['$stockQuantity', '$reorderThreshold'] }
    })

    // Shift status — field is shiftEnd, not endTime
    const shift = await StaffShift.findOne({
      staffId: payload.userId,
      shiftEnd: null
    })

    // Recent activity log entries
    const recentActivities = await ActivityLog.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .lean()

    return NextResponse.json({
      todayStockAdded: todayStock[0]?.total || 0,
      todayExpenses: todayExpenses[0]?.total || 0,
      lowStockCount,
      recentActivities,
      shiftActive: !!shift
    })
  } catch (err) {
    console.error('[staff/dashboard]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}