import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { getTokenFromRequest } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import User from '@/lib/models/User'
import { sendNewStaffWebhook } from '@/lib/n8n/webhooks'

export async function GET(req: NextRequest) {
  const payload = getTokenFromRequest(req)
  if (!payload || payload.role !== 'owner') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()
  const staff = await User.find().select('name email role isActive createdAt lastLogin')
  return NextResponse.json(staff)
}

export async function POST(req: NextRequest) {
  const payload = getTokenFromRequest(req)
  if (!payload || payload.role !== 'owner') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    await connectDB()
    const { name, email, password, role } = await req.json()
    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Name, email and password required' }, { status: 400 })
    }

    const existing = await User.findOne({ email })
    if (existing) return NextResponse.json({ error: 'Email already in use' }, { status: 409 })

    const passwordHash = await bcrypt.hash(password, 10)
    const user = await User.create({ name, email, passwordHash, role: role || 'staff' })

    await sendNewStaffWebhook({ userId: user._id, name: user.name, email: user.email, role: user.role })

    return NextResponse.json({ id: user._id, name: user.name, email: user.email, role: user.role, isActive: user.isActive }, { status: 201 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
