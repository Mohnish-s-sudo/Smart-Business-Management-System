import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { connectDB } from '@/lib/mongodb'
import User from '@/lib/models/User'
import { signToken } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const { name, email, password, role } = await req.json()
    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Name, email and password required' }, { status: 400 })
    }

    await connectDB()
    const existing = await User.findOne({ email })
    if (existing) return NextResponse.json({ error: 'Email already in use' }, { status: 409 })

    const passwordHash = await bcrypt.hash(password, 10)
    const user = await User.create({ name, email, password: passwordHash, role: role || 'staff' })

    const token = signToken({ userId: user._id.toString(), email: user.email, role: user.role, name: user.name })

    return NextResponse.json({
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
      token
    }, { status: 201 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
