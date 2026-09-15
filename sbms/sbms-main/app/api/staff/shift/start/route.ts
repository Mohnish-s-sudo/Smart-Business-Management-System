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

  const activeShift = await StaffShift.findOne({ staffId, shiftEnd: null })
  if (activeShift) {
    return NextResponse.json({ error: 'Shift already active' }, { status: 400 })
  }

  const shift = await StaffShift.create({ staffId, shiftStart: new Date() })
  await ActivityLog.create({ staffId, action: 'SHIFT_START', detail: `Shift started at ${new Date().toLocaleTimeString()}` })

  return NextResponse.json({ success: true, shift }, { status: 201 })
}
