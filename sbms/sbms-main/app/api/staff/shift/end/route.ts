import { NextRequest, NextResponse } from 'next/server'
import mongoose from 'mongoose'
import { getTokenFromRequest } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import StaffShift from '@/lib/models/StaffShift'
import ActivityLog from '@/lib/models/ActivityLog'

export async function POST(req: NextRequest) {
  const payload = getTokenFromRequest(req)
  if (!payload || payload.role !== 'staff') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await connectDB()
  const staffId = new mongoose.Types.ObjectId(payload.userId)

  const shift = await StaffShift.findOne({ staffId, shiftEnd: null })
  if (!shift) {
    return NextResponse.json({ error: 'No active shift found' }, { status: 400 })
  }

  const now = new Date()
  shift.shiftEnd = now
  shift.hoursWorked = (now.getTime() - shift.shiftStart.getTime()) / 3600000
  await shift.save()

  await ActivityLog.create({
    staffId,
    action: 'SHIFT_END',
    detail: `Shift ended. Hours worked: ${shift.hoursWorked.toFixed(2)}`
  })

  return NextResponse.json({ success: true, shift })
}
